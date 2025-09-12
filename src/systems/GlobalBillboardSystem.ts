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
  
  // Global instanced meshes - Full Jungle System
  // Ground cover (most common)
  private fernInstances?: THREE.InstancedMesh;           // Dense ground cover
  private elephantEarInstances?: THREE.InstancedMesh;    // Sprinkled ground plants
  
  // Mid-level vegetation
  private fanPalmInstances?: THREE.InstancedMesh;        // Near water/varied elevation
  private coconutInstances?: THREE.InstancedMesh;        // Water edge palms
  private arecaInstances?: THREE.InstancedMesh;          // Everywhere mid-size
  
  // Giant canopy trees (rare but huge)
  private dipterocarpInstances?: THREE.InstancedMesh;    // Giant canopy
  private banyanInstances?: THREE.InstancedMesh;         // Giant canopy
  
  // Legacy compatibility
  private grassInstances?: THREE.InstancedMesh;
  private treeInstances?: THREE.InstancedMesh;
  
  // Chunk tracking
  private chunkInstances: Map<string, Map<string, ChunkInstances>> = new Map();
  
  // Instance allocation tracking
  private dipterocarpAllocationIndex = 0;
  private banyanAllocationIndex = 0;
  private coconutAllocationIndex = 0;
  private arecaAllocationIndex = 0;
  private fernAllocationIndex = 0;
  private fanPalmAllocationIndex = 0;
  private elephantEarAllocationIndex = 0;
  private grassAllocationIndex = 0;
  private treeAllocationIndex = 0;
  
  private freeDipterocarpSlots: number[] = [];
  private freeBanyanSlots: number[] = [];
  private freeCoconutSlots: number[] = [];
  private freeArecaSlots: number[] = [];
  private freeFernSlots: number[] = [];
  private freeFanPalmSlots: number[] = [];
  private freeElephantEarSlots: number[] = [];
  private freeGrassSlots: number[] = [];
  private freeTreeSlots: number[] = [];
  
  // Configuration - Proper jungle distribution
  private readonly maxFernInstances = 80000;             // Dense ground cover everywhere
  private readonly maxElephantEarInstances = 15000;      // Sprinkled ground plants
  private readonly maxFanPalmInstances = 10000;          // Mid-level near water
  private readonly maxCoconutInstances = 8000;           // Water edge palms
  private readonly maxArecaInstances = 15000;            // Everywhere mid-size
  private readonly maxDipterocarpInstances = 3000;       // Common giant trees
  private readonly maxBanyanInstances = 3000;            // Common giant trees
  private readonly maxGrassInstances = 10000;            // Legacy (using for ferns)
  private readonly maxTreeInstances = 5000;              // Legacy (using for palms)
  
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
    console.log('🌴 Initializing Terror in the Jungle Billboard System...');
    
    // Initialize ALL jungle foliage with proper textures
    await this.initializeJungleFoliage();
    
    // Also initialize base grass/tree for the system to work
    await this.initializeGrassInstances();
    await this.initializeTreeInstances();
    
    console.log(`✅ Jungle Billboard System ready with all tropical foliage types`);
  }
  
  private async initializeJungleFoliage(): Promise<void> {
    // Ground cover - Dense ferns everywhere
    await this.initializeUndergrowth('Fern', 'fern', this.maxFernInstances, 1.5, 2.0);
    await this.initializeUndergrowth('ElephantEarPlants', 'elephantEar', this.maxElephantEarInstances, 2.5, 3.0);
    
    // Mid-level vegetation
    await this.initializePalm('FanPalmCluster', 'fanPalm', this.maxFanPalmInstances, 3, 4);
    await this.initializePalm('CoconutPalm', 'coconut', this.maxCoconutInstances, 5, 7);
    await this.initializePalm('ArecaPalmCluster', 'areca', this.maxArecaInstances, 4, 6);
    
    // Giant canopy trees - HUGE
    await this.initializeCanopyTree('DipterocarpGiant', 'dipterocarp', this.maxDipterocarpInstances, 15, 20);
    await this.initializeCanopyTree('TwisterBanyan', 'banyan', this.maxBanyanInstances, 14, 18);
  }
  
  private async initializeCanopyTree(textureName: string, instanceName: string, maxInstances: number, width: number, height: number): Promise<void> {
    const texture = this.assetLoader.getTexture(textureName);
    if (!texture) {
      console.warn(`❌ ${textureName} texture not found`);
      return;
    }
    
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = PixelPerfectUtils.createPixelPerfectMaterial(texture, true);
    
    const mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.userData.type = `global_${instanceName}`;
    
    this.scene.add(mesh);
    
    // Store the mesh
    if (instanceName === 'dipterocarp') this.dipterocarpInstances = mesh;
    if (instanceName === 'banyan') this.banyanInstances = mesh;
    
    console.log(`🌳 ${textureName} canopy mesh created: ${maxInstances} max instances`);
  }
  
  private async initializePalm(textureName: string, instanceName: string, maxInstances: number, width: number, height: number): Promise<void> {
    const texture = this.assetLoader.getTexture(textureName);
    if (!texture) {
      console.warn(`❌ ${textureName} texture not found`);
      return;
    }
    
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = PixelPerfectUtils.createPixelPerfectMaterial(texture, true);
    
    const mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.userData.type = `global_${instanceName}`;
    
    this.scene.add(mesh);
    
    // Store the mesh
    if (instanceName === 'coconut') this.coconutInstances = mesh;
    if (instanceName === 'areca') this.arecaInstances = mesh;
    if (instanceName === 'fanPalm') this.fanPalmInstances = mesh;
    
    console.log(`🌴 ${textureName} palm mesh created: ${maxInstances} max instances`);
  }
  
  private async initializeUndergrowth(textureName: string, instanceName: string, maxInstances: number, width: number, height: number): Promise<void> {
    const texture = this.assetLoader.getTexture(textureName);
    if (!texture) {
      console.warn(`❌ ${textureName} texture not found`);
      return;
    }
    
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = PixelPerfectUtils.createPixelPerfectMaterial(texture, true);
    
    const mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.userData.type = `global_${instanceName}`;
    
    this.scene.add(mesh);
    
    // Store the mesh
    if (instanceName === 'fern') this.fernInstances = mesh;
    if (instanceName === 'fanPalm') this.fanPalmInstances = mesh;
    if (instanceName === 'elephantEar') this.elephantEarInstances = mesh;
    
    console.log(`🌿 ${textureName} undergrowth mesh created: ${maxInstances} max instances`);
  }

  private async initializeGrassInstances(): Promise<void> {
    // For now use Fern as the base undergrowth texture
    // TODO: Implement multi-texture system for variety
    const grassTexture = this.assetLoader.getTexture('Fern');
    if (!grassTexture) {
      console.warn('❌ Fern texture not found for global billboard system');
      return;
    }

    // Create geometry and material - varied sizes for undergrowth
    const geometry = new THREE.PlaneGeometry(2.5, 2.5);
    const material = PixelPerfectUtils.createPixelPerfectMaterial(grassTexture, true);
    
    // Create the global instanced mesh
    this.grassInstances = new THREE.InstancedMesh(geometry, material, this.maxGrassInstances);
    this.grassInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grassInstances.castShadow = false; // No shadows for undergrowth
    this.grassInstances.frustumCulled = false; // Prevent culling issues with large world
    this.grassInstances.count = 0; // Start with no visible instances
    this.grassInstances.userData.type = 'global_grass';
    
    this.scene.add(this.grassInstances);
    console.log(`🌿 Jungle undergrowth mesh created: ${this.maxGrassInstances} max instances`);
  }

  private async initializeTreeInstances(): Promise<void> {
    // Use CoconutPalm texture for jungle trees
    const treeTexture = this.assetLoader.getTexture('CoconutPalm');
    if (!treeTexture) {
      console.warn('❌ CoconutPalm texture not found for global billboard system');
      return;
    }

    // Create geometry and material - Jungle palms
    const geometry = new THREE.PlaneGeometry(8, 12); // Palm tree size
    const material = PixelPerfectUtils.createPixelPerfectMaterial(treeTexture, true);
    
    // Create the global instanced mesh
    this.treeInstances = new THREE.InstancedMesh(geometry, material, this.maxTreeInstances);
    this.treeInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.treeInstances.castShadow = true;
    this.treeInstances.frustumCulled = false; // Prevent culling issues with large world
    this.treeInstances.count = 0; // Start with no visible instances
    this.treeInstances.userData.type = 'global_trees';
    
    this.scene.add(this.treeInstances);
    console.log(`🌴 Jungle palm tree mesh created: ${this.maxTreeInstances} max instances`);
  }

  // Removed legacy mushroom and wheat systems

  private async initializeTreeVariantInstances(): Promise<void> {
    // Legacy tree variants removed
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
   * Add billboard instances for a specific chunk - Updated for jungle
   */
  addChunkInstances(
    chunkKey: string, 
    grassInstances: BillboardInstance[], 
    treeInstances: BillboardInstance[],
    fernInstances?: BillboardInstance[],
    elephantEarInstances?: BillboardInstance[],
    fanPalmInstances?: BillboardInstance[],
    coconutInstances?: BillboardInstance[],
    arecaInstances?: BillboardInstance[],
    dipterocarpInstances?: BillboardInstance[],
    banyanInstances?: BillboardInstance[]
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
    
    // Add additional fern instances to existing grass mesh
    if (fernInstances && fernInstances.length > 0) {
      const fernAllocation = this.allocateInstances(fernInstances, 'fern');
      if (fernAllocation) {
        chunkData.set('fern', fernAllocation);
        this.updateInstanceMatrices('fern', fernAllocation);
      }
    }
    
    // Add elephant ear instances
    if (elephantEarInstances && elephantEarInstances.length > 0) {
      const elephantEarAllocation = this.allocateInstances(elephantEarInstances, 'elephantEar');
      if (elephantEarAllocation) {
        chunkData.set('elephantEar', elephantEarAllocation);
        this.updateInstanceMatrices('elephantEar', elephantEarAllocation);
      }
    }
    
    // Add fan palm instances
    if (fanPalmInstances && fanPalmInstances.length > 0) {
      const fanPalmAllocation = this.allocateInstances(fanPalmInstances, 'fanPalm');
      if (fanPalmAllocation) {
        chunkData.set('fanPalm', fanPalmAllocation);
        this.updateInstanceMatrices('fanPalm', fanPalmAllocation);
      }
    }
    
    // Add coconut palm instances
    if (coconutInstances && coconutInstances.length > 0) {
      const coconutAllocation = this.allocateInstances(coconutInstances, 'coconut');
      if (coconutAllocation) {
        chunkData.set('coconut', coconutAllocation);
        this.updateInstanceMatrices('coconut', coconutAllocation);
      }
    }
    
    // Add areca palm instances
    if (arecaInstances && arecaInstances.length > 0) {
      const arecaAllocation = this.allocateInstances(arecaInstances, 'areca');
      if (arecaAllocation) {
        chunkData.set('areca', arecaAllocation);
        this.updateInstanceMatrices('areca', arecaAllocation);
      }
    }
    
    // Add dipterocarp giant tree instances
    if (dipterocarpInstances && dipterocarpInstances.length > 0) {
      const dipterocarpAllocation = this.allocateInstances(dipterocarpInstances, 'dipterocarp');
      if (dipterocarpAllocation) {
        chunkData.set('dipterocarp', dipterocarpAllocation);
        this.updateInstanceMatrices('dipterocarp', dipterocarpAllocation);
      }
    }
    
    // Add banyan giant tree instances
    if (banyanInstances && banyanInstances.length > 0) {
      const banyanAllocation = this.allocateInstances(banyanInstances, 'banyan');
      if (banyanAllocation) {
        chunkData.set('banyan', banyanAllocation);
        this.updateInstanceMatrices('banyan', banyanAllocation);
      }
    }
    
    console.log(`📍 Added instances for chunk ${chunkKey}: ${grassInstances.length} grass, ${treeInstances.length} trees, ${fernInstances?.length || 0} ferns, ${elephantEarInstances?.length || 0} elephant ears, ${fanPalmInstances?.length || 0} fan palms, ${coconutInstances?.length || 0} coconuts, ${arecaInstances?.length || 0} arecas, ${dipterocarpInstances?.length || 0} dipterocarp, ${banyanInstances?.length || 0} banyan`);
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

  private allocateInstances(instances: BillboardInstance[], type: 'grass' | 'tree' | 'fern' | 'elephantEar' | 'fanPalm' | 'coconut' | 'areca' | 'dipterocarp' | 'banyan'): ChunkInstances | null {
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
      case 'fern':
        freeSlots = this.freeFernSlots;
        maxInstances = this.maxFernInstances;
        allocationIndex = this.fernAllocationIndex;
        instanceMesh = this.fernInstances;
        break;
      case 'elephantEar':
        freeSlots = this.freeElephantEarSlots;
        maxInstances = this.maxElephantEarInstances;
        allocationIndex = this.elephantEarAllocationIndex;
        instanceMesh = this.elephantEarInstances;
        break;
      case 'fanPalm':
        freeSlots = this.freeFanPalmSlots;
        maxInstances = this.maxFanPalmInstances;
        allocationIndex = this.fanPalmAllocationIndex;
        instanceMesh = this.fanPalmInstances;
        break;
      case 'coconut':
        freeSlots = this.freeCoconutSlots;
        maxInstances = this.maxCoconutInstances;
        allocationIndex = this.coconutAllocationIndex;
        instanceMesh = this.coconutInstances;
        break;
      case 'areca':
        freeSlots = this.freeArecaSlots;
        maxInstances = this.maxArecaInstances;
        allocationIndex = this.arecaAllocationIndex;
        instanceMesh = this.arecaInstances;
        break;
      case 'dipterocarp':
        freeSlots = this.freeDipterocarpSlots;
        maxInstances = this.maxDipterocarpInstances;
        allocationIndex = this.dipterocarpAllocationIndex;
        instanceMesh = this.dipterocarpInstances;
        break;
      case 'banyan':
        freeSlots = this.freeBanyanSlots;
        maxInstances = this.maxBanyanInstances;
        allocationIndex = this.banyanAllocationIndex;
        instanceMesh = this.banyanInstances;
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
        case 'fern':
          this.fernAllocationIndex += requiredSlots;
          break;
        case 'elephantEar':
          this.elephantEarAllocationIndex += requiredSlots;
          break;
        case 'fanPalm':
          this.fanPalmAllocationIndex += requiredSlots;
          break;
        case 'coconut':
          this.coconutAllocationIndex += requiredSlots;
          break;
        case 'areca':
          this.arecaAllocationIndex += requiredSlots;
          break;
        case 'dipterocarp':
          this.dipterocarpAllocationIndex += requiredSlots;
          break;
        case 'banyan':
          this.banyanAllocationIndex += requiredSlots;
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

  private updateInstanceMatrices(type: 'grass' | 'tree' | 'fern' | 'elephantEar' | 'fanPalm' | 'coconut' | 'areca' | 'dipterocarp' | 'banyan', allocation: ChunkInstances): void {
    let instanceMesh: THREE.InstancedMesh | undefined;
    
    switch(type) {
      case 'grass': instanceMesh = this.grassInstances; break;
      case 'tree': instanceMesh = this.treeInstances; break;
      case 'fern': instanceMesh = this.fernInstances; break;
      case 'elephantEar': instanceMesh = this.elephantEarInstances; break;
      case 'fanPalm': instanceMesh = this.fanPalmInstances; break;
      case 'coconut': instanceMesh = this.coconutInstances; break;
      case 'areca': instanceMesh = this.arecaInstances; break;
      case 'dipterocarp': instanceMesh = this.dipterocarpInstances; break;
      case 'banyan': instanceMesh = this.banyanInstances; break;
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
      if (grassData) this.updateBillboardRotations(grassData, cameraPosition, 'grass');
      
      const treeData = chunkData.get('tree');
      if (treeData) this.updateBillboardRotations(treeData, cameraPosition, 'tree');
      
      const fernData = chunkData.get('fern');
      if (fernData) this.updateBillboardRotations(fernData, cameraPosition, 'fern');
      
      const elephantEarData = chunkData.get('elephantEar');
      if (elephantEarData) this.updateBillboardRotations(elephantEarData, cameraPosition, 'elephantEar');
      
      const fanPalmData = chunkData.get('fanPalm');
      if (fanPalmData) this.updateBillboardRotations(fanPalmData, cameraPosition, 'fanPalm');
      
      const coconutData = chunkData.get('coconut');
      if (coconutData) this.updateBillboardRotations(coconutData, cameraPosition, 'coconut');
      
      const arecaData = chunkData.get('areca');
      if (arecaData) this.updateBillboardRotations(arecaData, cameraPosition, 'areca');
      
      const dipterocarpData = chunkData.get('dipterocarp');
      if (dipterocarpData) this.updateBillboardRotations(dipterocarpData, cameraPosition, 'dipterocarp');
      
      const banyanData = chunkData.get('banyan');
      if (banyanData) this.updateBillboardRotations(banyanData, cameraPosition, 'banyan');
    });
    
    // Mark all matrices for update
    if (this.grassInstances) {
      this.grassInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.treeInstances) {
      this.treeInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.fernInstances) {
      this.fernInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.elephantEarInstances) {
      this.elephantEarInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.fanPalmInstances) {
      this.fanPalmInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.coconutInstances) {
      this.coconutInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.arecaInstances) {
      this.arecaInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.dipterocarpInstances) {
      this.dipterocarpInstances.instanceMatrix.needsUpdate = true;
    }
    if (this.banyanInstances) {
      this.banyanInstances.instanceMatrix.needsUpdate = true;
    }
  }

  private updateBillboardRotations(allocation: ChunkInstances, cameraPosition: THREE.Vector3, type: 'grass' | 'tree' | 'fern' | 'elephantEar' | 'fanPalm' | 'coconut' | 'areca' | 'dipterocarp' | 'banyan'): void {
    let instanceMesh: THREE.InstancedMesh | undefined;
    
    switch(type) {
      case 'grass': instanceMesh = this.grassInstances; break;
      case 'tree': instanceMesh = this.treeInstances; break;
      case 'fern': instanceMesh = this.fernInstances; break;
      case 'elephantEar': instanceMesh = this.elephantEarInstances; break;
      case 'fanPalm': instanceMesh = this.fanPalmInstances; break;
      case 'coconut': instanceMesh = this.coconutInstances; break;
      case 'areca': instanceMesh = this.arecaInstances; break;
      case 'dipterocarp': instanceMesh = this.dipterocarpInstances; break;
      case 'banyan': instanceMesh = this.banyanInstances; break;
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