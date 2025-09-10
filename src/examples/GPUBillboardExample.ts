import * as THREE from 'three';
import { GPUBillboardSystem } from '../systems/GPUBillboardSystem';
import { BillboardInstance } from '../types';

/**
 * Example usage of the GPU-based Billboard System
 * Demonstrates how to create and manage millions of vegetation instances
 */
export class GPUBillboardExample {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private billboardSystem: GPUBillboardSystem;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
    this.billboardSystem = new GPUBillboardSystem(scene, camera);
  }

  async init(): Promise<void> {
    await this.billboardSystem.init();
  }

  /**
   * Create a massive grass field using GPU billboards
   */
  async createGrassField(
    grassTexture: THREE.Texture,
    fieldSize: number = 200,
    grassDensity: number = 0.5
  ): Promise<void> {
    console.log('Creating GPU-based grass field...');

    // Calculate number of grass instances
    const grassCount = Math.floor(fieldSize * fieldSize * grassDensity);
    
    // Create billboard type for grass
    this.billboardSystem.createBillboardType(
      'grass',
      grassTexture,
      grassCount,
      1.0,  // width
      1.5   // height
    );

    // Generate grass instances
    const grassInstances: BillboardInstance[] = [];
    for (let i = 0; i < grassCount; i++) {
      grassInstances.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * fieldSize,
          0,
          (Math.random() - 0.5) * fieldSize
        ),
        scale: new THREE.Vector3(
          0.8 + Math.random() * 0.4,  // Random scale 0.8-1.2
          0.8 + Math.random() * 0.4,
          1
        ),
        rotation: Math.random() * Math.PI * 2  // This will be ignored by GPU shader
      });
    }

    // Batch add all instances for better performance
    const startTime = performance.now();
    this.billboardSystem.addInstances('grass', grassInstances);
    const createTime = performance.now() - startTime;

    console.log(`Created ${grassCount} grass instances in ${createTime.toFixed(2)}ms`);
  }

  /**
   * Create a forest using GPU billboards
   */
  async createForest(
    treeTextures: THREE.Texture[],
    forestSize: number = 100,
    treeDensity: number = 0.02
  ): Promise<void> {
    console.log('Creating GPU-based forest...');

    const treeCount = Math.floor(forestSize * forestSize * treeDensity);

    // Create billboard types for different tree types
    treeTextures.forEach((texture, index) => {
      this.billboardSystem.createBillboardType(
        `tree_${index}`,
        texture,
        Math.floor(treeCount / treeTextures.length),
        3.0,  // width
        6.0   // height
      );
    });

    // Generate tree instances
    for (let i = 0; i < treeCount; i++) {
      const treeType = `tree_${Math.floor(Math.random() * treeTextures.length)}`;
      
      this.billboardSystem.addInstance(treeType, {
        position: new THREE.Vector3(
          (Math.random() - 0.5) * forestSize,
          0,
          (Math.random() - 0.5) * forestSize
        ),
        scale: new THREE.Vector3(
          0.7 + Math.random() * 0.6,  // Random scale 0.7-1.3
          0.7 + Math.random() * 0.6,
          1
        ),
        rotation: 0  // Rotation handled by GPU shader
      });
    }

    console.log(`Created ${treeCount} tree instances across ${treeTextures.length} types`);
  }

  /**
   * Create animated vegetation (swaying in wind)
   * This demonstrates how to animate instances while maintaining GPU performance
   */
  createAnimatedVegetation(
    texture: THREE.Texture,
    count: number = 1000
  ): void {
    this.billboardSystem.createBillboardType(
      'animated_plants',
      texture,
      count,
      1.5,
      2.0
    );

    // Create instances with initial positions
    for (let i = 0; i < count; i++) {
      this.billboardSystem.addInstance('animated_plants', {
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 50,
          0,
          (Math.random() - 0.5) * 50
        ),
        scale: new THREE.Vector3(1, 1, 1),
        rotation: 0
      });
    }
  }

  /**
   * Update animated vegetation (call this in your game loop)
   */
  updateAnimatedVegetation(time: number): void {
    const instances = this.billboardSystem.getAllInstances('animated_plants');
    
    instances.forEach((instance, index) => {
      // Simulate wind effect by slightly offsetting position
      const windStrength = 0.1;
      const windSpeed = 2.0;
      const windOffset = Math.sin(time * windSpeed + index * 0.1) * windStrength;
      
      // Update instance with wind effect
      this.billboardSystem.updateInstance('animated_plants', index, {
        ...instance,
        position: new THREE.Vector3(
          instance.position.x + windOffset,
          instance.position.y,
          instance.position.z
        )
      });
    });
  }

  update(deltaTime: number): void {
    this.billboardSystem.update(deltaTime);
  }

  dispose(): void {
    this.billboardSystem.dispose();
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics() {
    return this.billboardSystem.getPerformanceMetrics();
  }

  /**
   * Log current performance statistics
   */
  logPerformanceStats(): void {
    const metrics = this.getPerformanceMetrics();
    console.log('GPU Billboard Performance:', {
      totalInstances: metrics.totalInstances,
      lastUpdateTime: `${metrics.lastUpdateTime.toFixed(2)}ms`,
      timePerInstance: `${(metrics.averageTimePerInstance * 1000).toFixed(4)}μs`,
      estimatedMaxFPS: Math.floor(1000 / Math.max(metrics.lastUpdateTime, 0.001))
    });
  }
}