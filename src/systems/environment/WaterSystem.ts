import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { GameSystem } from '../../types';
import { AssetLoader } from '../assets/AssetLoader';

export class WaterSystem implements GameSystem {
  private scene: THREE.Scene;
  private water?: Water;
  private assetLoader: AssetLoader;
  
  // Water configuration
  private readonly WATER_LEVEL = 0; // Sea level height
  private readonly WATER_SIZE = 2000; // Size of water plane
  private readonly WATER_SEGMENTS = 100; // Geometry segments for waves
  
  // Sun/lighting for water reflections
  private sun: THREE.Vector3;
  
  constructor(scene: THREE.Scene, assetLoader: AssetLoader) {
    this.scene = scene;
    this.assetLoader = assetLoader;
    this.sun = new THREE.Vector3();
  }

  async init(): Promise<void> {
    console.log('💧 Initializing Water System...');
    
    // Create water geometry - large plane
    const waterGeometry = new THREE.PlaneGeometry(
      this.WATER_SIZE, 
      this.WATER_SIZE,
      this.WATER_SEGMENTS,
      this.WATER_SEGMENTS
    );

    // Load water normal texture
    let waterNormals = this.assetLoader.getTexture('waternormals');
    if (!waterNormals) {
      // Fallback: try to load it directly
      console.log('⏳ Loading water normal texture directly...');
      waterNormals = await new THREE.TextureLoader().loadAsync('/assets/waternormals.jpg');
    }
    
    // Configure texture wrapping for seamless tiling
    waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;

    // Create water with shader
    this.water = new Water(waterGeometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: waterNormals,
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x001e0f, // Deep blue-green
      distortionScale: 3.7,
      fog: this.scene.fog !== undefined,
      alpha: 0.9, // Slight transparency
    });

    // Rotate to be horizontal (Water defaults to vertical)
    this.water.rotation.x = -Math.PI / 2;
    
    // Position at water level
    this.water.position.y = this.WATER_LEVEL;
    
    // Add to scene
    this.scene.add(this.water);
    
    // Set initial sun position (matches directional light)
    this.updateSunPosition(50, 100, 30);
    
    console.log(`✅ Water System initialized at Y=${this.WATER_LEVEL}`);
  }

  update(deltaTime: number): void {
    if (!this.water) return;
    
    // Update water time for wave animation
    const waterUniforms = (this.water.material as any).uniforms;
    if (waterUniforms && waterUniforms.time) {
      waterUniforms.time.value += deltaTime * 0.5; // Slower wave speed
    }
  }

  dispose(): void {
    if (this.water) {
      this.scene.remove(this.water);
      this.water.geometry.dispose();
      (this.water.material as THREE.Material).dispose();
    }
    console.log('🧹 Water System disposed');
  }

  /**
   * Update sun direction for water reflections
   */
  updateSunPosition(x: number, y: number, z: number): void {
    this.sun.set(x, y, z);
    this.sun.normalize();
    
    if (this.water) {
      const waterUniforms = (this.water.material as any).uniforms;
      if (waterUniforms && waterUniforms.sunDirection) {
        waterUniforms.sunDirection.value.copy(this.sun);
      }
    }
  }
  
  /**
   * Get the water level for other systems to check
   */
  getWaterLevel(): number {
    return this.WATER_LEVEL;
  }
  
  /**
   * Check if a position is underwater
   */
  isUnderwater(position: THREE.Vector3): boolean {
    return position.y < this.WATER_LEVEL;
  }
  
  /**
   * Set water color
   */
  setWaterColor(color: number): void {
    if (this.water) {
      const waterUniforms = (this.water.material as any).uniforms;
      if (waterUniforms && waterUniforms.waterColor) {
        waterUniforms.waterColor.value = new THREE.Color(color);
      }
    }
  }
  
  /**
   * Set distortion scale (wave intensity)
   */
  setDistortionScale(scale: number): void {
    if (this.water) {
      const waterUniforms = (this.water.material as any).uniforms;
      if (waterUniforms && waterUniforms.distortionScale) {
        waterUniforms.distortionScale.value = scale;
      }
    }
  }
}