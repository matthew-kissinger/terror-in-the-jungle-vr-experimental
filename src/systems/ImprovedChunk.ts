import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { AssetLoader } from './AssetLoader';
import { NoiseGenerator } from '../utils/NoiseGenerator';
import { GlobalBillboardSystem } from './GlobalBillboardSystem';
import { BillboardInstance } from '../types';
import { MathUtils } from '../utils/Math';

// Extend Three.js BufferGeometry with BVH methods
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export class ImprovedChunk {
  private scene: THREE.Scene;
  private assetLoader: AssetLoader;
  private chunkX: number;
  private chunkZ: number;
  private size: number;
  private segments: number = 32;
  
  // Terrain data
  private heightData: Float32Array;
  private terrainMesh?: THREE.Mesh;
  private terrainGeometry?: THREE.BufferGeometry;
  
  // Billboard instances
  private globalBillboardSystem: GlobalBillboardSystem;
  private grassInstances: BillboardInstance[] = [];
  private treeInstances: BillboardInstance[] = [];
  
  // Generation
  private noiseGenerator: NoiseGenerator;
  private isGenerated = false;
  
  // Debug
  private debugMode = true;

  constructor(
    scene: THREE.Scene,
    assetLoader: AssetLoader,
    chunkX: number,
    chunkZ: number,
    size: number,
    noiseGenerator: NoiseGenerator,
    globalBillboardSystem: GlobalBillboardSystem
  ) {
    this.scene = scene;
    this.assetLoader = assetLoader;
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.size = size;
    this.noiseGenerator = noiseGenerator;
    this.globalBillboardSystem = globalBillboardSystem;
    
    // Initialize height data array
    const dataSize = (this.segments + 1) * (this.segments + 1);
    this.heightData = new Float32Array(dataSize);
  }

  async generate(): Promise<void> {
    if (this.isGenerated) return;
    
    // Generate height data first
    this.generateHeightData();
    
    // Create terrain mesh with proper vertex order
    await this.createTerrainMesh();
    
    // Generate vegetation positioned on terrain
    await this.generateVegetation();
    
    // Register instances with global system
    const chunkKey = `${this.chunkX},${this.chunkZ}`;
    this.globalBillboardSystem.addChunkInstances(chunkKey, this.grassInstances, this.treeInstances);
    
    this.isGenerated = true;
    console.log(`✅ ImprovedChunk (${this.chunkX}, ${this.chunkZ}) generated`);
  }

  private generateHeightData(): void {
    const worldOffsetX = this.chunkX * this.size;
    const worldOffsetZ = this.chunkZ * this.size;
    
    // Generate height data following Three.js example pattern
    let index = 0;
    for (let z = 0; z <= this.segments; z++) {
      for (let x = 0; x <= this.segments; x++) {
        // Calculate world position
        const worldX = worldOffsetX + (x / this.segments) * this.size;
        const worldZ = worldOffsetZ + (z / this.segments) * this.size;
        
        // Generate height using noise
        let height = 0;
        height += this.noiseGenerator.noise(worldX * 0.01, worldZ * 0.01) * 20;
        height += this.noiseGenerator.noise(worldX * 0.05, worldZ * 0.05) * 5;
        height += this.noiseGenerator.noise(worldX * 0.1, worldZ * 0.1) * 1;
        
        this.heightData[index++] = Math.max(0, height);
      }
    }
  }

  private async createTerrainMesh(): Promise<void> {
    // Create PlaneGeometry following Three.js example pattern
    const geometry = new THREE.PlaneGeometry(
      this.size, 
      this.size, 
      this.segments, 
      this.segments
    );
    
    // Rotate to horizontal FIRST (before modifying vertices)
    geometry.rotateX(-Math.PI / 2);
    
    // Apply height data to vertices - following Three.js example
    const vertices = geometry.attributes.position.array as Float32Array;
    
    // THREE.PlaneGeometry creates vertices in a specific order
    // After rotation, Y is up, X and Z are horizontal
    for (let i = 0, j = 0; i < this.heightData.length; i++, j += 3) {
      // Set Y coordinate (height)
      vertices[j + 1] = this.heightData[i];
    }
    
    // Update geometry
    geometry.computeVertexNormals();
    geometry.attributes.position.needsUpdate = true;
    
    // Compute BVH for accurate collision detection
    (geometry as any).computeBoundsTree();
    
    // Create material
    let material: THREE.Material;
    if (this.debugMode) {
      material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true,
        side: THREE.DoubleSide
      });
    } else {
      const texture = this.assetLoader.getTexture('forestfloor');
      if (texture) {
        material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide
        });
        texture.repeat.set(8, 8);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      } else {
        material = new THREE.MeshBasicMaterial({
          color: 0x4a7c59,
          side: THREE.DoubleSide
        });
      }
    }
    
    // Create and position mesh
    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.terrainMesh.position.set(
      this.chunkX * this.size,
      0,
      this.chunkZ * this.size
    );
    
    // Store geometry reference for collision
    this.terrainGeometry = geometry;
    
    this.scene.add(this.terrainMesh);
    
    // Debug verification
    const testHeight = this.getHeightAtLocal(this.size / 2, this.size / 2);
    console.log(`📐 Chunk (${this.chunkX}, ${this.chunkZ}) center height: ${testHeight.toFixed(2)}`);
  }

  private async generateVegetation(): Promise<void> {
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    
    // Generate grass
    const grassCount = Math.floor(this.size * this.size * 0.01);
    for (let i = 0; i < grassCount; i++) {
      const localX = Math.random() * this.size;
      const localZ = Math.random() * this.size;
      const height = this.getHeightAtLocal(localX, localZ);
      
      this.grassInstances.push({
        position: new THREE.Vector3(baseX + localX, height, baseZ + localZ),
        scale: new THREE.Vector3(
          MathUtils.randomInRange(0.7, 1.3),
          MathUtils.randomInRange(0.8, 1.5),
          1
        ),
        rotation: 0
      });
    }
    
    // Generate trees with Poisson disk sampling
    const treePoints = MathUtils.poissonDiskSampling(this.size, this.size, 15);
    const treeCount = Math.min(treePoints.length, 20);
    
    for (let i = 0; i < treeCount; i++) {
      const point = treePoints[i];
      const height = this.getHeightAtLocal(point.x, point.y);
      
      this.treeInstances.push({
        position: new THREE.Vector3(baseX + point.x, height + 2.5, baseZ + point.y),
        scale: new THREE.Vector3(
          MathUtils.randomInRange(0.8, 1.5),
          MathUtils.randomInRange(0.9, 1.8),
          1
        ),
        rotation: 0
      });
    }
  }

  /**
   * Get height at local chunk coordinates using direct height data lookup
   */
  private getHeightAtLocal(localX: number, localZ: number): number {
    // Clamp to chunk bounds
    localX = Math.max(0, Math.min(this.size, localX));
    localZ = Math.max(0, Math.min(this.size, localZ));
    
    // Convert to grid coordinates
    const gridX = (localX / this.size) * this.segments;
    const gridZ = (localZ / this.size) * this.segments;
    
    // Get integer grid positions
    const x0 = Math.floor(gridX);
    const x1 = Math.min(x0 + 1, this.segments);
    const z0 = Math.floor(gridZ);
    const z1 = Math.min(z0 + 1, this.segments);
    
    // Get fractional parts for interpolation
    const fx = gridX - x0;
    const fz = gridZ - z0;
    
    // Get heights at corners - using correct indexing
    const getIndex = (x: number, z: number) => z * (this.segments + 1) + x;
    
    const h00 = this.heightData[getIndex(x0, z0)];
    const h10 = this.heightData[getIndex(x1, z0)];
    const h01 = this.heightData[getIndex(x0, z1)];
    const h11 = this.heightData[getIndex(x1, z1)];
    
    // Bilinear interpolation
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    
    return h0 * (1 - fz) + h1 * fz;
  }

  /**
   * Get height at world coordinates using raycasting with BVH
   */
  getHeightAt(worldX: number, worldZ: number): number {
    if (!this.terrainMesh || !this.terrainGeometry) return 0;
    
    // Convert to local coordinates
    const localX = worldX - (this.chunkX * this.size);
    const localZ = worldZ - (this.chunkZ * this.size);
    
    // Check bounds
    if (localX < 0 || localX > this.size || localZ < 0 || localZ > this.size) {
      return 0;
    }
    
    // Use direct height data lookup for best accuracy
    return this.getHeightAtLocal(localX, localZ);
  }

  /**
   * Alternative: Get height using raycasting (more accurate for complex terrain)
   */
  getHeightAtRaycast(worldX: number, worldZ: number): number {
    if (!this.terrainMesh) return 0;
    
    // Create downward ray from above the terrain
    const raycaster = new THREE.Raycaster();
    const origin = new THREE.Vector3(worldX, 1000, worldZ);
    const direction = new THREE.Vector3(0, -1, 0);
    
    raycaster.set(origin, direction);
    
    // Intersect with terrain mesh (uses BVH for speed)
    const intersects = raycaster.intersectObject(this.terrainMesh);
    
    if (intersects.length > 0) {
      return intersects[0].point.y;
    }
    
    return 0;
  }

  dispose(): void {
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      
      if (this.terrainGeometry) {
        (this.terrainGeometry as any).disposeBoundsTree();
        this.terrainGeometry.dispose();
      }
      
      if (this.terrainMesh.material instanceof THREE.Material) {
        this.terrainMesh.material.dispose();
      }
    }
    
    // Remove instances from global system
    const chunkKey = `${this.chunkX},${this.chunkZ}`;
    this.globalBillboardSystem.removeChunkInstances(chunkKey);
  }

  setVisible(visible: boolean): void {
    if (this.terrainMesh) {
      this.terrainMesh.visible = visible;
    }
  }

  getPosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.chunkX * this.size + this.size / 2,
      0,
      this.chunkZ * this.size + this.size / 2
    );
  }

  isInBounds(worldX: number, worldZ: number): boolean {
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    return worldX >= baseX && worldX < baseX + this.size &&
           worldZ >= baseZ && worldZ < baseZ + this.size;
  }

  setLODLevel(level: number): void {
    // Future: Implement LOD switching
  }
}