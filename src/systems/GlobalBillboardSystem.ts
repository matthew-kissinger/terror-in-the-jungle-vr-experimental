import * as THREE from 'three';
import { GameSystem, BillboardInstance } from '../types';
import { AssetLoader } from './AssetLoader';
import { PixelPerfectUtils } from '../utils/PixelPerfect';

interface ChunkInstances {
  start: number;
  count: number;
  instances: BillboardInstance[];
}

export class GlobalBillboardSystem implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private assetLoader: AssetLoader;
  
  // Global instanced meshes
  private grassInstances?: THREE.InstancedMesh;
  private treeInstances?: THREE.InstancedMesh;
  
  // Chunk tracking
  private chunkInstances: Map<string, Map<string, ChunkInstances>> = new Map();
  
  // Instance allocation tracking
  private grassAllocationIndex = 0;
  private treeAllocationIndex = 0;
  private freeGrassSlots: number[] = [];
  private freeTreeSlots: number[] = [];
  
  // Configuration
  private readonly maxGrassInstances = 100000;
  private readonly maxTreeInstances = 10000;
  
  // Temporary objects for matrix calculations
  private dummy = new THREE.Object3D();
  
  // Performance optimization
  private lastCameraPosition = new THREE.Vector3();
  private readonly updateThreshold = 0.5; // Only update if camera moved this distance

  constructor(scene: THREE.Scene, camera: THREE.Camera, assetLoader: AssetLoader) {
    this.scene = scene;
    this.camera = camera;
    this.assetLoader = assetLoader;
  }

  async init(): Promise<void> {
    console.log('🌐 Initializing Global Billboard System...');
    
    // Create global grass instances
    await this.initializeGrassInstances();
    
    // Create global tree instances
    await this.initializeTreeInstances();
    
    console.log(`✅ Global Billboard System ready: ${this.maxGrassInstances} grass slots, ${this.maxTreeInstances} tree slots`);
  }

  private async initializeGrassInstances(): Promise<void> {
    const grassTexture = this.assetLoader.getTexture('grass');
    if (!grassTexture) {
      console.warn('❌ Grass texture not found for global billboard system');
      return;
    }

    // Create geometry and material
    const geometry = new THREE.PlaneGeometry(2, 3);
    const material = PixelPerfectUtils.createPixelPerfectMaterial(grassTexture, true);
    
    // Create the global instanced mesh
    this.grassInstances = new THREE.InstancedMesh(geometry, material, this.maxGrassInstances);
    this.grassInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grassInstances.castShadow = true;
    this.grassInstances.frustumCulled = false; // Prevent culling issues with large world
    this.grassInstances.count = 0; // Start with no visible instances
    this.grassInstances.userData.type = 'global_grass';
    
    this.scene.add(this.grassInstances);
    console.log(`🌱 Global grass instanced mesh created: ${this.maxGrassInstances} max instances`);
  }

  private async initializeTreeInstances(): Promise<void> {
    const treeTexture = this.assetLoader.getTexture('tree');
    if (!treeTexture) {
      console.warn('❌ Tree texture not found for global billboard system');
      return;
    }

    // Create geometry and material - BIGGER TREES
    const geometry = new THREE.PlaneGeometry(12, 18); // 3x bigger trees
    const material = PixelPerfectUtils.createPixelPerfectMaterial(treeTexture, true);
    
    // Create the global instanced mesh
    this.treeInstances = new THREE.InstancedMesh(geometry, material, this.maxTreeInstances);
    this.treeInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.treeInstances.castShadow = true;
    this.treeInstances.frustumCulled = false; // Prevent culling issues with large world
    this.treeInstances.count = 0; // Start with no visible instances
    this.treeInstances.userData.type = 'global_trees';
    
    this.scene.add(this.treeInstances);
    console.log(`🌳 Global tree instanced mesh created: ${this.maxTreeInstances} max instances`);
  }

  update(deltaTime: number): void {
    // Get camera position
    const cameraPosition = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPosition);
    
    // Only update if camera moved significantly
    if (cameraPosition.distanceTo(this.lastCameraPosition) > this.updateThreshold) {
      this.updateAllBillboards(cameraPosition);
      this.lastCameraPosition.copy(cameraPosition);
    }
  }

  dispose(): void {
    // Clean up global instanced meshes
    if (this.grassInstances) {
      this.scene.remove(this.grassInstances);
      this.grassInstances.dispose();
    }
    
    if (this.treeInstances) {
      this.scene.remove(this.treeInstances);
      this.treeInstances.dispose();
    }
    
    // Clear tracking data
    this.chunkInstances.clear();
    this.freeGrassSlots.length = 0;
    this.freeTreeSlots.length = 0;
    
    console.log('🧹 Global Billboard System disposed');
  }

  /**
   * Add billboard instances for a specific chunk
   */
  addChunkInstances(chunkKey: string, grassInstances: BillboardInstance[], treeInstances: BillboardInstance[]): void {
    // Initialize chunk tracking if not exists
    if (!this.chunkInstances.has(chunkKey)) {
      this.chunkInstances.set(chunkKey, new Map());
    }
    
    const chunkData = this.chunkInstances.get(chunkKey)!;
    
    // Add grass instances
    if (grassInstances.length > 0) {
      const grassAllocation = this.allocateInstances(grassInstances, 'grass');
      if (grassAllocation) {
        chunkData.set('grass', grassAllocation);
        this.updateInstanceMatrices('grass', grassAllocation);
      }
    }
    
    // Add tree instances
    if (treeInstances.length > 0) {
      const treeAllocation = this.allocateInstances(treeInstances, 'tree');
      if (treeAllocation) {
        chunkData.set('tree', treeAllocation);
        this.updateInstanceMatrices('tree', treeAllocation);
      }
    }
    
    console.log(`📍 Added instances for chunk ${chunkKey}: ${grassInstances.length} grass, ${treeInstances.length} trees`);
  }

  /**
   * Remove billboard instances for a specific chunk
   */
  removeChunkInstances(chunkKey: string): void {
    const chunkData = this.chunkInstances.get(chunkKey);
    if (!chunkData) return;
    
    // Deallocate grass instances
    const grassData = chunkData.get('grass');
    if (grassData) {
      this.deallocateInstances(grassData, 'grass');
    }
    
    // Deallocate tree instances
    const treeData = chunkData.get('tree');
    if (treeData) {
      this.deallocateInstances(treeData, 'tree');
    }
    
    // Remove chunk tracking
    this.chunkInstances.delete(chunkKey);
    
    console.log(`🗑️ Removed instances for chunk ${chunkKey}`);
  }

  private allocateInstances(instances: BillboardInstance[], type: 'grass' | 'tree'): ChunkInstances | null {
    const freeSlots = type === 'grass' ? this.freeGrassSlots : this.freeTreeSlots;
    const maxInstances = type === 'grass' ? this.maxGrassInstances : this.maxTreeInstances;
    const allocationIndex = type === 'grass' ? this.grassAllocationIndex : this.treeAllocationIndex;
    const instanceMesh = type === 'grass' ? this.grassInstances : this.treeInstances;
    
    if (!instanceMesh) return null;
    
    const requiredSlots = instances.length;
    let startIndex: number;
    
    // Try to use free slots first
    if (freeSlots.length >= requiredSlots) {
      startIndex = freeSlots.splice(0, requiredSlots)[0];
      // Sort remaining slots to keep them organized
      freeSlots.sort((a, b) => a - b);
    } else {
      // Check if we have enough space at the end
      if (allocationIndex + requiredSlots > maxInstances) {
        console.warn(`⚠️ Not enough ${type} instances available: need ${requiredSlots}, have ${maxInstances - allocationIndex}`);
        return null;
      }
      
      startIndex = allocationIndex;
      
      // Update allocation index
      if (type === 'grass') {
        this.grassAllocationIndex += requiredSlots;
      } else {
        this.treeAllocationIndex += requiredSlots;
      }
    }
    
    // Update visible count
    instanceMesh.count = Math.max(instanceMesh.count, startIndex + requiredSlots);
    
    return {
      start: startIndex,
      count: requiredSlots,
      instances: [...instances] // Clone the instances array
    };
  }

  private deallocateInstances(allocation: ChunkInstances, type: 'grass' | 'tree'): void {
    const freeSlots = type === 'grass' ? this.freeGrassSlots : this.freeTreeSlots;
    
    // Add slots back to free list
    for (let i = 0; i < allocation.count; i++) {
      freeSlots.push(allocation.start + i);
    }
    
    // Sort free slots for efficient reuse
    freeSlots.sort((a, b) => a - b);
    
    // Hide the instances by setting scale to zero
    const instanceMesh = type === 'grass' ? this.grassInstances : this.treeInstances;
    if (instanceMesh) {
      for (let i = 0; i < allocation.count; i++) {
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        instanceMesh.setMatrixAt(allocation.start + i, this.dummy.matrix);
      }
      instanceMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateInstanceMatrices(type: 'grass' | 'tree', allocation: ChunkInstances): void {
    const instanceMesh = type === 'grass' ? this.grassInstances : this.treeInstances;
    if (!instanceMesh) return;
    
    for (let i = 0; i < allocation.count; i++) {
      const instance = allocation.instances[i];
      const matrixIndex = allocation.start + i;
      
      this.dummy.position.copy(instance.position);
      this.dummy.rotation.set(0, instance.rotation, 0);
      this.dummy.scale.copy(instance.scale);
      this.dummy.updateMatrix();
      
      instanceMesh.setMatrixAt(matrixIndex, this.dummy.matrix);
    }
    
    instanceMesh.instanceMatrix.needsUpdate = true;
  }

  private updateAllBillboards(cameraPosition: THREE.Vector3): void {
    // Get camera frustum for culling
    const frustum = new THREE.Frustum();
    const cameraMatrix = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(cameraMatrix);
    
    // Update only visible chunk instances
    this.chunkInstances.forEach((chunkData, chunkKey) => {
      // Parse chunk position for frustum check
      const [chunkX, chunkZ] = chunkKey.split(',').map(Number);
      const chunkCenter = new THREE.Vector3(
        chunkX * 64 + 32, // Assuming chunk size 64
        0,
        chunkZ * 64 + 32
      );
      
      // Check if chunk is in frustum (with some padding)
      const chunkSphere = new THREE.Sphere(chunkCenter, 100); // Radius covers chunk + tall objects
      if (!frustum.intersectsSphere(chunkSphere)) {
        return; // Skip chunks outside frustum
      }
      
      // Update grass instances
      const grassData = chunkData.get('grass');
      if (grassData) {
        this.updateBillboardRotations(grassData, cameraPosition, 'grass');
      }
      
      // Update tree instances
      const treeData = chunkData.get('tree');
      if (treeData) {
        this.updateBillboardRotations(treeData, cameraPosition, 'tree');
      }
    });
    
    // Mark matrices for update
    if (this.grassInstances) {
      this.grassInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.treeInstances) {
      this.treeInstances.instanceMatrix.needsUpdate = true;
    }
  }

  private updateBillboardRotations(allocation: ChunkInstances, cameraPosition: THREE.Vector3, type: 'grass' | 'tree'): void {
    const instanceMesh = type === 'grass' ? this.grassInstances : this.treeInstances;
    if (!instanceMesh) return;
    
    // Create frustum for per-instance culling (optional, for very dense scenes)
    const frustum = new THREE.Frustum();
    const cameraMatrix = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(cameraMatrix);
    
    for (let i = 0; i < allocation.count; i++) {
      const instance = allocation.instances[i];
      const matrixIndex = allocation.start + i;
      
      // Optional: Per-instance frustum culling for very dense scenes
      const instanceSphere = new THREE.Sphere(instance.position, 10);
      if (!frustum.intersectsSphere(instanceSphere)) {
        continue; // Skip instances outside frustum
      }
      
      // Calculate rotation to face camera (Y-axis only for vertical billboards)
      const direction = new THREE.Vector3()
        .subVectors(cameraPosition, instance.position);
      direction.y = 0; // Keep billboards vertical
      direction.normalize();
      
      const targetRotation = Math.atan2(direction.x, direction.z);
      
      // Only update if rotation changed significantly
      if (Math.abs(targetRotation - instance.rotation) > 0.1) {
        instance.rotation = targetRotation;
        
        this.dummy.position.copy(instance.position);
        this.dummy.rotation.set(0, instance.rotation, 0);
        this.dummy.scale.copy(instance.scale);
        this.dummy.updateMatrix();
        
        instanceMesh.setMatrixAt(matrixIndex, this.dummy.matrix);
      }
    }
  }

  /**
   * Get total number of active instances by type
   */
  getInstanceCount(type: 'grass' | 'tree'): number {
    const instanceMesh = type === 'grass' ? this.grassInstances : this.treeInstances;
    return instanceMesh ? instanceMesh.count : 0;
  }

  /**
   * Get debug information about the system
   */
  getDebugInfo(): { grassUsed: number, treeUsed: number, chunksTracked: number } {
    return {
      grassUsed: this.grassAllocationIndex - this.freeGrassSlots.length,
      treeUsed: this.treeAllocationIndex - this.freeTreeSlots.length,
      chunksTracked: this.chunkInstances.size
    };
  }
}