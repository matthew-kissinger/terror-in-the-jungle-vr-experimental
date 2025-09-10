import * as THREE from 'three';
import { BillboardInstance } from '../types';
import { AssetLoader } from './AssetLoader';
import { NoiseGenerator } from '../utils/NoiseGenerator';
import { PixelPerfectUtils } from '../utils/PixelPerfect';
import { MathUtils } from '../utils/Math';

export class Chunk {
  private scene: THREE.Scene;
  private assetLoader: AssetLoader;
  private chunkX: number;
  private chunkZ: number;
  private size: number;
  private noiseGenerator: NoiseGenerator;
  
  // Terrain
  private terrainMesh?: THREE.Mesh;
  private heightData: Float32Array = new Float32Array(0);
  
  // Vegetation (per-chunk instanced meshes) - REVERTED FOR PERFORMANCE
  private grassMesh?: THREE.InstancedMesh;
  private treeMesh?: THREE.InstancedMesh;
  private enemyMesh?: THREE.InstancedMesh;
  
  // Instance data
  private grassInstances: BillboardInstance[] = [];
  private treeInstances: BillboardInstance[] = [];
  private enemyInstances: BillboardInstance[] = [];
  
  // LOD state
  private currentLOD = 0;
  private isVisible = true;
  private isGenerated = false;
  
  // Position in world coordinates
  private worldPosition: THREE.Vector3;

  constructor(
    scene: THREE.Scene,
    assetLoader: AssetLoader,
    chunkX: number,
    chunkZ: number,
    size: number,
    noiseGenerator: NoiseGenerator
  ) {
    this.scene = scene;
    this.assetLoader = assetLoader;
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.size = size;
    this.noiseGenerator = noiseGenerator;
    
    // Calculate world position (center of chunk)
    this.worldPosition = new THREE.Vector3(
      chunkX * size + size / 2,
      0,
      chunkZ * size + size / 2
    );
  }

  async generate(): Promise<void> {
    if (this.isGenerated) return;

    try {
      // Generate terrain heightmap
      this.generateHeightData();
      
      // Create terrain mesh
      await this.createTerrainMesh();
      
      // Generate vegetation
      await this.generateVegetation();
      
      // Generate enemies (sparse)
      await this.generateEnemies();
      
      this.isGenerated = true;
      console.log(`🌍 Generated chunk (${this.chunkX}, ${this.chunkZ})`);
      
    } catch (error) {
      console.error(`❌ Failed to generate chunk (${this.chunkX}, ${this.chunkZ}):`, error);
      throw error;
    }
  }

  private generateHeightData(): void {
    const resolution = 32; // Height samples per chunk
    this.heightData = new Float32Array((resolution + 1) * (resolution + 1));
    
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    
    for (let x = 0; x <= resolution; x++) {
      for (let z = 0; z <= resolution; z++) {
        const worldX = baseX + (x / resolution) * this.size;
        const worldZ = baseZ + (z / resolution) * this.size;
        
        // Multi-octave noise for varied terrain
        let height = 0;
        height += this.noiseGenerator.noise(worldX * 0.01, worldZ * 0.01) * 20;  // Large features
        height += this.noiseGenerator.noise(worldX * 0.05, worldZ * 0.05) * 5;   // Medium features
        height += this.noiseGenerator.noise(worldX * 0.1, worldZ * 0.1) * 1;     // Small details
        
        this.heightData[x * (resolution + 1) + z] = Math.max(0, height);
      }
    }
  }

  private async createTerrainMesh(): Promise<void> {
    const segments = 16; // Mesh resolution (can vary by LOD)
    const geometry = new THREE.PlaneGeometry(this.size, this.size, segments, segments);
    
    // Apply heightmap to geometry
    const positions = geometry.attributes.position;
    const vertices = positions.array as Float32Array;
    
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const z = vertices[i + 2];
      const height = this.sampleHeight(x, z);
      vertices[i + 1] = height; // Set Y coordinate
    }
    
    // Rotate to horizontal and position
    geometry.rotateX(-Math.PI / 2);
    geometry.computeVertexNormals();
    
    // Create material with proper texture handling
    const texture = this.assetLoader.getTexture('forestfloor');
    let material: THREE.MeshBasicMaterial; // Use MeshBasicMaterial for testing
    
    if (texture) {
      // Don't use PixelPerfectUtils as it might be causing issues
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2); // Smaller repeat for testing
      
      material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
      });
      console.log(`🎨 Using forestfloor texture for chunk (${this.chunkX}, ${this.chunkZ})`);
    } else {
      // Bright debug color for visibility
      material = new THREE.MeshBasicMaterial({
        color: 0xFF0000, // Bright red for debugging
        side: THREE.DoubleSide
      });
      console.warn(`❌ No forestfloor texture found for chunk (${this.chunkX}, ${this.chunkZ}), using red debug color`);
    }
    
    // Create mesh
    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.terrainMesh.position.set(
      this.chunkX * this.size + this.size / 2,
      0,
      this.chunkZ * this.size + this.size / 2
    );
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.userData.chunkId = `${this.chunkX},${this.chunkZ}`;
    
    this.scene.add(this.terrainMesh);
    console.log(`✅ Terrain mesh created for chunk (${this.chunkX}, ${this.chunkZ}) at position:`, this.terrainMesh.position);
    console.log(`📐 Terrain geometry vertices: ${geometry.attributes.position.count}, visible: ${this.terrainMesh.visible}`);
  }

  private async generateVegetation(): Promise<void> {
    // Generate grass with higher density
    await this.generateGrassInstances();
    
    // Generate trees with lower density
    await this.generateTreeInstances();
  }

  private async generateGrassInstances(): Promise<void> {
    const texture = this.assetLoader.getTexture('grass');
    if (!texture) return;
    
    const density = 0.1; // Reduced density for performance
    const maxInstances = Math.floor(this.size * this.size * density / 10);
    
    // Create geometry and material - BACK TO INSTANCED MESH
    const geometry = new THREE.PlaneGeometry(2, 3);
    const material = PixelPerfectUtils.createPixelPerfectMaterial(texture, true);
    
    // Create instanced mesh
    this.grassMesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    this.grassMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grassMesh.castShadow = true;
    this.grassMesh.userData.chunkId = `${this.chunkX},${this.chunkZ}`;
    
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    const dummy = new THREE.Object3D();
    
    // Generate random grass positions
    for (let i = 0; i < maxInstances; i++) {
      const localX = Math.random() * this.size;
      const localZ = Math.random() * this.size;
      const worldX = baseX + localX;
      const worldZ = baseZ + localZ;
      const height = this.sampleHeight(localX - this.size/2, localZ - this.size/2);
      
      const instance: BillboardInstance = {
        position: new THREE.Vector3(worldX, height, worldZ),
        scale: new THREE.Vector3(
          MathUtils.randomInRange(0.7, 1.3),
          MathUtils.randomInRange(0.8, 1.5),
          1
        ),
        rotation: 0 // Will be updated by billboard system
      };
      
      this.grassInstances.push(instance);
      
      // Set instance matrix
      dummy.position.copy(instance.position);
      dummy.rotation.y = instance.rotation;
      dummy.scale.copy(instance.scale);
      dummy.updateMatrix();
      
      this.grassMesh.setMatrixAt(i, dummy.matrix);
    }
    
    this.grassMesh.count = maxInstances;
    this.grassMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.grassMesh);
    console.log(`✅ Generated ${maxInstances} grass instances for chunk (${this.chunkX}, ${this.chunkZ})`);
  }

  private async generateTreeInstances(): Promise<void> {
    const texture = this.assetLoader.getTexture('tree');
    if (!texture) return;
    
    const density = 0.02; // Reduced density for performance
    const maxInstances = Math.floor(this.size * this.size * density / 10);
    
    if (maxInstances === 0) return;
    
    // Create geometry and material - BACK TO INSTANCED MESH
    const geometry = new THREE.PlaneGeometry(4, 6);
    const material = PixelPerfectUtils.createPixelPerfectMaterial(texture, true);
    
    // Create instanced mesh
    this.treeMesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    this.treeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.treeMesh.castShadow = true;
    this.treeMesh.userData.chunkId = `${this.chunkX},${this.chunkZ}`;
    
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    const dummy = new THREE.Object3D();
    
    // Use Poisson disk sampling for better tree distribution
    const minDistance = 12; // Increased spacing
    const treePoints = MathUtils.poissonDiskSampling(this.size, this.size, minDistance);
    const actualCount = Math.min(treePoints.length, maxInstances);
    
    for (let i = 0; i < actualCount; i++) {
      const point = treePoints[i];
      const worldX = baseX + point.x;
      const worldZ = baseZ + point.y;
      const height = this.sampleHeight(point.x - this.size/2, point.y - this.size/2);
      
      const instance: BillboardInstance = {
        position: new THREE.Vector3(worldX, height + 3, worldZ),
        scale: new THREE.Vector3(
          MathUtils.randomInRange(0.8, 1.5),
          MathUtils.randomInRange(0.9, 1.8),
          1
        ),
        rotation: 0 // Will be updated by billboard system
      };
      
      this.treeInstances.push(instance);
      
      // Set instance matrix
      dummy.position.copy(instance.position);
      dummy.rotation.y = instance.rotation;
      dummy.scale.copy(instance.scale);
      dummy.updateMatrix();
      
      this.treeMesh.setMatrixAt(i, dummy.matrix);
    }
    
    this.treeMesh.count = actualCount;
    this.treeMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.treeMesh);
    console.log(`✅ Generated ${actualCount} tree instances for chunk (${this.chunkX}, ${this.chunkZ})`);
  }

  private async generateEnemies(): Promise<void> {
    // Generate enemies sparsely (only some chunks have them)
    const shouldHaveEnemies = Math.random() < 0.3; // 30% of chunks have enemies
    if (!shouldHaveEnemies) return;
    
    const texture = this.assetLoader.getTexture('imp');
    if (!texture) return;
    
    const enemyCount = MathUtils.randomInRange(1, 4);
    
    // Implementation would be similar to trees but for enemies
    // For now, just track enemy instances for future AI system
  }

  private sampleHeight(x: number, z: number): number {
    // Sample height from heightData using bilinear interpolation
    const resolution = 32;
    const normalizedX = ((x + this.size/2) / this.size) * resolution;
    const normalizedZ = ((z + this.size/2) / this.size) * resolution;
    
    const x0 = Math.floor(normalizedX);
    const x1 = Math.min(x0 + 1, resolution);
    const z0 = Math.floor(normalizedZ);
    const z1 = Math.min(z0 + 1, resolution);
    
    const fx = normalizedX - x0;
    const fz = normalizedZ - z0;
    
    const h00 = this.heightData[x0 * (resolution + 1) + z0] || 0;
    const h10 = this.heightData[x1 * (resolution + 1) + z0] || 0;
    const h01 = this.heightData[x0 * (resolution + 1) + z1] || 0;
    const h11 = this.heightData[x1 * (resolution + 1) + z1] || 0;
    
    // Bilinear interpolation
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    
    return h0 * (1 - fz) + h1 * fz;
  }

  // LOD and visibility management
  setLODLevel(level: number): void {
    if (this.currentLOD === level) return;
    
    this.currentLOD = level;
    
    // Adjust visibility based on LOD
    if (level >= 1) {
      // High LOD - hide grass
      if (this.grassMesh) this.grassMesh.visible = false;
    } else {
      // Low/Medium LOD - show all
      if (this.grassMesh) this.grassMesh.visible = true;
    }
  }

  setVisible(visible: boolean): void {
    if (this.isVisible === visible) return;
    
    this.isVisible = visible;
    
    if (this.terrainMesh) this.terrainMesh.visible = visible;
    if (this.grassMesh) this.grassMesh.visible = visible && this.currentLOD < 1;
    if (this.treeMesh) this.treeMesh.visible = visible;
    if (this.enemyMesh) this.enemyMesh.visible = visible;
  }

  dispose(): void {
    // Remove from scene and dispose resources
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
    }
    
    if (this.grassMesh) {
      this.scene.remove(this.grassMesh);
      this.grassMesh.dispose();
    }
    
    if (this.treeMesh) {
      this.scene.remove(this.treeMesh);
      this.treeMesh.dispose();
    }
    
    if (this.enemyMesh) {
      this.scene.remove(this.enemyMesh);
      this.enemyMesh.dispose();
    }
    
    // Clear instance arrays
    this.grassInstances.length = 0;
    this.treeInstances.length = 0;
    this.enemyInstances.length = 0;
  }

  // Billboard update system
  updateBillboards(cameraPosition: THREE.Vector3): void {
    if (!this.isVisible) return;
    
    const dummy = new THREE.Object3D();
    let needsUpdate = false;
    
    // Update grass billboard rotations
    if (this.grassMesh && this.grassInstances.length > 0) {
      for (let i = 0; i < this.grassInstances.length; i++) {
        const instance = this.grassInstances[i];
        
        // Calculate rotation to face camera (Y-axis only for vertical billboards)
        const direction = new THREE.Vector3()
          .subVectors(cameraPosition, instance.position);
        direction.y = 0; // Keep billboards vertical
        direction.normalize();
        
        const targetRotation = Math.atan2(direction.x, direction.z);
        
        // Only update if rotation changed significantly
        if (Math.abs(targetRotation - instance.rotation) > 0.1) {
          instance.rotation = targetRotation;
          
          dummy.position.copy(instance.position);
          dummy.rotation.y = instance.rotation;
          dummy.scale.copy(instance.scale);
          dummy.updateMatrix();
          
          this.grassMesh.setMatrixAt(i, dummy.matrix);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        this.grassMesh.instanceMatrix.needsUpdate = true;
        needsUpdate = false;
      }
    }
    
    // Update tree billboard rotations
    if (this.treeMesh && this.treeInstances.length > 0) {
      for (let i = 0; i < this.treeInstances.length; i++) {
        const instance = this.treeInstances[i];
        
        // Calculate rotation to face camera
        const direction = new THREE.Vector3()
          .subVectors(cameraPosition, instance.position);
        direction.y = 0; // Keep billboards vertical
        direction.normalize();
        
        const targetRotation = Math.atan2(direction.x, direction.z);
        
        // Only update if rotation changed significantly
        if (Math.abs(targetRotation - instance.rotation) > 0.1) {
          instance.rotation = targetRotation;
          
          dummy.position.copy(instance.position);
          dummy.rotation.y = instance.rotation;
          dummy.scale.copy(instance.scale);
          dummy.updateMatrix();
          
          this.treeMesh.setMatrixAt(i, dummy.matrix);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        this.treeMesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // Public accessors
  getPosition(): THREE.Vector3 {
    return this.worldPosition.clone();
  }

  getHeightAt(worldX: number, worldZ: number): number {
    // Convert world coordinates to local chunk coordinates
    const localX = worldX - (this.chunkX * this.size + this.size/2);
    const localZ = worldZ - (this.chunkZ * this.size + this.size/2);
    
    return this.sampleHeight(localX, localZ);
  }

  isInBounds(worldX: number, worldZ: number): boolean {
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    
    return worldX >= baseX && worldX < baseX + this.size &&
           worldZ >= baseZ && worldZ < baseZ + this.size;
  }
}