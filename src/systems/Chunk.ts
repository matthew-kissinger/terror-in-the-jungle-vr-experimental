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
  private tree1Instances: BillboardInstance[] = [];
  private tree2Instances: BillboardInstance[] = [];
  private tree3Instances: BillboardInstance[] = [];
  private mushroomInstances: BillboardInstance[] = [];
  private wheatInstances: BillboardInstance[] = [];
  private enemyInstances: BillboardInstance[] = [];
  
  // Biome data
  private biomeType: 'pine_forest' | 'oak_woods' | 'mixed_forest' | 'sparse_plains' | 'farmland' = 'mixed_forest';
  
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
      // STEP 1: Generate and display terrain FIRST
      this.generateHeightData();
      await this.createTerrainMesh();
      
      // Mark terrain as ready
      this.isGenerated = true;
      console.log(`🌍 Generated chunk terrain (${this.chunkX}, ${this.chunkZ})`);
      
      // STEP 2: Add vegetation after a small delay so terrain renders first
      setTimeout(async () => {
        try {
          // Generate vegetation
          await this.generateVegetation();
          
          // Register instances with global billboard system
          this.addInstancesToGlobalSystem();
          
          // Generate enemies (sparse)
          await this.generateEnemies();
          
          console.log(`🌳 Added vegetation to chunk (${this.chunkX}, ${this.chunkZ})`);
        } catch (error) {
          console.error(`Failed to add vegetation to chunk (${this.chunkX}, ${this.chunkZ}):`, error);
        }
      }, 100); // 100ms delay ensures terrain is visible first
      
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
        
        // Continental/base terrain shape (very low frequency)
        let continentalHeight = this.noiseGenerator.noise(worldX * 0.001, worldZ * 0.001);
        
        // Mountain ranges using ridge noise (inverted absolute value)
        let ridgeNoise = 1 - Math.abs(this.noiseGenerator.noise(worldX * 0.003, worldZ * 0.003));
        ridgeNoise = Math.pow(ridgeNoise, 1.5); // Less sharp ridges to avoid cliffs
        
        // Valley carving using erosion simulation
        let valleyNoise = this.noiseGenerator.noise(worldX * 0.008, worldZ * 0.008);
        valleyNoise = Math.pow(Math.abs(valleyNoise), 0.7) * Math.sign(valleyNoise); // Smooth valleys
        
        // Hills and medium features with varying persistence
        let hillNoise = 0;
        hillNoise += this.noiseGenerator.noise(worldX * 0.015, worldZ * 0.015) * 0.5;
        hillNoise += this.noiseGenerator.noise(worldX * 0.03, worldZ * 0.03) * 0.25;
        hillNoise += this.noiseGenerator.noise(worldX * 0.06, worldZ * 0.06) * 0.125;
        
        // Fine details
        let detailNoise = this.noiseGenerator.noise(worldX * 0.1, worldZ * 0.1) * 0.1;
        
        // Combine all noise layers
        let height = 0;
        
        // Base elevation influenced by continental noise
        height += (continentalHeight * 0.5 + 0.5) * 30;
        
        // Add mountain ridges with smooth transitions
        const ridgeStrength = MathUtils.smoothstep(-0.3, 0.2, continentalHeight);
        height += ridgeNoise * 80 * ridgeStrength; // Reduced height and smoothed
        
        // Carve valleys
        height += valleyNoise * 40;
        
        // Add hills with persistence falloff
        height += hillNoise * 35;
        
        // Add fine details
        height += detailNoise * 8;
        
        // Create water areas (lakes and rivers)
        const waterNoise = this.noiseGenerator.noise(worldX * 0.003, worldZ * 0.003);
        const riverNoise = this.noiseGenerator.noise(worldX * 0.01, worldZ * 0.01);
        
        // Create lakes in low-lying areas
        if (waterNoise < -0.4 && height < 15) {
          height = -3 - waterNoise * 2; // Below water level (0)
        }
        // Create river valleys
        else if (Math.abs(riverNoise) < 0.1 && height < 25) {
          height = height * 0.3 - 2; // Carve river channels
        }
        // Apply smoothing for valleys (lower areas)
        else if (height < 20) {
          height = height * 0.7; // Flatten valley floors
        }
        
        // Allow negative heights for underwater terrain
        height = Math.max(-8, height); // Changed from 0 to -8
        
        // Store in row-major order to match PlaneGeometry
        const index = z * (resolution + 1) + x;
        this.heightData[index] = height;
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

  private determineBiome(): void {
    // Use noise to determine biome based on temperature and moisture
    const centerX = this.chunkX * this.size + this.size / 2;
    const centerZ = this.chunkZ * this.size + this.size / 2;
    
    // Temperature noise (north-south variation)
    const temperature = this.noiseGenerator.noise(centerX * 0.002, centerZ * 0.002);
    // Moisture noise (east-west variation)
    const moisture = this.noiseGenerator.noise(centerX * 0.0025 + 1000, centerZ * 0.0025 + 1000);
    
    // Determine biome based on temperature and moisture
    if (temperature < -0.3) {
      // Cold regions
      this.biomeType = 'pine_forest';
    } else if (temperature > 0.3) {
      // Warm regions
      if (moisture > 0.2) {
        this.biomeType = 'farmland';
      } else {
        this.biomeType = 'sparse_plains';
      }
    } else {
      // Temperate regions
      if (moisture > 0.1) {
        this.biomeType = 'oak_woods';
      } else {
        this.biomeType = 'mixed_forest';
      }
    }
  }

  private async generateVegetation(): Promise<void> {
    // Determine biome first
    this.determineBiome();
    
    // Generate grass with density based on biome
    await this.generateGrassInstances();
    
    // Generate trees with biome-specific clustering
    await this.generateTreeInstances();
    
    // Generate mushrooms (more common in forests)
    await this.generateMushroomInstances();
    
    // Generate wheat patches (more common now)
    if (this.biomeType === 'farmland' || this.biomeType === 'sparse_plains' || Math.random() < 0.3) {
      await this.generateWheatPatches();
    }
  }

  private async generateGrassInstances(): Promise<void> {
    const texture = this.assetLoader.getTexture('grass');
    if (!texture) return;
    
    // Adjust grass density based on biome - MUCH HIGHER DENSITY
    let density = 0.8;
    switch (this.biomeType) {
      case 'pine_forest': density = 0.4; break;
      case 'oak_woods': density = 0.6; break;
      case 'mixed_forest': density = 0.5; break;
      case 'sparse_plains': density = 0.9; break;
      case 'farmland': density = 0.3; break;
    }
    
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
      
      // Skip underwater grass
      if (height < 0.5) continue;
      
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
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    
    // Use multiple noise layers for forest generation
    const forestNoise = this.noiseGenerator.noise(baseX * 0.003, baseZ * 0.003);
    const edgeNoise = this.noiseGenerator.noise(baseX * 0.01, baseZ * 0.01);
    
    // Create distinct forest regions with clear edges
    let forestDensity = 0;
    if (forestNoise > 0.2) {
      forestDensity = 1.0; // Dense forest core
    } else if (forestNoise > 0) {
      // Forest edge - use smoothstep for transition
      const t = forestNoise / 0.2;
      forestDensity = t * t * (3 - 2 * t); // Smoothstep interpolation
      // Add edge variation
      forestDensity *= (0.7 + 0.3 * (edgeNoise + 1) / 2);
    } else if (forestNoise > -0.2) {
      // Treeline - very sparse trees
      forestDensity = Math.max(0, (forestNoise + 0.2) / 0.2) * 0.2;
    }
    
    // Biome-specific overrides
    if (this.biomeType === 'pine_forest') {
      forestDensity = Math.max(0.3, forestDensity); // Pine forests always have some trees
    } else if (this.biomeType === 'sparse_plains' || this.biomeType === 'farmland') {
      forestDensity *= 0.3; // Plains and farmland have fewer trees
    }
    
    if (forestDensity === 0) {
      // This is an open field - no trees
      return;
    }
    
    // Determine tree types and density based on biome and forest density
    let primaryTree: string = 'tree1'; // Default to pine (tree1)
    let secondaryTree: string = 'tree';
    let baseDensity = 0.02;
    let minDistance = 12;
    let mixingRatio = 0.05; // Much less mixing for more homogeneous patches
    
    switch (this.biomeType) {
      case 'pine_forest':
        primaryTree = 'tree1'; // Pine
        secondaryTree = 'tree2';
        baseDensity = 0.08; // Higher base density for pine forests
        minDistance = 6;
        mixingRatio = 0.02; // Almost pure pine
        break;
      case 'oak_woods':
        primaryTree = 'tree1'; // Still mainly pine
        secondaryTree = 'tree2'; // With some oak
        baseDensity = 0.05; // Moderate density
        minDistance = 8;
        mixingRatio = 0.08; // Less mixing
        break;
      case 'mixed_forest':
        primaryTree = 'tree1'; // Pine primary
        secondaryTree = 'tree3'; // With birch
        baseDensity = 0.04; // Medium density
        minDistance = 9;
        mixingRatio = 0.12; // Some mixing but still distinct patches
        break;
      case 'sparse_plains':
        primaryTree = 'tree1'; // Even plains have pine
        secondaryTree = 'tree';
        baseDensity = 0.02; // Sparse
        minDistance = 15;
        mixingRatio = 0.03;
        break;
      case 'farmland':
        primaryTree = 'tree1'; // Pine with farmland
        secondaryTree = 'tree2';
        baseDensity = 0.015; // Very sparse
        minDistance = 20;
        mixingRatio = 0.05;
        break;
    }
    
    // Apply forest density multiplier
    const density = baseDensity * forestDensity;
    
    // Adjust minimum distance based on density (closer trees in denser forests)
    minDistance = Math.max(5, minDistance * (2 - forestDensity));
    
    const maxInstances = Math.floor(this.size * this.size * density / 10);
    if (maxInstances === 0) return;
    
    // Use Poisson disk sampling for better tree distribution
    const treePoints = MathUtils.poissonDiskSampling(this.size, this.size, minDistance);
    const actualCount = Math.min(treePoints.length, maxInstances);
    
    for (let i = 0; i < actualCount; i++) {
      const point = treePoints[i];
      const worldX = baseX + point.x;
      const worldZ = baseZ + point.y;
      const height = this.sampleHeight(point.x, point.y);
      
      // Use larger-scale noise to create more homogeneous patches
      const patchNoise = this.noiseGenerator.noise(worldX * 0.008, worldZ * 0.008);
      const microVariation = this.noiseGenerator.noise(worldX * 0.05, worldZ * 0.05);
      
      // Determine tree type based on patch noise
      let treeType: string;
      if (this.biomeType === 'mixed_forest') {
        // Mixed forest has distinct patches of each tree type
        if (patchNoise > 0.3) {
          treeType = 'tree1'; // Pine patch
        } else if (patchNoise > 0) {
          treeType = 'tree2'; // Oak patch
        } else if (patchNoise > -0.3) {
          treeType = 'tree3'; // Birch patch
        } else {
          treeType = 'tree'; // Regular tree patch
        }
        
        // Very rare mixing at patch boundaries
        if (Math.abs(patchNoise) < 0.02 && microVariation > 0.8) {
          treeType = Math.random() < 0.5 ? primaryTree : secondaryTree;
        }
      } else {
        // Other biomes have very homogeneous patches
        if (patchNoise > 0.5 - mixingRatio) {
          treeType = primaryTree;
        } else if (patchNoise < -0.5 + mixingRatio) {
          treeType = secondaryTree;
        } else {
          // Transition zone - mostly primary with occasional secondary
          treeType = microVariation > 0.9 ? secondaryTree : primaryTree;
        }
      }
      
      const texture = this.assetLoader.getTexture(treeType);
      if (!texture) continue;
      
      // Adjust scale based on tree type
      let scaleMultiplier = 1;
      if (treeType === 'tree1') scaleMultiplier = 1.2; // Pine trees are taller
      if (treeType === 'tree2') scaleMultiplier = 1.1; // Oak trees are wider
      
      // Skip underwater trees
      if (height < 0.5) continue;
      
      const instance: BillboardInstance = {
        position: new THREE.Vector3(worldX, height + 12, worldZ),
        scale: new THREE.Vector3(
          MathUtils.randomInRange(1.5, 2.5) * scaleMultiplier,
          MathUtils.randomInRange(1.5, 2.5) * scaleMultiplier,
          1
        ),
        rotation: 0
      };
      
      // Add to the correct tree type array
      switch(treeType) {
        case 'tree':
          this.treeInstances.push(instance);
          break;
        case 'tree1':
          this.tree1Instances.push(instance);
          break;
        case 'tree2':
          this.tree2Instances.push(instance);
          break;
        case 'tree3':
          this.tree3Instances.push(instance);
          break;
      }
    }
    
    console.log(`✅ Generated ${actualCount} trees (${this.biomeType}) for chunk (${this.chunkX}, ${this.chunkZ})`);
  }

  private async generateMushroomInstances(): Promise<void> {
    const texture = this.assetLoader.getTexture('mushroom');
    if (!texture) return;
    
    // Mushrooms are more common in forests, rare in plains
    let density = 0.02;
    switch (this.biomeType) {
      case 'pine_forest': density = 0.06; break;
      case 'oak_woods': density = 0.05; break;
      case 'mixed_forest': density = 0.04; break;
      case 'sparse_plains': density = 0.01; break;
      case 'farmland': density = 0.02; break;
    }
    
    const maxInstances = Math.floor(this.size * this.size * density / 10);
    if (maxInstances === 0) return;
    
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    
    // Mushrooms cluster near trees - use smaller poisson disk radius
    const minDistance = 3;
    const mushroomPoints = MathUtils.poissonDiskSampling(this.size, this.size, minDistance);
    const actualCount = Math.min(mushroomPoints.length, maxInstances);
    
    for (let i = 0; i < actualCount; i++) {
      const point = mushroomPoints[i];
      
      // Check if near a tree (within 8 units of any tree)
      let nearTree = false;
      for (const tree of this.treeInstances) {
        const dx = (baseX + point.x) - tree.position.x;
        const dz = (baseZ + point.y) - tree.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < 8) {
          nearTree = true;
          break;
        }
      }
      
      // Higher chance to spawn if near tree
      if (!nearTree && Math.random() > 0.3) continue;
      
      const worldX = baseX + point.x;
      const worldZ = baseZ + point.y;
      const height = this.sampleHeight(point.x, point.y);
      
      // Skip underwater mushrooms
      if (height < 0.2) continue;
      
      const instance: BillboardInstance = {
        position: new THREE.Vector3(worldX, height + 0.2, worldZ), // Slightly above ground
        scale: new THREE.Vector3(
          MathUtils.randomInRange(1.0, 1.8), // Bigger mushrooms
          MathUtils.randomInRange(1.0, 1.8),
          1
        ),
        rotation: 0
      };
      
      this.mushroomInstances.push(instance);
    }
    
    console.log(`🍄 Generated ${this.mushroomInstances.length} mushrooms for chunk (${this.chunkX}, ${this.chunkZ})`);
  }

  private async generateWheatPatches(): Promise<void> {
    const texture = this.assetLoader.getTexture('wheat');
    if (!texture) return;
    
    const baseX = this.chunkX * this.size;
    const baseZ = this.chunkZ * this.size;
    
    // Generate more wheat patches
    const numPatches = this.biomeType === 'farmland' ? MathUtils.randomInRange(3, 5) : MathUtils.randomInRange(1, 3);
    
    for (let p = 0; p < numPatches; p++) {
      // Random patch center
      const patchCenterX = Math.random() * this.size * 0.8 + this.size * 0.1;
      const patchCenterZ = Math.random() * this.size * 0.8 + this.size * 0.1;
      const patchRadius = MathUtils.randomInRange(12, 20);
      
      // Generate wheat within patch using blob noise
      const wheatCount = Math.floor(patchRadius * patchRadius * 0.3);
      
      for (let i = 0; i < wheatCount; i++) {
        // Random position within patch
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * patchRadius;
        const localX = patchCenterX + Math.cos(angle) * distance;
        const localZ = patchCenterZ + Math.sin(angle) * distance;
        
        // Skip if outside chunk bounds
        if (localX < 0 || localX >= this.size || localZ < 0 || localZ >= this.size) continue;
        
        // Use noise to create organic patch shape
        const patchNoise = this.noiseGenerator.noise(
          (baseX + localX) * 0.1,
          (baseZ + localZ) * 0.1
        );
        if (patchNoise < -0.2) continue; // Create irregular edges
        
        const worldX = baseX + localX;
        const worldZ = baseZ + localZ;
        const height = this.sampleHeight(localX, localZ);
        
        // Skip underwater wheat
        if (height < 0.5) continue;
        
        const instance: BillboardInstance = {
          position: new THREE.Vector3(worldX, height + 0.5, worldZ), // Lower into ground
          scale: new THREE.Vector3(
            MathUtils.randomInRange(0.8, 1.2),
            MathUtils.randomInRange(1.0, 1.5),
            1
          ),
          rotation: 0
        };
        
        this.wheatInstances.push(instance);
      }
    }
    
    if (this.wheatInstances.length > 0) {
      console.log(`🌾 Generated ${this.wheatInstances.length} wheat in ${numPatches} patches for chunk (${this.chunkX}, ${this.chunkZ})`);
    }
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
    this.globalBillboardSystem.addChunkInstances(
      chunkKey, 
      this.grassInstances, 
      this.treeInstances,
      this.mushroomInstances,
      this.wheatInstances,
      this.tree1Instances,
      this.tree2Instances,
      this.tree3Instances
    );
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