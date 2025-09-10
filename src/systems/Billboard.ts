import * as THREE from 'three';
import { GameSystem, BillboardInstance } from '../types';
import { PixelPerfectUtils } from '../utils/PixelPerfect';

export class BillboardSystem implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private instancedMeshes: Map<string, THREE.InstancedMesh> = new Map();
  private instances: Map<string, BillboardInstance[]> = new Map();
  private materials: Map<string, THREE.Material> = new Map();
  private dummy = new THREE.Object3D(); // Dummy object for matrix calculations

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
  }

  async init(): Promise<void> {
    // Billboard system is ready to create instances
  }

  private frameCount = 0;
  
  update(deltaTime: number): void {
    // Update billboard rotations every frame for smooth billboarding
    this.updateBillboardRotations();
  }

  dispose(): void {
    this.instancedMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.dispose();
    });
    
    this.materials.forEach(material => {
      material.dispose();
    });

    this.instancedMeshes.clear();
    this.instances.clear();
    this.materials.clear();
  }

  createBillboardType(
    name: string, 
    texture: THREE.Texture, 
    maxInstances: number,
    width = 1,
    height = 1
  ): void {
    // Create geometry for billboard
    const geometry = new THREE.PlaneGeometry(width, height);
    
    // Create pixel-perfect material
    const material = PixelPerfectUtils.createPixelPerfectMaterial(texture);
    this.materials.set(name, material);

    // Create instanced mesh
    const instancedMesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.castShadow = true;
    instancedMesh.frustumCulled = false; // Prevent culling issues
    instancedMesh.count = 0; // Start with 0 visible instances
    
    this.instancedMeshes.set(name, instancedMesh);
    this.instances.set(name, []);
    this.scene.add(instancedMesh);

    console.log(`Created billboard type: ${name} (max: ${maxInstances} instances)`);
  }

  addInstance(type: string, instance: BillboardInstance): number {
    const instances = this.instances.get(type);
    const mesh = this.instancedMeshes.get(type);
    
    if (!instances || !mesh) {
      console.warn(`Billboard type '${type}' not found`);
      return -1;
    }

    if (instances.length >= (mesh as any).maxInstancedCount) {
      console.warn(`Maximum instances reached for type '${type}' (${instances.length}/${(mesh as any).maxInstancedCount})`);
      return -1;
    }

    const index = instances.length;
    instances.push(instance);

    // Update instance matrix
    this.updateInstanceMatrix(type, index, instance);
    
    // Update visible count
    mesh.count = instances.length;

    return index;
  }

  updateInstance(type: string, index: number, instance: BillboardInstance): void {
    const instances = this.instances.get(type);
    
    if (!instances || index < 0 || index >= instances.length) {
      return;
    }

    instances[index] = instance;
    this.updateInstanceMatrix(type, index, instance);
  }

  private updateInstanceMatrix(type: string, index: number, instance: BillboardInstance): void {
    const mesh = this.instancedMeshes.get(type);
    if (!mesh) return;

    // Use dummy object for matrix calculations (Three.js best practice)
    this.dummy.position.copy(instance.position);
    this.dummy.rotation.set(0, instance.rotation, 0);
    this.dummy.scale.copy(instance.scale);
    this.dummy.updateMatrix();

    mesh.setMatrixAt(index, this.dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  private updateBillboardRotations(): void {
    // Get camera position for better billboard calculation
    const cameraPosition = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPosition);

    // Update all billboard instances to face camera
    this.instances.forEach((instances, type) => {
      const mesh = this.instancedMeshes.get(type);
      if (!mesh || instances.length === 0) return;
      
      instances.forEach((instance, index) => {
        // Always face camera - no rotation optimization for now to prevent disappearing
        const direction = new THREE.Vector3()
          .subVectors(cameraPosition, instance.position);
        direction.y = 0; // Keep billboards vertical
        direction.normalize();
        
        // Calculate Y-axis rotation to face camera
        const targetRotation = Math.atan2(direction.x, direction.z);
        instance.rotation = targetRotation;
        
        this.updateInstanceMatrix(type, index, instance);
      });
      
      // Mark matrix for update once per type
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  getInstance(type: string, index: number): BillboardInstance | undefined {
    const instances = this.instances.get(type);
    return instances?.[index];
  }

  getInstanceCount(type: string): number {
    return this.instances.get(type)?.length || 0;
  }

  getAllInstances(type: string): BillboardInstance[] {
    return this.instances.get(type) || [];
  }

  getBillboardTypes(): string[] {
    return Array.from(this.instancedMeshes.keys());
  }
}