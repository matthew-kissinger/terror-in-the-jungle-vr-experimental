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
  private mushroomInstances?: THREE.InstancedMesh;
  private wheatInstances?: THREE.InstancedMesh;
  private tree1Instances?: THREE.InstancedMesh;
  private tree2Instances?: THREE.InstancedMesh;
  private tree3Instances?: THREE.InstancedMesh;
  
  // Chunk tracking
  private chunkInstances: Map<string, Map<string, ChunkInstances>> = new Map();
  
  // Instance allocation tracking
  private grassAllocationIndex = 0;
  private treeAllocationIndex = 0;
  private mushroomAllocationIndex = 0;
  private wheatAllocationIndex = 0;
  private tree1AllocationIndex = 0;
  private tree2AllocationIndex = 0;
  private tree3AllocationIndex = 0;
  private freeGrassSlots: number[] = [];
  private freeTreeSlots: number[] = [];
  private freeMushroomSlots: number[] = [];
  private freeWheatSlots: number[] = [];
  private freeTree1Slots: number[] = [];
  private freeTree2Slots: number[] = [];
  private freeTree3Slots: number[] = [];
  
  // Configuration
  private readonly maxGrassInstances = 100000;
  private readonly maxTreeInstances = 10000;
  private readonly maxMushroomInstances = 50000;
  private readonly maxWheatInstances = 50000;
  private readonly maxTree1Instances = 5000;
  private readonly maxTree2Instances = 5000;
  private readonly maxTree3Instances = 5000;
  
  // Temporary objects for matrix calculations
  private dummy = new THREE.Object3D();
  
  // Performance optimization
  private lastCameraPosition = new THREE.Vector3();
  private readonly updateThreshold = 0.1; // Lower threshold for smoother updates

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
    
    // Create mushroom instances
    await this.initializeMushroomInstances();
    
    // Create wheat instances
    await this.initializeWheatInstances();
    
    // Create tree variant instances
    await this.initializeTreeVariantInstances();
    
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

  private async initializeMushroomInstances(): Promise<void> {
    const mushroomTexture = this.assetLoader.getTexture('mushroom');
    if (!mushroomTexture) {
      console.warn('❌ Mushroom texture not found for global billboard system');
      return;
    }

    const geometry = new THREE.PlaneGeometry(2, 2); // Bigger mushroom sprites
    const material = PixelPerfectUtils.createPixelPerfectMaterial(mushroomTexture, true);
    
    this.mushroomInstances = new THREE.InstancedMesh(geometry, material, this.maxMushroomInstances);
    this.mushroomInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mushroomInstances.frustumCulled = false;
    this.mushroomInstances.count = 0;
    this.mushroomInstances.userData.type = 'global_mushrooms';
    
    this.scene.add(this.mushroomInstances);
    console.log(`🍄 Global mushroom instanced mesh created: ${this.maxMushroomInstances} max instances`);
  }

  private async initializeWheatInstances(): Promise<void> {
    const wheatTexture = this.assetLoader.getTexture('wheat');
    if (!wheatTexture) {
      console.warn('❌ Wheat texture not found for global billboard system');
      return;
    }

    const geometry = new THREE.PlaneGeometry(2, 3);
    const material = PixelPerfectUtils.createPixelPerfectMaterial(wheatTexture, true);
    
    this.wheatInstances = new THREE.InstancedMesh(geometry, material, this.maxWheatInstances);
    this.wheatInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wheatInstances.frustumCulled = false;
    this.wheatInstances.count = 0;
    this.wheatInstances.userData.type = 'global_wheat';
    
    this.scene.add(this.wheatInstances);
    console.log(`🌾 Global wheat instanced mesh created: ${this.maxWheatInstances} max instances`);
  }

  private async initializeTreeVariantInstances(): Promise<void> {
    // Tree1 (Pine)
    const tree1Texture = this.assetLoader.getTexture('tree1');
    if (tree1Texture) {
      const geometry = new THREE.PlaneGeometry(14, 20);
      const material = PixelPerfectUtils.createPixelPerfectMaterial(tree1Texture, true);
      
      this.tree1Instances = new THREE.InstancedMesh(geometry, material, this.maxTree1Instances);
      this.tree1Instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.tree1Instances.castShadow = true;
      this.tree1Instances.frustumCulled = false;
      this.tree1Instances.count = 0;
      this.tree1Instances.userData.type = 'global_tree1';
      this.scene.add(this.tree1Instances);
      console.log(`🌲 Global pine tree instanced mesh created: ${this.maxTree1Instances} max instances`);
    }
    
    // Tree2 (Oak)
    const tree2Texture = this.assetLoader.getTexture('tree2');
    if (tree2Texture) {
      const geometry = new THREE.PlaneGeometry(16, 18);
      const material = PixelPerfectUtils.createPixelPerfectMaterial(tree2Texture, true);
      
      this.tree2Instances = new THREE.InstancedMesh(geometry, material, this.maxTree2Instances);
      this.tree2Instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.tree2Instances.castShadow = true;
      this.tree2Instances.frustumCulled = false;
      this.tree2Instances.count = 0;
      this.tree2Instances.userData.type = 'global_tree2';
      this.scene.add(this.tree2Instances);
      console.log(`🌳 Global oak tree instanced mesh created: ${this.maxTree2Instances} max instances`);
    }
    
    // Tree3 (Birch)
    const tree3Texture = this.assetLoader.getTexture('tree3');
    if (tree3Texture) {
      const geometry = new THREE.PlaneGeometry(12, 19);
      const material = PixelPerfectUtils.createPixelPerfectMaterial(tree3Texture, true);
      
      this.tree3Instances = new THREE.InstancedMesh(geometry, material, this.maxTree3Instances);
      this.tree3Instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.tree3Instances.castShadow = true;
      this.tree3Instances.frustumCulled = false;
      this.tree3Instances.count = 0;
      this.tree3Instances.userData.type = 'global_tree3';
      this.scene.add(this.tree3Instances);
      console.log(`🌴 Global birch tree instanced mesh created: ${this.maxTree3Instances} max instances`);
    }
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
  addChunkInstances(
    chunkKey: string, 
    grassInstances: BillboardInstance[], 
    treeInstances: BillboardInstance[],
    mushroomInstances?: BillboardInstance[],
    wheatInstances?: BillboardInstance[],
    tree1Instances?: BillboardInstance[],
    tree2Instances?: BillboardInstance[],
    tree3Instances?: BillboardInstance[]
  ): void {
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
    
    // Add mushroom instances
    if (mushroomInstances && mushroomInstances.length > 0) {
      const mushroomAllocation = this.allocateInstances(mushroomInstances, 'mushroom');
      if (mushroomAllocation) {
        chunkData.set('mushroom', mushroomAllocation);
        this.updateInstanceMatrices('mushroom', mushroomAllocation);
      }
    }
    
    // Add wheat instances
    if (wheatInstances && wheatInstances.length > 0) {
      const wheatAllocation = this.allocateInstances(wheatInstances, 'wheat');
      if (wheatAllocation) {
        chunkData.set('wheat', wheatAllocation);
        this.updateInstanceMatrices('wheat', wheatAllocation);
      }
    }
    
    // Add tree1 instances
    if (tree1Instances && tree1Instances.length > 0) {
      const tree1Allocation = this.allocateInstances(tree1Instances, 'tree1');
      if (tree1Allocation) {
        chunkData.set('tree1', tree1Allocation);
        this.updateInstanceMatrices('tree1', tree1Allocation);
      }
    }
    
    // Add tree2 instances
    if (tree2Instances && tree2Instances.length > 0) {
      const tree2Allocation = this.allocateInstances(tree2Instances, 'tree2');
      if (tree2Allocation) {
        chunkData.set('tree2', tree2Allocation);
        this.updateInstanceMatrices('tree2', tree2Allocation);
      }
    }
    
    // Add tree3 instances
    if (tree3Instances && tree3Instances.length > 0) {
      const tree3Allocation = this.allocateInstances(tree3Instances, 'tree3');
      if (tree3Allocation) {
        chunkData.set('tree3', tree3Allocation);
        this.updateInstanceMatrices('tree3', tree3Allocation);
      }
    }
    
    console.log(`📍 Added instances for chunk ${chunkKey}: ${grassInstances.length} grass, ${treeInstances.length + (tree1Instances?.length || 0) + (tree2Instances?.length || 0) + (tree3Instances?.length || 0)} trees, ${mushroomInstances?.length || 0} mushrooms, ${wheatInstances?.length || 0} wheat`);
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

  private allocateInstances(instances: BillboardInstance[], type: 'grass' | 'tree' | 'mushroom' | 'wheat' | 'tree1' | 'tree2' | 'tree3'): ChunkInstances | null {
    let freeSlots: number[];
    let maxInstances: number;
    let allocationIndex: number;
    let instanceMesh: THREE.InstancedMesh | undefined;
    
    switch(type) {
      case 'grass':
        freeSlots = this.freeGrassSlots;
        maxInstances = this.maxGrassInstances;
        allocationIndex = this.grassAllocationIndex;
        instanceMesh = this.grassInstances;
        break;
      case 'tree':
        freeSlots = this.freeTreeSlots;
        maxInstances = this.maxTreeInstances;
        allocationIndex = this.treeAllocationIndex;
        instanceMesh = this.treeInstances;
        break;
      case 'mushroom':
        freeSlots = this.freeMushroomSlots;
        maxInstances = this.maxMushroomInstances;
        allocationIndex = this.mushroomAllocationIndex;
        instanceMesh = this.mushroomInstances;
        break;
      case 'wheat':
        freeSlots = this.freeWheatSlots;
        maxInstances = this.maxWheatInstances;
        allocationIndex = this.wheatAllocationIndex;
        instanceMesh = this.wheatInstances;
        break;
      case 'tree1':
        freeSlots = this.freeTree1Slots;
        maxInstances = this.maxTree1Instances;
        allocationIndex = this.tree1AllocationIndex;
        instanceMesh = this.tree1Instances;
        break;
      case 'tree2':
        freeSlots = this.freeTree2Slots;
        maxInstances = this.maxTree2Instances;
        allocationIndex = this.tree2AllocationIndex;
        instanceMesh = this.tree2Instances;
        break;
      case 'tree3':
        freeSlots = this.freeTree3Slots;
        maxInstances = this.maxTree3Instances;
        allocationIndex = this.tree3AllocationIndex;
        instanceMesh = this.tree3Instances;
        break;
      default:
        return null;
    }
    
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
      switch(type) {
        case 'grass':
          this.grassAllocationIndex += requiredSlots;
          break;
        case 'tree':
          this.treeAllocationIndex += requiredSlots;
          break;
        case 'mushroom':
          this.mushroomAllocationIndex += requiredSlots;
          break;
        case 'wheat':
          this.wheatAllocationIndex += requiredSlots;
          break;
        case 'tree1':
          this.tree1AllocationIndex += requiredSlots;
          break;
        case 'tree2':
          this.tree2AllocationIndex += requiredSlots;
          break;
        case 'tree3':
          this.tree3AllocationIndex += requiredSlots;
          break;
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

  private updateInstanceMatrices(type: 'grass' | 'tree' | 'mushroom' | 'wheat' | 'tree1' | 'tree2' | 'tree3', allocation: ChunkInstances): void {
    let instanceMesh: THREE.InstancedMesh | undefined;
    
    switch(type) {
      case 'grass': instanceMesh = this.grassInstances; break;
      case 'tree': instanceMesh = this.treeInstances; break;
      case 'mushroom': instanceMesh = this.mushroomInstances; break;
      case 'wheat': instanceMesh = this.wheatInstances; break;
      case 'tree1': instanceMesh = this.tree1Instances; break;
      case 'tree2': instanceMesh = this.tree2Instances; break;
      case 'tree3': instanceMesh = this.tree3Instances; break;
    }
    
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
    // Update all chunk instances without frustum culling for now
    // (frustum culling is causing disappearing objects)
    this.chunkInstances.forEach((chunkData, chunkKey) => {
      // Parse chunk position for distance check
      const [chunkX, chunkZ] = chunkKey.split(',').map(Number);
      const chunkCenter = new THREE.Vector3(
        chunkX * 64 + 32, // Assuming chunk size 64
        0,
        chunkZ * 64 + 32
      );
      
      // Only skip very distant chunks
      const distanceToCamera = chunkCenter.distanceTo(cameraPosition);
      if (distanceToCamera > 800) {
        return; // Skip only very distant chunks
      }
      
      // Update all vegetation types
      const grassData = chunkData.get('grass');
      if (grassData) {
        this.updateBillboardRotations(grassData, cameraPosition, 'grass');
      }
      
      const treeData = chunkData.get('tree');
      if (treeData) {
        this.updateBillboardRotations(treeData, cameraPosition, 'tree');
      }
      
      const mushroomData = chunkData.get('mushroom');
      if (mushroomData) {
        this.updateBillboardRotations(mushroomData, cameraPosition, 'mushroom');
      }
      
      const wheatData = chunkData.get('wheat');
      if (wheatData) {
        this.updateBillboardRotations(wheatData, cameraPosition, 'wheat');
      }
      
      const tree1Data = chunkData.get('tree1');
      if (tree1Data) {
        this.updateBillboardRotations(tree1Data, cameraPosition, 'tree1');
      }
      
      const tree2Data = chunkData.get('tree2');
      if (tree2Data) {
        this.updateBillboardRotations(tree2Data, cameraPosition, 'tree2');
      }
      
      const tree3Data = chunkData.get('tree3');
      if (tree3Data) {
        this.updateBillboardRotations(tree3Data, cameraPosition, 'tree3');
      }
    });
    
    // Mark all matrices for update
    if (this.grassInstances) {
      this.grassInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.treeInstances) {
      this.treeInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.mushroomInstances) {
      this.mushroomInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.wheatInstances) {
      this.wheatInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.tree1Instances) {
      this.tree1Instances.instanceMatrix.needsUpdate = true;
    }
    if (this.tree2Instances) {
      this.tree2Instances.instanceMatrix.needsUpdate = true;
    }
    if (this.tree3Instances) {
      this.tree3Instances.instanceMatrix.needsUpdate = true;
    }
  }

  private updateBillboardRotations(allocation: ChunkInstances, cameraPosition: THREE.Vector3, type: 'grass' | 'tree' | 'mushroom' | 'wheat' | 'tree1' | 'tree2' | 'tree3'): void {
    let instanceMesh: THREE.InstancedMesh | undefined;
    
    switch(type) {
      case 'grass': instanceMesh = this.grassInstances; break;
      case 'tree': instanceMesh = this.treeInstances; break;
      case 'mushroom': instanceMesh = this.mushroomInstances; break;
      case 'wheat': instanceMesh = this.wheatInstances; break;
      case 'tree1': instanceMesh = this.tree1Instances; break;
      case 'tree2': instanceMesh = this.tree2Instances; break;
      case 'tree3': instanceMesh = this.tree3Instances; break;
    }
    
    if (!instanceMesh) return;
    
    for (let i = 0; i < allocation.count; i++) {
      const instance = allocation.instances[i];
      const matrixIndex = allocation.start + i;
      
      // Only cull by distance, not frustum (to prevent popping)
      const distanceToCamera = instance.position.distanceTo(cameraPosition);
      if (distanceToCamera > 500) {
        continue; // Skip very distant instances
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