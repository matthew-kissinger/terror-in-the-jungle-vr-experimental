import * as THREE from 'three';
import { GameSystem, BillboardInstance } from '../../../types';
import { AssetLoader } from '../../assets/AssetLoader';
import { GPUBillboardSystem } from './GPUBillboardSystem';
import { BillboardVegetationTypes } from './BillboardVegetationTypes';
import { BillboardInstanceManager } from './BillboardInstanceManager';
import { BillboardRenderer } from './BillboardRenderer';

export class GlobalBillboardSystem implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private assetLoader: AssetLoader;

  // GPU system for vegetation (performance critical)
  private gpuVegetationSystem: GPUBillboardSystem;

  // CPU system kept for NPCs (AI integration)
  private vegetationTypes: BillboardVegetationTypes;
  private instanceManager!: BillboardInstanceManager;
  private renderer!: BillboardRenderer;

  // Toggle to use GPU for vegetation
  private useGPUForVegetation = true;

  constructor(scene: THREE.Scene, camera: THREE.Camera, assetLoader: AssetLoader) {
    this.scene = scene;
    this.camera = camera;
    this.assetLoader = assetLoader;

    // Initialize GPU system for vegetation
    this.gpuVegetationSystem = new GPUBillboardSystem(scene, assetLoader);

    // Keep CPU system for potential NPC use
    this.vegetationTypes = new BillboardVegetationTypes(scene, assetLoader);
  }

  async init(): Promise<void> {
    if (this.useGPUForVegetation) {
      // Use GPU for vegetation (high performance)
      await this.gpuVegetationSystem.initialize();
      console.log('✅ Using GPU billboard system for vegetation');
    } else {
      // Fallback to CPU system if needed
      const meshes = await this.vegetationTypes.initializeAll();
      this.instanceManager = new BillboardInstanceManager(meshes);
      this.renderer = new BillboardRenderer(this.camera, meshes, this.instanceManager);
      console.log('✅ Using CPU billboard system');
    }
  }

  update(deltaTime: number): void {
    if (this.useGPUForVegetation) {
      this.gpuVegetationSystem.update(this.camera, deltaTime);
    } else if (this.renderer) {
      this.renderer.update(deltaTime);
    }
  }

  dispose(): void {
    if (this.useGPUForVegetation) {
      this.gpuVegetationSystem.dispose();
    } else if (this.vegetationTypes) {
      this.vegetationTypes.dispose();
    }
    console.log('🧹 Global Billboard System disposed');
  }

  /**
   * Add billboard instances for a specific chunk
   */
  addChunkInstances(
    chunkKey: string,
    fernInstances?: BillboardInstance[],
    elephantEarInstances?: BillboardInstance[],
    fanPalmInstances?: BillboardInstance[],
    coconutInstances?: BillboardInstance[],
    arecaInstances?: BillboardInstance[],
    dipterocarpInstances?: BillboardInstance[],
    banyanInstances?: BillboardInstance[]
  ): void {
    if (this.useGPUForVegetation) {
      // Convert to GPU format and add
      const types: Array<[string, BillboardInstance[] | undefined]> = [
        ['fern', fernInstances],
        ['elephantEar', elephantEarInstances],
        ['fanPalm', fanPalmInstances],
        ['coconut', coconutInstances],
        ['areca', arecaInstances],
        ['dipterocarp', dipterocarpInstances],
        ['banyan', banyanInstances]
      ];

      let totalAdded = 0;
      for (const [type, instances] of types) {
        if (instances && instances.length > 0) {
          this.gpuVegetationSystem.addChunkInstances(chunkKey, type, instances);
          totalAdded += instances.length;
        }
      }

      if (totalAdded > 0) {
        console.log(`🌿 GPU: Added ${totalAdded} vegetation instances for chunk ${chunkKey}`);
      }
    } else if (this.instanceManager) {
      this.instanceManager.addChunkInstances(
        chunkKey,
        fernInstances,
        elephantEarInstances,
        fanPalmInstances,
        coconutInstances,
        arecaInstances,
        dipterocarpInstances,
        banyanInstances
      );
    }
  }

  /**
   * Remove billboard instances for a specific chunk
   */
  removeChunkInstances(chunkKey: string): void {
    if (this.useGPUForVegetation) {
      this.gpuVegetationSystem.removeChunkInstances(chunkKey);
    } else if (this.instanceManager) {
      this.instanceManager.removeChunkInstances(chunkKey);
    }
  }

  /**
   * Get total number of active instances by type
   */
  getInstanceCount(type: 'fern' | 'elephantEar' | 'fanPalm' | 'coconut' | 'areca' | 'dipterocarp' | 'banyan'): number {
    if (this.instanceManager) {
      return this.instanceManager.getInstanceCount(type);
    }
    return 0;
  }

  /**
   * Get debug information about the system
   */
  getDebugInfo(): { [key: string]: number } {
    if (this.useGPUForVegetation) {
      return this.gpuVegetationSystem.getDebugInfo();
    } else if (this.instanceManager) {
      return this.instanceManager.getDebugInfo();
    }
    return { chunksTracked: 0 };
  }
}