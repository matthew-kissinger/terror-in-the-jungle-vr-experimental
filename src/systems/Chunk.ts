import * as THREE from 'three';
import { BillboardInstance } from '../types';
import { AssetLoader } from './AssetLoader';
import { NoiseGenerator } from '../utils/NoiseGenerator';
import { PixelPerfectUtils } from '../utils/PixelPerfect';
import { MathUtils } from '../utils/Math';
import { GlobalBillboardSystem } from './GlobalBillboardSystem';

export class Chunk {
  private scene: THREE.Scene;
  private assetLoader: AssetLoader;
  private chunkX: number;
  private chunkZ: number;
  private size: number;
  private noiseGenerator: NoiseGenerator;
  private globalBillboardSystem: GlobalBillboardSystem;
  
  // Terrain
  private terrainMesh?: THREE.Mesh;
  private heightData: Float32Array = new Float32Array(0);
  
  // Vegetation is now managed by the global billboard system
  // No more per-chunk instanced meshes
  
  // Instance data
  private grassInstances: BillboardInstance[] = [];
  private treeInstances: BillboardInstance[] = [];
  private enemyInstances: BillboardInstance[] = [];
  
  // LOD state
  private currentLOD = 0;
  private isVisible = true;
  private isGenerated = false;
  private debugMode = false; // Disable debug mode for proper textures
  
  // Position in world coordinates
  private worldPosition: THREE.Vector3;

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
      
      // Register instances with global billboard system
      this.addInstancesToGlobalSystem();
      
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
    const resolution = 32; // Must match terrain mesh segments!
    this.heightData = new Float32Array((resolution + 1) * (resolution + 1));
    
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    
    // Generate height data that matches terrain mesh vertices
    for (let z = 0; z <= resolution; z++) {
      for (let x = 0; x <= resolution; x++) {
        const worldX = baseX + (x / resolution) * this.size;
        const worldZ = baseZ + (z / resolution) * this.size;
        
        // Multi-octave noise for varied terrain
        let height = 0;
        height += this.noiseGenerator.noise(worldX * 0.01, worldZ * 0.01) * 20;  // Large features
        height += this.noiseGenerator.noise(worldX * 0.05, worldZ * 0.05) * 5;   // Medium features
        height += this.noiseGenerator.noise(worldX * 0.1, worldZ * 0.1) * 1;     // Small details
        
        // Store in row-major order to match PlaneGeometry
        const index = z * (resolution + 1) + x;
        this.heightData[index] = Math.max(0, height);
      }
    }
  }

  private async createTerrainMesh(): Promise<void> {
    const segments = 32; // MUST match heightData resolution!
    const geometry = new THREE.PlaneGeometry(this.size, this.size, segments, segments);
    
    // Rotate FIRST to make horizontal (XZ plane)
    geometry.rotateX(-Math.PI / 2);
    
    // Apply heightmap directly from heightData array
    const positions = geometry.attributes.position;
    const vertices = positions.array as Float32Array;
    
    // PlaneGeometry creates vertices in a grid pattern
    // We need to match this with our heightData array
    let vertexIndex = 0;
    for (let z = 0; z <= segments; z++) {
      for (let x = 0; x <= segments; x++) {
        const heightIndex = z * (segments + 1) + x;
        const height = this.heightData[heightIndex];
        
        // Set the Y coordinate (height) for this vertex
        vertices[vertexIndex * 3 + 1] = height;
        vertexIndex++;
      }
    }
    
    // Update normals after modifying vertices
    geometry.computeVertexNormals();
    positions.needsUpdate = true;
    
    // Create material
    let material: THREE.Material;
    
    if (this.debugMode) {
      // Wireframe for debugging
      material = new THREE.MeshBasicMaterial({
        color: 0x00FF00,
        wireframe: true,
        side: THREE.DoubleSide
      });
    } else {
      const texture = this.assetLoader.getTexture('forestfloor');
      if (texture) {
        // Use standard material for better lighting
        material = PixelPerfectUtils.createPixelPerfectMaterial(texture, false);
        texture.repeat.set(8, 8);
        console.log(`🎨 Using forestfloor texture for chunk (${this.chunkX}, ${this.chunkZ})`);
      } else {
        // Fallback solid color
        material = new THREE.MeshBasicMaterial({
          color: 0x4a7c59,
          side: THREE.DoubleSide
        });
        console.warn(`⚠️ Using fallback color for chunk (${this.chunkX}, ${this.chunkZ})`);
      }
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
    
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    
    // Generate random grass positions
    for (let i = 0; i < maxInstances; i++) {
      const localX = Math.random() * this.size;
      const localZ = Math.random() * this.size;
      const worldX = baseX + localX;
      const worldZ = baseZ + localZ;
      // Use proper local coordinates for height sampling
      const height = this.sampleHeight(localX, localZ);
      
      const instance: BillboardInstance = {
        position: new THREE.Vector3(worldX, height, worldZ),
        scale: new THREE.Vector3(
          MathUtils.randomInRange(0.7, 1.3),
          MathUtils.randomInRange(0.8, 1.5),
          1
        ),
        rotation: 0 // Will be updated by global billboard system
      };
      
      this.grassInstances.push(instance);
    }
    
    console.log(`✅ Generated ${maxInstances} grass instances for chunk (${this.chunkX}, ${this.chunkZ})`);
  }

  private async generateTreeInstances(): Promise<void> {
    const texture = this.assetLoader.getTexture('tree');
    if (!texture) return;
    
    const density = 0.02; // Reduced density for performance
    const maxInstances = Math.floor(this.size * this.size * density / 10);
    
    if (maxInstances === 0) return;
    
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    
    // Use Poisson disk sampling for better tree distribution
    const minDistance = 12; // Increased spacing
    const treePoints = MathUtils.poissonDiskSampling(this.size, this.size, minDistance);
    const actualCount = Math.min(treePoints.length, maxInstances);
    
    for (let i = 0; i < actualCount; i++) {
      const point = treePoints[i];
      const worldX = baseX + point.x;
      const worldZ = baseZ + point.y;
      // Sample height using local coordinates
      const height = this.sampleHeight(point.x, point.y);
      
      const instance: BillboardInstance = {
        position: new THREE.Vector3(worldX, height + 2.5, worldZ),
        scale: new THREE.Vector3(
          MathUtils.randomInRange(0.8, 1.5),
          MathUtils.randomInRange(0.9, 1.8),
          1
        ),
        rotation: 0 // Will be updated by global billboard system
      };
      
      this.treeInstances.push(instance);
    }
    
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

  /**
   * Register this chunk's billboard instances with the global system
   */
  private addInstancesToGlobalSystem(): void {
    const chunkKey = `${this.chunkX},${this.chunkZ}`;
    this.globalBillboardSystem.addChunkInstances(chunkKey, this.grassInstances, this.treeInstances);
  }

  private sampleHeight(x: number, z: number): number {
    // Sample height from heightData using bilinear interpolation
    // x and z are in local chunk coordinates (0 to size)
    const resolution = 32; // Must match heightData resolution
    
    // Clamp to valid range
    x = Math.max(0, Math.min(this.size - 0.001, x)); // Slight offset to prevent edge issues
    z = Math.max(0, Math.min(this.size - 0.001, z));
    
    const normalizedX = (x / this.size) * resolution;
    const normalizedZ = (z / this.size) * resolution;
    
    const x0 = Math.floor(Math.max(0, Math.min(normalizedX, resolution)));
    const x1 = Math.min(x0 + 1, resolution);
    const z0 = Math.floor(Math.max(0, Math.min(normalizedZ, resolution)));
    const z1 = Math.min(z0 + 1, resolution);
    
    const fx = normalizedX - x0;
    const fz = normalizedZ - z0;
    
    // Fix indexing - heightData is stored in row-major order (z, x)
    const h00 = this.heightData[z0 * (resolution + 1) + x0] || 0;
    const h10 = this.heightData[z0 * (resolution + 1) + x1] || 0;
    const h01 = this.heightData[z1 * (resolution + 1) + x0] || 0;
    const h11 = this.heightData[z1 * (resolution + 1) + x1] || 0;
    
    // Bilinear interpolation
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    
    return h0 * (1 - fz) + h1 * fz;
  }

  // LOD and visibility management
  setLODLevel(level: number): void {
    if (this.currentLOD === level) return;
    
    this.currentLOD = level;
    
    // LOD is now handled by the global billboard system
    // Individual chunks no longer manage visibility
  }

  setVisible(visible: boolean): void {
    if (this.isVisible === visible) return;
    
    this.isVisible = visible;
    
    if (this.terrainMesh) this.terrainMesh.visible = visible;
    // Billboard visibility is now handled by the global billboard system
  }

  dispose(): void {
    // Remove from scene and dispose resources
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      (this.terrainMesh.material as THREE.Material).dispose();
    }
    
    // Billboard meshes are handled by the global billboard system
    // No need to dispose per-chunk meshes
    
    // Clear instance arrays
    this.grassInstances.length = 0;
    this.treeInstances.length = 0;
    this.enemyInstances.length = 0;
  }

  // Billboard updates are now handled by the global billboard system

  // Public accessors
  getPosition(): THREE.Vector3 {
    return this.worldPosition.clone();
  }

  getHeightAt(worldX: number, worldZ: number): number {
    // Convert world coordinates to local chunk coordinates (0 to size)
    const localX = worldX - (this.chunkX * this.size);
    const localZ = worldZ - (this.chunkZ * this.size);
    
    // Validate that we're within this chunk
    if (localX < 0 || localX > this.size || localZ < 0 || localZ > this.size) {
      console.warn(`Height requested outside chunk bounds: (${localX}, ${localZ})`);
      return 0;
    }
    
    return this.sampleHeight(localX, localZ);
  }

  isInBounds(worldX: number, worldZ: number): boolean {
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    
    return worldX >= baseX && worldX < baseX + this.size &&
           worldZ >= baseZ && worldZ < baseZ + this.size;
  }
}