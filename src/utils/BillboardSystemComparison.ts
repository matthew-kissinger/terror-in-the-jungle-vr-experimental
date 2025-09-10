import * as THREE from 'three';
import { BillboardSystem } from '../systems/Billboard';
import { GPUBillboardSystem } from '../systems/GPUBillboardSystem';
import { BillboardInstance } from '../types';

/**
 * Utility class to compare performance between CPU and GPU billboard systems
 */
export class BillboardSystemComparison {
  static async runPerformanceTest(
    scene: THREE.Scene,
    camera: THREE.Camera,
    texture: THREE.Texture,
    instanceCount: number = 10000
  ): Promise<{
    cpuResults: PerformanceResults;
    gpuResults: PerformanceResults;
  }> {
    console.log(`Running billboard performance comparison with ${instanceCount} instances...`);

    // Generate test instances
    const testInstances = this.generateTestInstances(instanceCount);

    // Test CPU-based system
    console.log('Testing CPU-based billboard system...');
    const cpuResults = await this.testSystem(
      new BillboardSystem(scene, camera),
      'cpu-test',
      texture,
      testInstances
    );

    // Test GPU-based system
    console.log('Testing GPU-based billboard system...');
    const gpuResults = await this.testSystem(
      new GPUBillboardSystem(scene, camera),
      'gpu-test',
      texture,
      testInstances
    );

    // Log comparison results
    this.logComparisonResults(cpuResults, gpuResults, instanceCount);

    return { cpuResults, gpuResults };
  }

  private static generateTestInstances(count: number): BillboardInstance[] {
    const instances: BillboardInstance[] = [];
    
    for (let i = 0; i < count; i++) {
      instances.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 200,
          Math.random() * 10,
          (Math.random() - 0.5) * 200
        ),
        scale: new THREE.Vector3(1, 1, 1),
        rotation: Math.random() * Math.PI * 2
      });
    }
    
    return instances;
  }

  private static async testSystem(
    system: BillboardSystem | GPUBillboardSystem,
    typeName: string,
    texture: THREE.Texture,
    instances: BillboardInstance[]
  ): Promise<PerformanceResults> {
    await system.init();

    // Create billboard type
    system.createBillboardType(typeName, texture, instances.length);

    // Measure instance creation time
    const createStartTime = performance.now();
    instances.forEach(instance => {
      system.addInstance(typeName, instance);
    });
    const createTime = performance.now() - createStartTime;

    // Measure update performance over multiple frames
    const updateTimes: number[] = [];
    const testFrames = 120; // Test for 2 seconds at 60 FPS

    for (let frame = 0; frame < testFrames; frame++) {
      const updateStartTime = performance.now();
      system.update(16.67); // Simulate 60 FPS
      const updateTime = performance.now() - updateStartTime;
      updateTimes.push(updateTime);
    }

    // Calculate statistics
    const averageUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
    const minUpdateTime = Math.min(...updateTimes);
    const maxUpdateTime = Math.max(...updateTimes);

    // Clean up
    system.dispose();

    return {
      instanceCount: instances.length,
      createTime,
      averageUpdateTime,
      minUpdateTime,
      maxUpdateTime,
      totalTestTime: createTime + updateTimes.reduce((a, b) => a + b, 0)
    };
  }

  private static logComparisonResults(
    cpuResults: PerformanceResults,
    gpuResults: PerformanceResults,
    instanceCount: number
  ): void {
    console.log('\n=== Billboard System Performance Comparison ===');
    console.log(`Instance Count: ${instanceCount}`);
    console.log('\nCPU-based System:');
    console.log(`  Creation Time: ${cpuResults.createTime.toFixed(2)}ms`);
    console.log(`  Average Update: ${cpuResults.averageUpdateTime.toFixed(2)}ms`);
    console.log(`  Min Update: ${cpuResults.minUpdateTime.toFixed(2)}ms`);
    console.log(`  Max Update: ${cpuResults.maxUpdateTime.toFixed(2)}ms`);
    console.log(`  Per Instance (avg): ${(cpuResults.averageUpdateTime / instanceCount * 1000).toFixed(4)}μs`);

    console.log('\nGPU-based System:');
    console.log(`  Creation Time: ${gpuResults.createTime.toFixed(2)}ms`);
    console.log(`  Average Update: ${gpuResults.averageUpdateTime.toFixed(2)}ms`);
    console.log(`  Min Update: ${gpuResults.minUpdateTime.toFixed(2)}ms`);
    console.log(`  Max Update: ${gpuResults.maxUpdateTime.toFixed(2)}ms`);
    console.log(`  Per Instance (avg): ${(gpuResults.averageUpdateTime / instanceCount * 1000).toFixed(4)}μs`);

    console.log('\nPerformance Improvement:');
    const updateSpeedup = cpuResults.averageUpdateTime / gpuResults.averageUpdateTime;
    const createSpeedup = cpuResults.createTime / gpuResults.createTime;
    console.log(`  Update Speed: ${updateSpeedup.toFixed(2)}x faster`);
    console.log(`  Creation Speed: ${createSpeedup.toFixed(2)}x faster`);

    const fpsAtCpu = 1000 / cpuResults.averageUpdateTime;
    const fpsAtGpu = 1000 / gpuResults.averageUpdateTime;
    console.log(`  Estimated Max FPS (CPU): ${fpsAtCpu.toFixed(1)}`);
    console.log(`  Estimated Max FPS (GPU): ${fpsAtGpu.toFixed(1)}`);
    console.log('===============================================\n');
  }
}

interface PerformanceResults {
  instanceCount: number;
  createTime: number;
  averageUpdateTime: number;
  minUpdateTime: number;
  maxUpdateTime: number;
  totalTestTime: number;
}