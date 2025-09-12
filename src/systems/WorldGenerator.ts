import * as THREE from 'three';
import { GameSystem, WorldConfig, BillboardInstance } from '../types';
import { MathUtils } from '../utils/Math';
import { BillboardSystem } from './Billboard';
import { Terrain } from './Terrain';
import { AssetLoader } from './AssetLoader';

export class WorldGenerator implements GameSystem {
  private config: WorldConfig;
  private billboardSystem: BillboardSystem;
  private terrain: Terrain;
  private assetLoader?: AssetLoader;

  constructor(
    billboardSystem: BillboardSystem, 
    terrain: Terrain,
    assetLoader?: AssetLoader,
    config: WorldConfig = {
      terrainSize: 200,
      grassDensity: 0.25, // Dense undergrowth for jungle
      treeDensity: 0.05, // Mixed canopy and medium trees
      enemyCount: 15 // More enemies for terror in the jungle
    }
  ) {
    this.billboardSystem = billboardSystem;
    this.terrain = terrain;
    this.assetLoader = assetLoader;
    this.config = config;
  }
  
  setAssetLoader(assetLoader: AssetLoader): void {
    this.assetLoader = assetLoader;
  }

  async init(): Promise<void> {
    // World generation happens when textures are available
  }

  update(deltaTime: number): void {
    // World is static after generation
  }

  dispose(): void {
    // WorldGenerator doesn't manage resources directly
  }

  generateWorld(
    grassTexture: THREE.Texture,
    treeTexture: THREE.Texture
  ): void {
    console.log('🌴 Generating Terror in the Jungle world...');
    
    // Generate jungle foliage in layers
    this.generateJungleCanopy();
    this.generateMediumPalms();
    this.generateUndergrowth();
    
    console.log('🌴 Jungle world generation complete');
  }

  private generateJungleCanopy(): void {
    const terrainSize = this.config.terrainSize;
    const halfSize = terrainSize / 2;
    
    // Large canopy trees - sparse distribution
    const canopyDensity = 0.003; // Very sparse for giant trees
    const canopyCount = Math.floor(terrainSize * terrainSize * canopyDensity);
    
    console.log(`🌳 CANOPY GENERATION:`);
    console.log(`- Generating ${canopyCount} giant canopy trees`);
    
    // Load canopy textures
    const dipterocarpTexture = this.assetLoader?.getTexture('DipterocarpGiant');
    const banyanTexture = this.assetLoader?.getTexture('TwisterBanyan');
    
    if (dipterocarpTexture) {
      // Create Dipterocarp giants
      const dipterocarpCount = Math.floor(canopyCount * 0.5);
      this.billboardSystem.createBillboardType('dipterocarp', dipterocarpTexture, dipterocarpCount, 10, 12);
      
      // Use wide Poisson spacing for giants
      const points = MathUtils.poissonDiskSampling(terrainSize, terrainSize, 25); // Very wide spacing
      
      for (let i = 0; i < Math.min(dipterocarpCount, points.length); i++) {
        const point = points[i];
        const position = new THREE.Vector3(
          point.x - halfSize,
          this.terrain.getHeightAt(point.x - halfSize, point.y - halfSize) + 5,
          point.y - halfSize
        );
        
        const scale = new THREE.Vector3(
          MathUtils.randomInRange(8, 10),
          MathUtils.randomInRange(10, 12),
          1
        );
        
        this.billboardSystem.addInstance('dipterocarp', {
          position,
          scale,
          rotation: MathUtils.randomInRange(0, Math.PI * 2)
        });
      }
    }
    
    if (banyanTexture) {
      // Create Twisted Banyans
      const banyanCount = canopyCount - Math.floor(canopyCount * 0.5);
      this.billboardSystem.createBillboardType('banyan', banyanTexture, banyanCount, 9, 11);
      
      // Separate Poisson for banyans to avoid overlap
      const points = MathUtils.poissonDiskSampling(terrainSize, terrainSize, 20);
      
      for (let i = 0; i < Math.min(banyanCount, points.length); i++) {
        const point = points[i];
        const position = new THREE.Vector3(
          point.x - halfSize,
          this.terrain.getHeightAt(point.x - halfSize, point.y - halfSize) + 4.5,
          point.y - halfSize
        );
        
        const scale = new THREE.Vector3(
          MathUtils.randomInRange(7, 9),
          MathUtils.randomInRange(9, 11),
          1
        );
        
        this.billboardSystem.addInstance('banyan', {
          position,
          scale,
          rotation: MathUtils.randomInRange(0, Math.PI * 2)
        });
      }
    }
    
    console.log(`✅ Canopy layer complete`);
  }
  
  private generateMediumPalms(): void {
    const terrainSize = this.config.terrainSize;
    const halfSize = terrainSize / 2;
    
    // Medium palm trees - moderate distribution
    const palmDensity = 0.015; // More than canopy, less than undergrowth
    const palmCount = Math.floor(terrainSize * terrainSize * palmDensity);
    
    console.log(`🌴 PALM GENERATION:`);
    console.log(`- Generating ${palmCount} medium palm trees`);
    
    // Load palm textures
    const coconutTexture = this.assetLoader?.getTexture('CoconutPalm');
    const arecaTexture = this.assetLoader?.getTexture('ArecaPalmCluster');
    
    if (coconutTexture) {
      // Coconut palms - prefer near water (edges for now)
      const coconutCount = Math.floor(palmCount * 0.4);
      this.billboardSystem.createBillboardType('coconut', coconutTexture, coconutCount, 5, 6);
      
      for (let i = 0; i < coconutCount; i++) {
        // Bias towards edges (simulating water proximity)
        const edgeBias = Math.random() < 0.6;
        let x, z;
        
        if (edgeBias) {
          // Place near edges
          if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? -halfSize + Math.random() * 20 : halfSize - Math.random() * 20;
            z = MathUtils.randomInRange(-halfSize, halfSize);
          } else {
            x = MathUtils.randomInRange(-halfSize, halfSize);
            z = Math.random() < 0.5 ? -halfSize + Math.random() * 20 : halfSize - Math.random() * 20;
          }
        } else {
          x = MathUtils.randomInRange(-halfSize + 10, halfSize - 10);
          z = MathUtils.randomInRange(-halfSize + 10, halfSize - 10);
        }
        
        const position = new THREE.Vector3(
          x,
          this.terrain.getHeightAt(x, z) + 2.5,
          z
        );
        
        const scale = new THREE.Vector3(
          MathUtils.randomInRange(4, 5),
          MathUtils.randomInRange(5, 6),
          1
        );
        
        this.billboardSystem.addInstance('coconut', {
          position,
          scale,
          rotation: MathUtils.randomInRange(0, Math.PI * 2)
        });
      }
    }
    
    if (arecaTexture) {
      // Areca palm clusters - everywhere
      const arecaCount = palmCount - Math.floor(palmCount * 0.4);
      this.billboardSystem.createBillboardType('areca', arecaTexture, arecaCount, 4, 5);
      
      // Use moderate Poisson spacing
      const points = MathUtils.poissonDiskSampling(terrainSize, terrainSize, 8);
      
      for (let i = 0; i < Math.min(arecaCount, points.length); i++) {
        const point = points[i];
        const position = new THREE.Vector3(
          point.x - halfSize,
          this.terrain.getHeightAt(point.x - halfSize, point.y - halfSize) + 2,
          point.y - halfSize
        );
        
        const scale = new THREE.Vector3(
          MathUtils.randomInRange(3.5, 4.5),
          MathUtils.randomInRange(4, 5.5),
          1
        );
        
        this.billboardSystem.addInstance('areca', {
          position,
          scale,
          rotation: MathUtils.randomInRange(0, Math.PI * 2)
        });
      }
    }
    
    console.log(`✅ Palm layer complete`);
  }
  
  private generateUndergrowth(): void {
    const terrainSize = this.config.terrainSize;
    const halfSize = terrainSize / 2;
    
    // Dense undergrowth
    const undergrowthDensity = 0.08; // Very dense for jungle floor
    const undergrowthCount = Math.floor(terrainSize * terrainSize * undergrowthDensity);
    
    console.log(`🌿 UNDERGROWTH GENERATION:`);
    console.log(`- Generating ${undergrowthCount} undergrowth plants`);
    
    // Load undergrowth textures
    const fernTexture = this.assetLoader?.getTexture('Fern');
    const fanPalmTexture = this.assetLoader?.getTexture('FanPalmCluster');
    const elephantEarTexture = this.assetLoader?.getTexture('ElephantEarPlants');
    
    const textures = [
      { texture: fernTexture, name: 'fern', weight: 0.4 },
      { texture: fanPalmTexture, name: 'fanpalm', weight: 0.3 },
      { texture: elephantEarTexture, name: 'elephantear', weight: 0.3 }
    ].filter(t => t.texture);
    
    // Create billboard types for each undergrowth
    textures.forEach(t => {
      const count = Math.floor(undergrowthCount * t.weight);
      this.billboardSystem.createBillboardType(t.name, t.texture!, count, 1.5, 2.5);
    });
    
    // Random distribution for dense undergrowth
    let totalPlaced = 0;
    textures.forEach(t => {
      const count = Math.floor(undergrowthCount * t.weight);
      
      for (let i = 0; i < count; i++) {
        const position = MathUtils.randomVector3(
          -halfSize + 2, halfSize - 2,
          -halfSize + 2, halfSize - 2,
          0
        );
        position.y = this.terrain.getHeightAt(position.x, position.z) + 0.5;
        
        const scale = new THREE.Vector3(
          MathUtils.randomInRange(1, 2),
          MathUtils.randomInRange(1.5, 2.5),
          1
        );
        
        this.billboardSystem.addInstance(t.name, {
          position,
          scale,
          rotation: MathUtils.randomInRange(0, Math.PI * 2)
        });
        totalPlaced++;
      }
    });
    
    console.log(`✅ Undergrowth complete: ${totalPlaced} plants`);
  }
  
  private generateGrass(grassTexture: THREE.Texture): void {
    const terrainSize = this.config.terrainSize;
    const halfSize = terrainSize / 2;
    const targetCount = Math.floor(terrainSize * terrainSize * this.config.grassDensity);
    
    console.log(`🌱 GRASS GENERATION DEBUG:`);
    console.log(`- Terrain size: ${terrainSize}`);
    console.log(`- Grass density: ${this.config.grassDensity}`);
    console.log(`- Target count: ${targetCount}`);
    
    // Create billboard type for grass (much bigger and visible)
    this.billboardSystem.createBillboardType('grass', grassTexture, targetCount, 2, 3);

    console.log(`Generating ${targetCount} grass instances...`);

    let successfullyAdded = 0;
    // Generate grass with random distribution
    for (let i = 0; i < targetCount; i++) {
      const position = MathUtils.randomVector3(-halfSize, halfSize, -halfSize, halfSize, 0);
      
      // Slight height variation
      position.y = this.terrain.getHeightAt(position.x, position.z);
      
      const scale = new THREE.Vector3(
        MathUtils.randomInRange(0.5, 1.2),
        MathUtils.randomInRange(0.8, 1.5),
        1
      );
      
      const instance: BillboardInstance = {
        position,
        scale,
        rotation: MathUtils.randomInRange(0, Math.PI * 2)
      };

      const index = this.billboardSystem.addInstance('grass', instance);
      if (index >= 0) successfullyAdded++;
    }

    console.log(`✅ Generated ${successfullyAdded}/${targetCount} grass instances`);
    console.log(`Final grass count: ${this.billboardSystem.getInstanceCount('grass')}`);
  }

  private generateTrees(treeTexture: THREE.Texture): void {
    const terrainSize = this.config.terrainSize;
    const halfSize = terrainSize / 2;
    const targetCount = Math.floor(terrainSize * terrainSize * this.config.treeDensity);
    
    console.log(`🌳 TREE GENERATION DEBUG:`);
    console.log(`- Terrain size: ${terrainSize}`);
    console.log(`- Tree density: ${this.config.treeDensity}`);
    console.log(`- Target count: ${targetCount}`);
    
    // Create billboard type for trees (bigger and properly sized)
    this.billboardSystem.createBillboardType('tree', treeTexture, targetCount, 4, 6);

    console.log(`Generating ${targetCount} tree instances using Poisson disk sampling...`);

    // Use Poisson disk sampling for better tree distribution
    const minDistance = 4; // Closer trees for denser forest
    const treePoints = MathUtils.poissonDiskSampling(terrainSize, terrainSize, minDistance);
    
    console.log(`- Poisson disk generated ${treePoints.length} potential points`);
    
    // Convert points to 3D positions and create tree instances
    const actualCount = Math.min(treePoints.length, targetCount);
    
    let successfullyAdded = 0;
    for (let i = 0; i < actualCount; i++) {
      const point = treePoints[i];
      const position = new THREE.Vector3(
        point.x - halfSize,
        this.terrain.getHeightAt(point.x - halfSize, point.y - halfSize) + 2.5, // Trees sit properly on ground
        point.y - halfSize
      );
      
      const scale = new THREE.Vector3(
        MathUtils.randomInRange(0.8, 1.5),
        MathUtils.randomInRange(0.9, 1.8),
        1
      );
      
      const instance: BillboardInstance = {
        position,
        scale,
        rotation: MathUtils.randomInRange(0, Math.PI * 2)
      };

      const index = this.billboardSystem.addInstance('tree', instance);
      if (index >= 0) successfullyAdded++;
    }

    console.log(`✅ Generated ${successfullyAdded}/${actualCount} tree instances`);
    console.log(`Final tree count: ${this.billboardSystem.getInstanceCount('tree')}`);
  }

  generateEnemySpawns(): THREE.Vector3[] {
    const terrainSize = this.config.terrainSize;
    const halfSize = terrainSize / 2;
    const spawns: THREE.Vector3[] = [];

    console.log(`👹 ENEMY SPAWN GENERATION DEBUG:`);
    console.log(`- Terrain size: ${terrainSize}`);
    console.log(`- Enemy count target: ${this.config.enemyCount}`);
    console.log(`- Spawn area: ${-halfSize + 10} to ${halfSize - 10}`);

    for (let i = 0; i < this.config.enemyCount; i++) {
      let attempts = 0;
      let validPosition = false;
      let position: THREE.Vector3;

      do {
        position = MathUtils.randomVector3(-halfSize + 10, halfSize - 10, -halfSize + 10, halfSize - 10, 0);
        position.y = this.terrain.getHeightAt(position.x, position.z) + 0.5; // Slightly above ground
        
        // Check if position is far enough from trees
        validPosition = this.isValidEnemySpawn(position);
        attempts++;
      } while (!validPosition && attempts < 50);

      if (validPosition) {
        spawns.push(position);
        console.log(`Enemy spawn ${i}: valid position found at`, position, `(attempts: ${attempts})`);
      } else {
        console.warn(`Enemy spawn ${i}: failed to find valid position after 50 attempts`);
      }
    }

    console.log(`✅ Generated ${spawns.length}/${this.config.enemyCount} valid enemy spawn points`);
    return spawns;
  }

  private isValidEnemySpawn(position: THREE.Vector3): boolean {
    // Check distance from trees - much more relaxed for dense forest
    const treeInstances = this.billboardSystem.getAllInstances('tree');
    const minDistanceFromTrees = 2; // Reduced from 5 to 2 units
    
    // Only check against nearby trees for performance
    let nearbyTreeCount = 0;
    for (const tree of treeInstances) {
      const distance = position.distanceTo(tree.position);
      if (distance < minDistanceFromTrees) {
        nearbyTreeCount++;
        // Allow up to 2 nearby trees (imps can hide between trees)
        if (nearbyTreeCount > 2) {
          return false;
        }
      }
    }

    return true;
  }

  getConfig(): WorldConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<WorldConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}