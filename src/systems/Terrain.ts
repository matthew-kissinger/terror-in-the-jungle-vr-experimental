import * as THREE from 'three';
import { GameSystem, TerrainConfig } from '../types';
import { PixelPerfectUtils } from '../utils/PixelPerfect';

export class Terrain implements GameSystem {
  private mesh?: THREE.Mesh;
  private scene: THREE.Scene;
  private config: TerrainConfig;

  constructor(scene: THREE.Scene, config: TerrainConfig = {
    size: 200,
    segments: 1,
    textureRepeat: 20
  }) {
    this.scene = scene;
    this.config = config;
  }

  async init(): Promise<void> {
    // Terrain mesh will be created when texture is provided
  }

  update(deltaTime: number): void {
    // Terrain is static, no updates needed
  }

  dispose(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      if (this.mesh.material instanceof THREE.Material) {
        this.mesh.material.dispose();
      }
    }
  }

  createTerrain(groundTexture: THREE.Texture): void {
    // Configure texture for tiling
    PixelPerfectUtils.configureTexture(groundTexture);
    groundTexture.repeat.set(this.config.textureRepeat, this.config.textureRepeat);

    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(
      this.config.size, 
      this.config.size, 
      this.config.segments, 
      this.config.segments
    );
    
    // Rotate to be horizontal
    geometry.rotateX(-Math.PI / 2);

    // Create material
    const material = new THREE.MeshLambertMaterial({
      map: groundTexture,
      side: THREE.FrontSide
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = 0;
    this.mesh.receiveShadow = true;

    // Add to scene
    this.scene.add(this.mesh);

    console.log(`Terrain created: ${this.config.size}x${this.config.size} units, ${this.config.textureRepeat}x repeat`);
  }

  getSize(): number {
    return this.config.size;
  }

  getHeightAt(x: number, z: number): number {
    // For now, terrain is flat at y=0
    // In the future, this could sample a heightmap
    return 0;
  }

  isWithinBounds(x: number, z: number): boolean {
    const halfSize = this.config.size / 2;
    return x >= -halfSize && x <= halfSize && z >= -halfSize && z <= halfSize;
  }
}