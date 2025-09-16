import * as THREE from 'three';
import { GameSystem, BillboardInstance } from '../../../types';
import { AssetLoader } from '../../assets/AssetLoader';
import { BillboardVegetationTypes } from './BillboardVegetationTypes';
import { BillboardInstanceManager } from './BillboardInstanceManager';
import { BillboardRenderer } from './BillboardRenderer';

export class GlobalBillboardSystem implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private assetLoader: AssetLoader;

  private vegetationTypes: BillboardVegetationTypes;
  private instanceManager!: BillboardInstanceManager;
  private renderer!: BillboardRenderer;

  constructor(scene: THREE.Scene, camera: THREE.Camera, assetLoader: AssetLoader) {
    this.scene = scene;
    this.camera = camera;
    this.assetLoader = assetLoader;

    this.vegetationTypes = new BillboardVegetationTypes(scene, assetLoader);
  }

  async init(): Promise<void> {
    // Initialize vegetation meshes
    const meshes = await this.vegetationTypes.initializeAll();

    // Create instance manager with the meshes
    this.instanceManager = new BillboardInstanceManager(meshes);

    // Create renderer
    this.renderer = new BillboardRenderer(this.camera, meshes, this.instanceManager);
  }

  update(deltaTime: number): void {
    if (this.renderer) {
      this.renderer.update(deltaTime);
    }
  }

  dispose(): void {
    if (this.vegetationTypes) {
      this.vegetationTypes.dispose();
    }
    console.log('🧹 Global Billboard System disposed');
  }

  /**
   * Add billboard instances for a specific chunk
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
    if (this.instanceManager) {
      this.instanceManager.addChunkInstances(
        chunkKey,
        grassInstances,
        treeInstances,
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
    if (this.instanceManager) {
      this.instanceManager.removeChunkInstances(chunkKey);
    }
  }

  /**
   * Get total number of active instances by type
   */
  getInstanceCount(type: 'grass' | 'tree'): number {
    if (this.instanceManager) {
      return this.instanceManager.getInstanceCount(type);
    }
    return 0;
  }

  /**
   * Get debug information about the system
   */
  getDebugInfo(): { grassUsed: number, treeUsed: number, chunksTracked: number } {
    if (this.instanceManager) {
      const debugInfo = this.instanceManager.getDebugInfo();
      return {
        grassUsed: debugInfo.grassUsed || 0,
        treeUsed: debugInfo.treeUsed || 0,
        chunksTracked: debugInfo.chunksTracked || 0
      };
    }
    return { grassUsed: 0, treeUsed: 0, chunksTracked: 0 };
  }
}