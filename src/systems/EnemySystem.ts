import * as THREE from 'three';
import { GameSystem, BillboardInstance } from '../types';
import { GlobalBillboardSystem } from './GlobalBillboardSystem';
import { AssetLoader } from './AssetLoader';
import { ImprovedChunkManager } from './ImprovedChunkManager';

interface Enemy {
  id: string;
  type: 'zombie' | 'goblin' | 'imp';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  scale: THREE.Vector3;
  wanderAngle: number;
  timeToDirectionChange: number;
  billboardIndex?: number;
  // Faction-specific properties
  hordeId?: string; // For zombies
  packId?: string;  // For goblins
  packRole?: 'leader' | 'follower'; // For goblins
  detectionRadius: number;
  moveSpeed: number;
  isChasing: boolean;
  lastKnownPlayerPos?: THREE.Vector3;
}

export class EnemySystem implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private globalBillboardSystem: GlobalBillboardSystem;
  private assetLoader: AssetLoader;
  private chunkManager?: ImprovedChunkManager;
  
  private enemies: Map<string, Enemy> = new Map();
  private zombieMesh?: THREE.InstancedMesh;
  private goblinMesh?: THREE.InstancedMesh;
  private impMesh?: THREE.InstancedMesh;
  private nextEnemyId = 0;
  private nextHordeId = 0;
  private nextPackId = 0;
  
  // Group tracking
  private hordes: Map<string, string[]> = new Map(); // hordeId -> enemyIds
  private packs: Map<string, string[]> = new Map();  // packId -> enemyIds
  
  // Spawn settings
  private readonly MAX_ENEMIES = 30;
  private readonly SPAWN_RADIUS = 40;
  private readonly MIN_SPAWN_DISTANCE = 20;
  private readonly WANDER_RADIUS = 40;
  
  // Speed settings by type
  private readonly ZOMBIE_SPEED = 3;
  private readonly GOBLIN_SPEED = 7;
  private readonly IMP_SPEED = 5;
  
  // Detection ranges
  private readonly ZOMBIE_DETECTION = 20;
  private readonly GOBLIN_DETECTION = 30;
  private readonly IMP_DETECTION = 15;
  
  // Player tracking
  private playerPosition = new THREE.Vector3();
  private lastSpawnCheck = 0;
  private readonly SPAWN_CHECK_INTERVAL = 2000; // Check every 2 seconds

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    globalBillboardSystem: GlobalBillboardSystem,
    assetLoader: AssetLoader,
    chunkManager?: ImprovedChunkManager
  ) {
    this.scene = scene;
    this.camera = camera;
    this.globalBillboardSystem = globalBillboardSystem;
    this.assetLoader = assetLoader;
    this.chunkManager = chunkManager;
  }

  async init(): Promise<void> {
    console.log('👹 Initializing Enemy System...');
    
    // Create enemy billboard types
    await this.createEnemyBillboards();
    
    // Spawn initial enemies
    this.spawnInitialEnemies();
    
    console.log('✅ Enemy System initialized');
  }

  private async createEnemyBillboards(): Promise<void> {
    const zombieTexture = this.assetLoader.getTexture('zombie');
    const goblinTexture = this.assetLoader.getTexture('goblin');
    const impTexture = this.assetLoader.getTexture('imp');
    
    if (!zombieTexture || !goblinTexture || !impTexture) {
      console.warn('⚠️ Some enemy textures not found');
    }
    
    // Create zombie billboard type
    if (zombieTexture) {
      const zombieGeometry = new THREE.PlaneGeometry(6, 8);
      const zombieMaterial = new THREE.MeshBasicMaterial({
        map: zombieTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: true
      });
      
      this.zombieMesh = new THREE.InstancedMesh(zombieGeometry, zombieMaterial, 15);
      this.zombieMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.zombieMesh.frustumCulled = false;
      this.zombieMesh.count = 0;
      this.zombieMesh.renderOrder = 1;
      this.scene.add(this.zombieMesh);
    }
    
    // Create goblin billboard type
    if (goblinTexture) {
      const goblinGeometry = new THREE.PlaneGeometry(5, 6);
      const goblinMaterial = new THREE.MeshBasicMaterial({
        map: goblinTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: true
      });
      
      this.goblinMesh = new THREE.InstancedMesh(goblinGeometry, goblinMaterial, 10);
      this.goblinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.goblinMesh.frustumCulled = false;
      this.goblinMesh.count = 0;
      this.goblinMesh.renderOrder = 1;
      this.scene.add(this.goblinMesh);
    }
    
    // Create imp billboard type
    if (impTexture) {
      const impGeometry = new THREE.PlaneGeometry(4, 5);
      const impMaterial = new THREE.MeshBasicMaterial({
        map: impTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: true
      });
      
      this.impMesh = new THREE.InstancedMesh(impGeometry, impMaterial, 10);
      this.impMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.impMesh.frustumCulled = false;
      this.impMesh.count = 0;
      this.impMesh.renderOrder = 1;
      this.scene.add(this.impMesh);
    }
  }

  private spawnInitialEnemies(): void {
    // Spawn zombie hordes closer to player
    this.spawnZombieHorde(new THREE.Vector3(15, 0, 15));
    this.spawnZombieHorde(new THREE.Vector3(-20, 0, 10));
    
    // Spawn goblin packs  
    this.spawnGoblinPack(new THREE.Vector3(10, 0, -15));
    this.spawnGoblinPack(new THREE.Vector3(-15, 0, -10));
    
    // Spawn individual imps
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 10 + Math.random() * 15;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = this.getTerrainHeight(x, z) + 3;
      this.spawnEnemy(new THREE.Vector3(x, y, z), 'imp');
    }
    
    console.log('👹 Spawned initial enemy groups');
  }
  
  private spawnZombieHorde(centerPos: THREE.Vector3): void {
    const hordeId = `horde_${this.nextHordeId++}`;
    const hordeSize = Math.floor(Math.random() * 3) + 3; // 3-5 zombies
    const enemyIds: string[] = [];
    
    for (let i = 0; i < hordeSize; i++) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        0,
        (Math.random() - 0.5) * 8
      );
      const position = centerPos.clone().add(offset);
      position.y = this.getTerrainHeight(position.x, position.z) + 3;
      const enemyId = this.spawnEnemy(position, 'zombie', { hordeId });
      if (enemyId) enemyIds.push(enemyId);
    }
    
    this.hordes.set(hordeId, enemyIds);
    console.log(`🧟 Spawned zombie horde ${hordeId} with ${hordeSize} zombies`);
  }
  
  private spawnGoblinPack(centerPos: THREE.Vector3): void {
    const packId = `pack_${this.nextPackId++}`;
    const packSize = Math.floor(Math.random() * 2) + 3; // 3-4 goblins
    const enemyIds: string[] = [];
    
    for (let i = 0; i < packSize; i++) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        0,
        (Math.random() - 0.5) * 6
      );
      const position = centerPos.clone().add(offset);
      position.y = this.getTerrainHeight(position.x, position.z) + 3;
      const packRole = i === 0 ? 'leader' : 'follower';
      const enemyId = this.spawnEnemy(position, 'goblin', { packId, packRole });
      if (enemyId) enemyIds.push(enemyId);
    }
    
    this.packs.set(packId, enemyIds);
    console.log(`👺 Spawned goblin pack ${packId} with ${packSize} goblins`);
  }

  update(deltaTime: number): void {
    // Update player position
    this.camera.getWorldPosition(this.playerPosition);
    
    // Check if we need to spawn more enemies
    const now = Date.now();
    if (now - this.lastSpawnCheck > this.SPAWN_CHECK_INTERVAL) {
      this.checkAndSpawnEnemies();
      this.lastSpawnCheck = now;
    }
    
    // Update each enemy
    this.enemies.forEach(enemy => {
      this.updateEnemy(enemy, deltaTime);
    });
    
    // Update billboard rotations to face camera
    this.updateBillboards();
  }

  private checkAndSpawnEnemies(): void {
    // Remove enemies that are too far away
    const toRemove: string[] = [];
    this.enemies.forEach((enemy, id) => {
      const distance = enemy.position.distanceTo(this.playerPosition);
      if (distance > this.WANDER_RADIUS * 2) {
        toRemove.push(id);
      }
    });
    
    toRemove.forEach(id => this.removeEnemy(id));
    
    // Spawn new enemies if needed
    while (this.enemies.size < this.MAX_ENEMIES) {
      const angle = Math.random() * Math.PI * 2;
      const distance = this.MIN_SPAWN_DISTANCE + Math.random() * (this.SPAWN_RADIUS - this.MIN_SPAWN_DISTANCE);
      
      const x = this.playerPosition.x + Math.cos(angle) * distance;
      const z = this.playerPosition.z + Math.sin(angle) * distance;
      const y = this.getTerrainHeight(x, z) + 3; // Get terrain height + offset
      
      const position = new THREE.Vector3(x, y, z);
      
      // Spawn different enemy types with different probabilities
      const rand = Math.random();
      if (rand < 0.4) {
        // 40% chance: Spawn zombie horde
        this.spawnZombieHorde(position);
        break; // Only spawn one group at a time
      } else if (rand < 0.7) {
        // 30% chance: Spawn goblin pack
        this.spawnGoblinPack(position);
        break;
      } else {
        // 30% chance: Spawn individual imp
        this.spawnEnemy(position, 'imp');
      }
    }
  }

  private spawnEnemy(position: THREE.Vector3, type: 'zombie' | 'goblin' | 'imp', groupData?: { hordeId?: string; packId?: string; packRole?: 'leader' | 'follower' }): string {
    const id = `enemy_${this.nextEnemyId++}`;
    
    // Set properties based on enemy type
    let moveSpeed: number;
    let detectionRadius: number;
    
    switch (type) {
      case 'zombie':
        moveSpeed = this.ZOMBIE_SPEED;
        detectionRadius = this.ZOMBIE_DETECTION;
        break;
      case 'goblin':
        moveSpeed = this.GOBLIN_SPEED;
        detectionRadius = this.GOBLIN_DETECTION;
        break;
      case 'imp':
        moveSpeed = this.IMP_SPEED;
        detectionRadius = this.IMP_DETECTION;
        break;
    }
    
    const enemy: Enemy = {
      id,
      type,
      position: position.clone(),
      velocity: new THREE.Vector3(),
      rotation: Math.random() * Math.PI * 2,
      scale: new THREE.Vector3(1, 1, 1),
      wanderAngle: Math.random() * Math.PI * 2,
      timeToDirectionChange: Math.random() * 3,
      moveSpeed,
      detectionRadius,
      isChasing: false,
      ...groupData
    };
    
    this.enemies.set(id, enemy);
    return id;
  }

  private updateEnemy(enemy: Enemy, deltaTime: number): void {
    const distanceToPlayer = enemy.position.distanceTo(this.playerPosition);
    
    // Check if player is in detection range
    if (distanceToPlayer <= enemy.detectionRadius && !enemy.isChasing) {
      enemy.isChasing = true;
      enemy.lastKnownPlayerPos = this.playerPosition.clone();
    } else if (distanceToPlayer > enemy.detectionRadius * 1.5 && enemy.isChasing) {
      enemy.isChasing = false;
    }
    
    // Update based on enemy type
    switch (enemy.type) {
      case 'zombie':
        this.updateZombie(enemy, deltaTime);
        break;
      case 'goblin':
        this.updateGoblin(enemy, deltaTime);
        break;
      case 'imp':
        this.updateImp(enemy, deltaTime);
        break;
    }
    
    // Apply velocity
    enemy.position.add(enemy.velocity.clone().multiplyScalar(deltaTime));
    
    // Keep enemy on terrain
    const terrainHeight = this.getTerrainHeight(enemy.position.x, enemy.position.z);
    enemy.position.y = terrainHeight + 3;
  }
  
  private updateZombie(enemy: Enemy, deltaTime: number): void {
    if (enemy.isChasing && enemy.lastKnownPlayerPos) {
      // Slowly shamble toward player
      const toPlayer = new THREE.Vector3()
        .subVectors(enemy.lastKnownPlayerPos, enemy.position)
        .normalize();
      
      enemy.velocity.set(
        toPlayer.x * enemy.moveSpeed,
        0,
        toPlayer.z * enemy.moveSpeed
      );
      
      // Update last known position
      enemy.lastKnownPlayerPos = this.playerPosition.clone();
    } else {
      // Wander slowly
      enemy.timeToDirectionChange -= deltaTime;
      if (enemy.timeToDirectionChange <= 0) {
        enemy.wanderAngle += (Math.random() - 0.5) * Math.PI;
        enemy.timeToDirectionChange = 3 + Math.random() * 2;
      }
      
      enemy.velocity.set(
        Math.cos(enemy.wanderAngle) * enemy.moveSpeed * 0.5,
        0,
        Math.sin(enemy.wanderAngle) * enemy.moveSpeed * 0.5
      );
    }
  }
  
  private updateGoblin(enemy: Enemy, deltaTime: number): void {
    if (enemy.isChasing) {
      // Goblins are smarter - they try to surround
      const toPlayer = new THREE.Vector3()
        .subVectors(this.playerPosition, enemy.position)
        .normalize();
      
      // Pack behavior
      if (enemy.packId && enemy.packRole) {
        const packMembers = this.packs.get(enemy.packId);
        if (packMembers) {
          if (enemy.packRole === 'leader') {
            // Leader goes straight for player
            enemy.velocity.set(
              toPlayer.x * enemy.moveSpeed,
              0,
              toPlayer.z * enemy.moveSpeed
            );
          } else {
            // Followers try to flank
            const angle = Math.PI / 4 * (packMembers.indexOf(enemy.id) % 2 === 0 ? 1 : -1);
            const flankDir = new THREE.Vector3(
              toPlayer.x * Math.cos(angle) - toPlayer.z * Math.sin(angle),
              0,
              toPlayer.x * Math.sin(angle) + toPlayer.z * Math.cos(angle)
            );
            
            enemy.velocity.set(
              flankDir.x * enemy.moveSpeed,
              0,
              flankDir.z * enemy.moveSpeed
            );
          }
        }
      } else {
        enemy.velocity.set(
          toPlayer.x * enemy.moveSpeed,
          0,
          toPlayer.z * enemy.moveSpeed
        );
      }
    } else {
      // Patrol in groups
      enemy.timeToDirectionChange -= deltaTime;
      if (enemy.timeToDirectionChange <= 0) {
        enemy.wanderAngle = Math.random() * Math.PI * 2;
        enemy.timeToDirectionChange = 2 + Math.random();
      }
      
      enemy.velocity.set(
        Math.cos(enemy.wanderAngle) * enemy.moveSpeed * 0.7,
        0,
        Math.sin(enemy.wanderAngle) * enemy.moveSpeed * 0.7
      );
    }
  }
  
  private updateImp(enemy: Enemy, deltaTime: number): void {
    if (enemy.isChasing) {
      // Imps are territorial - chase briefly then give up
      const toPlayer = new THREE.Vector3()
        .subVectors(this.playerPosition, enemy.position)
        .normalize();
      
      enemy.velocity.set(
        toPlayer.x * enemy.moveSpeed,
        0,
        toPlayer.z * enemy.moveSpeed
      );
    } else {
      // Territorial patrol pattern
      enemy.timeToDirectionChange -= deltaTime;
      if (enemy.timeToDirectionChange <= 0) {
        enemy.wanderAngle = Math.random() * Math.PI * 2;
        enemy.timeToDirectionChange = 1.5 + Math.random();
      }
      
      // Smaller wander radius for imps
      const wanderSpeed = enemy.moveSpeed * 0.6;
      enemy.velocity.set(
        Math.cos(enemy.wanderAngle) * wanderSpeed,
        0,
        Math.sin(enemy.wanderAngle) * wanderSpeed
      );
    }
  }

  private updateBillboards(): void {
    const dummy = new THREE.Object3D();
    const cameraPos = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPos);
    
    let zombieIndex = 0;
    let goblinIndex = 0;
    let impIndex = 0;
    
    this.enemies.forEach(enemy => {
      // Calculate rotation to face camera
      const direction = new THREE.Vector3()
        .subVectors(cameraPos, enemy.position);
      direction.y = 0;
      direction.normalize();
      
      const rotation = Math.atan2(direction.x, direction.z);
      
      // Update instance matrix
      dummy.position.copy(enemy.position);
      dummy.rotation.set(0, rotation, 0);
      dummy.scale.copy(enemy.scale);
      dummy.updateMatrix();
      
      if (enemy.type === 'zombie' && this.zombieMesh) {
        this.zombieMesh.setMatrixAt(zombieIndex, dummy.matrix);
        enemy.billboardIndex = zombieIndex;
        zombieIndex++;
      } else if (enemy.type === 'goblin' && this.goblinMesh) {
        this.goblinMesh.setMatrixAt(goblinIndex, dummy.matrix);
        enemy.billboardIndex = goblinIndex;
        goblinIndex++;
      } else if (enemy.type === 'imp' && this.impMesh) {
        this.impMesh.setMatrixAt(impIndex, dummy.matrix);
        enemy.billboardIndex = impIndex;
        impIndex++;
      }
    });
    
    // Update instance counts and mark for update
    if (this.zombieMesh) {
      this.zombieMesh.count = zombieIndex;
      this.zombieMesh.instanceMatrix.needsUpdate = true;
    }
    
    if (this.goblinMesh) {
      this.goblinMesh.count = goblinIndex;
      this.goblinMesh.instanceMatrix.needsUpdate = true;
    }
    
    if (this.impMesh) {
      this.impMesh.count = impIndex;
      this.impMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private removeEnemy(id: string): void {
    const enemy = this.enemies.get(id);
    if (enemy) {
      this.enemies.delete(id);
      console.log(`💀 Removed ${enemy.type} (too far away)`);
    }
  }

  dispose(): void {
    // Clean up meshes
    if (this.zombieMesh) {
      this.scene.remove(this.zombieMesh);
      this.zombieMesh.dispose();
    }
    
    if (this.goblinMesh) {
      this.scene.remove(this.goblinMesh);
      this.goblinMesh.dispose();
    }
    
    if (this.impMesh) {
      this.scene.remove(this.impMesh);
      this.impMesh.dispose();
    }
    
    this.enemies.clear();
    console.log('🧹 Enemy System disposed');
  }

  // Public methods
  getEnemyCount(): number {
    return this.enemies.size;
  }

  getEnemiesNearPosition(position: THREE.Vector3, radius: number): Enemy[] {
    const nearbyEnemies: Enemy[] = [];
    this.enemies.forEach(enemy => {
      if (enemy.position.distanceTo(position) <= radius) {
        nearbyEnemies.push(enemy);
      }
    });
    return nearbyEnemies;
  }

  private getTerrainHeight(x: number, z: number): number {
    // Use chunk manager to get terrain height if available
    if (this.chunkManager) {
      return this.chunkManager.getHeightAt(x, z);
    }
    // Fallback to flat ground
    return 0;
  }

  setChunkManager(chunkManager: ImprovedChunkManager): void {
    this.chunkManager = chunkManager;
  }
}