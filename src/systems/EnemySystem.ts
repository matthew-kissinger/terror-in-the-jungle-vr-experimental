import * as THREE from 'three';
import { GameSystem, BillboardInstance } from '../types';
import { GlobalBillboardSystem } from './GlobalBillboardSystem';
import { AssetLoader } from './AssetLoader';
import { ImprovedChunkManager } from './ImprovedChunkManager';

interface Enemy {
  id: string;
  type: 'zombie' | 'goblin' | 'imp' | 'ghast' | 'soldier';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  scale: THREE.Vector3;
  wanderAngle: number;
  timeToDirectionChange: number;
  billboardIndex?: number;
  // Faction-specific properties
  hordeId?: string; // For zombies
  packId?: string;  // For goblins and soldiers
  packRole?: 'leader' | 'follower'; // For goblins and soldiers
  detectionRadius: number;
  moveSpeed: number;
  isChasing: boolean;
  lastKnownPlayerPos?: THREE.Vector3;
  // Flying properties
  isFlying?: boolean;
  targetHeight?: number;
  floatPhase?: number; // For sinusoidal floating motion
  // Soldier specific
  soldierState?: 'walking' | 'alert' | 'firing';
  alertTimer?: number;
  hasLineOfSight?: boolean;
  currentTexture?: THREE.Texture;
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
  private ghastMesh?: THREE.InstancedMesh;
  private soldierMeshes: Map<string, THREE.InstancedMesh> = new Map(); // One mesh per soldier state
  private soldierTextures: Map<string, THREE.Texture> = new Map();
  private nextEnemyId = 0;
  private nextHordeId = 0;
  private nextPackId = 0;
  
  // Group tracking
  private hordes: Map<string, string[]> = new Map(); // hordeId -> enemyIds
  private packs: Map<string, string[]> = new Map();  // packId -> enemyIds
  
  // Spawn settings
  private readonly MAX_ENEMIES = 60; // Increased for more soldiers
  private readonly SPAWN_RADIUS = 60;  // Increased spawn radius
  private readonly MIN_SPAWN_DISTANCE = 20;
  private readonly DESPAWN_DISTANCE = 120;  // Much larger despawn distance
  private readonly WANDER_RADIUS = 40;
  
  // Speed settings by type
  private readonly ZOMBIE_SPEED = 3;
  private readonly GOBLIN_SPEED = 7;
  private readonly IMP_SPEED = 5;
  private readonly GHAST_SPEED = 4;
  private readonly SOLDIER_SPEED_WALKING = 4;
  private readonly SOLDIER_SPEED_ALERT = 6;
  private readonly SOLDIER_SPEED_FIRING = 2; // Slower when aiming
  
  // Detection ranges
  private readonly ZOMBIE_DETECTION = 20;
  private readonly GOBLIN_DETECTION = 30;
  private readonly IMP_DETECTION = 15;
  private readonly GHAST_DETECTION = 40; // Can see far from the sky
  private readonly SOLDIER_DETECTION = 25;
  private readonly SOLDIER_FIRING_RANGE = 20; // Line of sight range
  
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
    const ghastTexture = this.assetLoader.getTexture('flying_monster');
    
    // Load soldier textures
    const soldierWalkingTexture = this.assetLoader.getTexture('SoliderWalking');
    const soldierAlertTexture = this.assetLoader.getTexture('SoldierAlert');
    const soldierFiringTexture = this.assetLoader.getTexture('SoliderFiring');
    
    if (soldierWalkingTexture) this.soldierTextures.set('walking', soldierWalkingTexture);
    if (soldierAlertTexture) this.soldierTextures.set('alert', soldierAlertTexture);
    if (soldierFiringTexture) this.soldierTextures.set('firing', soldierFiringTexture);
    
    if (!zombieTexture || !goblinTexture || !impTexture || !ghastTexture) {
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
      
      this.zombieMesh = new THREE.InstancedMesh(zombieGeometry, zombieMaterial, 50); // Increased capacity
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
      
      this.goblinMesh = new THREE.InstancedMesh(goblinGeometry, goblinMaterial, 30); // Increased capacity
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
      
      this.impMesh = new THREE.InstancedMesh(impGeometry, impMaterial, 30); // Increased capacity
      this.impMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.impMesh.frustumCulled = false;
      this.impMesh.count = 0;
      this.impMesh.renderOrder = 1;
      this.scene.add(this.impMesh);
    }
    
    // Create ghast (flying monster) billboard type
    if (ghastTexture) {
      const ghastGeometry = new THREE.PlaneGeometry(10, 10); // Bigger for flying enemy
      const ghastMaterial = new THREE.MeshBasicMaterial({
        map: ghastTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: true
      });
      
      this.ghastMesh = new THREE.InstancedMesh(ghastGeometry, ghastMaterial, 10);
      this.ghastMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.ghastMesh.frustumCulled = false;
      this.ghastMesh.count = 0;
      this.ghastMesh.renderOrder = 2; // Render above other enemies
      this.scene.add(this.ghastMesh);
    }
    
    // Create soldier billboard types - one mesh per state for efficiency
    if (soldierWalkingTexture && soldierAlertTexture && soldierFiringTexture) {
      const soldierGeometry = new THREE.PlaneGeometry(5, 7);
      
      // Walking state mesh
      const walkingMaterial = new THREE.MeshBasicMaterial({
        map: soldierWalkingTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: true
      });
      const walkingMesh = new THREE.InstancedMesh(soldierGeometry, walkingMaterial, 30);
      walkingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      walkingMesh.frustumCulled = false;
      walkingMesh.count = 0;
      walkingMesh.renderOrder = 1;
      this.scene.add(walkingMesh);
      this.soldierMeshes.set('walking', walkingMesh);
      
      // Alert state mesh
      const alertMaterial = new THREE.MeshBasicMaterial({
        map: soldierAlertTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: true
      });
      const alertMesh = new THREE.InstancedMesh(soldierGeometry, alertMaterial, 30);
      alertMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      alertMesh.frustumCulled = false;
      alertMesh.count = 0;
      alertMesh.renderOrder = 1;
      this.scene.add(alertMesh);
      this.soldierMeshes.set('alert', alertMesh);
      
      // Firing state mesh
      const firingMaterial = new THREE.MeshBasicMaterial({
        map: soldierFiringTexture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: true
      });
      const firingMesh = new THREE.InstancedMesh(soldierGeometry, firingMaterial, 30);
      firingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      firingMesh.frustumCulled = false;
      firingMesh.count = 0;
      firingMesh.renderOrder = 1;
      this.scene.add(firingMesh);
      this.soldierMeshes.set('firing', firingMesh);
      
      console.log('🪖 Soldier meshes created for all states');
    }
  }

  private spawnInitialEnemies(): void {
    // Spawn soldier squads - primary enemy type
    this.spawnSoldierSquad(new THREE.Vector3(20, 0, 20));
    this.spawnSoldierSquad(new THREE.Vector3(-25, 0, 15));
    this.spawnSoldierSquad(new THREE.Vector3(15, 0, -20));
    
    // Spawn reduced zombie hordes
    this.spawnZombieHorde(new THREE.Vector3(30, 0, 30));
    
    // Spawn reduced goblin pack
    this.spawnGoblinPack(new THREE.Vector3(-30, 0, -25));
    
    // Spawn fewer individual imps
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 15 + Math.random() * 20;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = this.getTerrainHeight(x, z) + 3;
      this.spawnEnemy(new THREE.Vector3(x, y, z), 'imp');
    }
    
    // Spawn single flying ghast
    const angle = Math.random() * Math.PI * 2;
    const distance = 25 + Math.random() * 25;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const y = 35 + Math.random() * 15; // High in the sky
    this.spawnEnemy(new THREE.Vector3(x, y, z), 'ghast');
    
    console.log('🪖 Terror in the Jungle: Initial forces deployed');
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
  
  private spawnSoldierSquad(centerPos: THREE.Vector3): void {
    const squadId = `squad_${this.nextPackId++}`;
    const squadSize = Math.floor(Math.random() * 3) + 3; // 3-5 soldiers
    const enemyIds: string[] = [];
    
    for (let i = 0; i < squadSize; i++) {
      // Formation spread
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        0,
        (Math.random() - 0.5) * 10
      );
      const position = centerPos.clone().add(offset);
      position.y = this.getTerrainHeight(position.x, position.z) + 3;
      const packRole = i === 0 ? 'leader' : 'follower';
      const enemyId = this.spawnEnemy(position, 'soldier', { packId: squadId, packRole });
      if (enemyId) enemyIds.push(enemyId);
    }
    
    this.packs.set(squadId, enemyIds);
    console.log(`🪖 Deployed soldier squad ${squadId} with ${squadSize} soldiers`);
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
      if (distance > this.DESPAWN_DISTANCE) {  // Use much larger despawn distance
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
      
      // Spawn different enemy types with adjusted probabilities
      const rand = Math.random();
      if (rand < 0.45) {
        // 45% chance: Spawn soldier squad (primary enemy)
        this.spawnSoldierSquad(position);
        break; // Only spawn one group at a time
      } else if (rand < 0.6) {
        // 15% chance: Spawn zombie horde
        this.spawnZombieHorde(position);
        break;
      } else if (rand < 0.75) {
        // 15% chance: Spawn goblin pack
        this.spawnGoblinPack(position);
        break;
      } else if (rand < 0.9) {
        // 15% chance: Spawn individual imp
        this.spawnEnemy(position, 'imp');
      } else {
        // 10% chance: Spawn flying ghast high in the sky
        const ghastY = 30 + Math.random() * 25;
        position.y = ghastY;
        this.spawnEnemy(position, 'ghast');
      }
    }
  }

  private spawnEnemy(position: THREE.Vector3, type: 'zombie' | 'goblin' | 'imp' | 'ghast' | 'soldier', groupData?: { hordeId?: string; packId?: string; packRole?: 'leader' | 'follower' }): string {
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
      case 'ghast':
        moveSpeed = this.GHAST_SPEED;
        detectionRadius = this.GHAST_DETECTION;
        break;
      case 'soldier':
        moveSpeed = this.SOLDIER_SPEED_WALKING;
        detectionRadius = this.SOLDIER_DETECTION;
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
      isFlying: type === 'ghast',
      targetHeight: type === 'ghast' ? position.y : undefined,
      floatPhase: type === 'ghast' ? Math.random() * Math.PI * 2 : undefined,
      soldierState: type === 'soldier' ? 'walking' : undefined,
      alertTimer: type === 'soldier' ? 0 : undefined,
      hasLineOfSight: false,
      currentTexture: type === 'soldier' ? this.soldierTextures.get('walking') : undefined,
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
      case 'ghast':
        this.updateGhast(enemy, deltaTime);
        break;
      case 'soldier':
        this.updateSoldier(enemy, deltaTime);
        break;
    }
    
    // Apply velocity
    enemy.position.add(enemy.velocity.clone().multiplyScalar(deltaTime));
    
    // Keep enemy on terrain (unless flying)
    if (!enemy.isFlying) {
      const terrainHeight = this.getTerrainHeight(enemy.position.x, enemy.position.z);
      enemy.position.y = terrainHeight + 3;
    }
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
  
  private updateGhast(enemy: Enemy, deltaTime: number): void {
    // Update float phase for sinusoidal motion
    if (enemy.floatPhase !== undefined) {
      enemy.floatPhase += deltaTime * 2; // Gentle floating speed
    }
    
    // Ghast-like behavior: slow floating movement with height changes
    if (enemy.isChasing && enemy.position.distanceTo(this.playerPosition) < enemy.detectionRadius) {
      // Float towards player but maintain height advantage
      const toPlayer = new THREE.Vector3()
        .subVectors(this.playerPosition, enemy.position);
      
      // Only move horizontally towards player
      const horizontalDir = new THREE.Vector3(toPlayer.x, 0, toPlayer.z).normalize();
      
      // Try to stay above player
      const desiredHeight = this.playerPosition.y + 20 + Math.sin(enemy.floatPhase || 0) * 5;
      const heightDiff = desiredHeight - enemy.position.y;
      
      enemy.velocity.set(
        horizontalDir.x * enemy.moveSpeed * 0.7,
        heightDiff * 0.5, // Gentle vertical movement
        horizontalDir.z * enemy.moveSpeed * 0.7
      );
    } else {
      // Wander in 3D space like Minecraft ghasts
      enemy.timeToDirectionChange -= deltaTime;
      
      if (enemy.timeToDirectionChange <= 0) {
        // Pick new random direction including vertical
        enemy.wanderAngle = Math.random() * Math.PI * 2;
        enemy.targetHeight = 25 + Math.random() * 30; // Random height between 25-55
        enemy.timeToDirectionChange = 3 + Math.random() * 3; // Change direction every 3-6 seconds
      }
      
      // Move towards target position
      const heightDiff = (enemy.targetHeight || 40) - enemy.position.y;
      
      // Add floating bob motion
      const floatOffset = Math.sin(enemy.floatPhase || 0) * 0.3;
      
      enemy.velocity.set(
        Math.cos(enemy.wanderAngle) * enemy.moveSpeed * 0.5,
        heightDiff * 0.3 + floatOffset, // Gentle height adjustment with bob
        Math.sin(enemy.wanderAngle) * enemy.moveSpeed * 0.5
      );
    }
    
    // Keep ghasts from going too low or too high
    if (enemy.position.y < 20) {
      enemy.velocity.y = Math.abs(enemy.velocity.y);
      enemy.targetHeight = 30 + Math.random() * 20;
    } else if (enemy.position.y > 60) {
      enemy.velocity.y = -Math.abs(enemy.velocity.y);
      enemy.targetHeight = 25 + Math.random() * 15;
    }
  }
  
  private updateSoldier(enemy: Enemy, deltaTime: number): void {
    const distanceToPlayer = enemy.position.distanceTo(this.playerPosition);
    
    // Check line of sight (simplified - just check distance and no obstacles)
    const hasLOS = distanceToPlayer <= this.SOLDIER_FIRING_RANGE;
    enemy.hasLineOfSight = hasLOS;
    
    // State machine for soldiers
    switch (enemy.soldierState) {
      case 'walking':
        // Patrol behavior
        if (distanceToPlayer <= enemy.detectionRadius) {
          // Transition to alert
          enemy.soldierState = 'alert';
          enemy.alertTimer = 0;
          enemy.currentTexture = this.soldierTextures.get('alert');
          enemy.moveSpeed = this.SOLDIER_SPEED_ALERT;
          
          // Alert squad members
          if (enemy.packId) {
            const squadMembers = this.packs.get(enemy.packId);
            if (squadMembers) {
              squadMembers.forEach(id => {
                const squadMate = this.enemies.get(id);
                if (squadMate && squadMate.type === 'soldier' && squadMate.soldierState === 'walking') {
                  squadMate.soldierState = 'alert';
                  squadMate.alertTimer = 0;
                  squadMate.currentTexture = this.soldierTextures.get('alert');
                  squadMate.moveSpeed = this.SOLDIER_SPEED_ALERT;
                }
              });
            }
          }
        } else {
          // Patrol in formation
          enemy.timeToDirectionChange -= deltaTime;
          if (enemy.timeToDirectionChange <= 0) {
            enemy.wanderAngle = Math.random() * Math.PI * 2;
            enemy.timeToDirectionChange = 3 + Math.random() * 2;
          }
          
          enemy.velocity.set(
            Math.cos(enemy.wanderAngle) * enemy.moveSpeed,
            0,
            Math.sin(enemy.wanderAngle) * enemy.moveSpeed
          );
        }
        break;
        
      case 'alert':
        enemy.alertTimer! += deltaTime;
        
        // Check for line of sight
        if (hasLOS && enemy.alertTimer! > 0.5) { // Small delay before firing
          // Transition to firing
          enemy.soldierState = 'firing';
          enemy.currentTexture = this.soldierTextures.get('firing');
          enemy.moveSpeed = this.SOLDIER_SPEED_FIRING;
        } else if (distanceToPlayer > enemy.detectionRadius * 1.5) {
          // Lost target, return to patrol
          enemy.soldierState = 'walking';
          enemy.currentTexture = this.soldierTextures.get('walking');
          enemy.moveSpeed = this.SOLDIER_SPEED_WALKING;
        } else {
          // Move towards player quickly
          const toPlayer = new THREE.Vector3()
            .subVectors(this.playerPosition, enemy.position)
            .normalize();
          
          // Squad tactics - spread out when approaching
          if (enemy.packRole === 'follower' && enemy.packId) {
            const offset = Math.PI / 6 * (Math.random() > 0.5 ? 1 : -1);
            const spreadDir = new THREE.Vector3(
              toPlayer.x * Math.cos(offset) - toPlayer.z * Math.sin(offset),
              0,
              toPlayer.x * Math.sin(offset) + toPlayer.z * Math.cos(offset)
            );
            enemy.velocity.set(
              spreadDir.x * enemy.moveSpeed,
              0,
              spreadDir.z * enemy.moveSpeed
            );
          } else {
            enemy.velocity.set(
              toPlayer.x * enemy.moveSpeed,
              0,
              toPlayer.z * enemy.moveSpeed
            );
          }
        }
        break;
        
      case 'firing':
        // Face player and fire
        const toPlayerFiring = new THREE.Vector3()
          .subVectors(this.playerPosition, enemy.position)
          .normalize();
        
        // Slow movement while firing
        enemy.velocity.set(
          toPlayerFiring.x * enemy.moveSpeed * 0.3,
          0,
          toPlayerFiring.z * enemy.moveSpeed * 0.3
        );
        
        // Check if should stop firing
        if (!hasLOS) {
          // Lost line of sight, go back to alert
          enemy.soldierState = 'alert';
          enemy.currentTexture = this.soldierTextures.get('alert');
          enemy.moveSpeed = this.SOLDIER_SPEED_ALERT;
          enemy.alertTimer = 0;
        } else if (distanceToPlayer > enemy.detectionRadius * 1.5) {
          // Target too far, return to walking
          enemy.soldierState = 'walking';
          enemy.currentTexture = this.soldierTextures.get('walking');
          enemy.moveSpeed = this.SOLDIER_SPEED_WALKING;
        }
        break;
    }
  }

  private updateBillboards(): void {
    const dummy = new THREE.Object3D();
    const cameraPos = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPos);
    
    let zombieIndex = 0;
    let goblinIndex = 0;
    let impIndex = 0;
    let ghastIndex = 0;
    let skippedZombies = 0;
    
    // Track soldier indices per state
    const soldierIndices = new Map<string, number>();
    soldierIndices.set('walking', 0);
    soldierIndices.set('alert', 0);
    soldierIndices.set('firing', 0);
    
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
        if (zombieIndex < 50) {
          this.zombieMesh.setMatrixAt(zombieIndex, dummy.matrix);
          enemy.billboardIndex = zombieIndex;
          zombieIndex++;
        } else {
          skippedZombies++;
        }
      } else if (enemy.type === 'goblin' && this.goblinMesh && goblinIndex < 30) { // Check capacity
        this.goblinMesh.setMatrixAt(goblinIndex, dummy.matrix);
        enemy.billboardIndex = goblinIndex;
        goblinIndex++;
      } else if (enemy.type === 'imp' && this.impMesh && impIndex < 30) { // Check capacity
        this.impMesh.setMatrixAt(impIndex, dummy.matrix);
        enemy.billboardIndex = impIndex;
        impIndex++;
      } else if (enemy.type === 'ghast' && this.ghastMesh && ghastIndex < 10) { // Check capacity
        this.ghastMesh.setMatrixAt(ghastIndex, dummy.matrix);
        enemy.billboardIndex = ghastIndex;
        ghastIndex++;
      } else if (enemy.type === 'soldier' && enemy.soldierState) {
        const stateMesh = this.soldierMeshes.get(enemy.soldierState);
        const stateIndex = soldierIndices.get(enemy.soldierState) || 0;
        
        if (stateMesh && stateIndex < 30) { // Check capacity
          stateMesh.setMatrixAt(stateIndex, dummy.matrix);
          enemy.billboardIndex = stateIndex;
          soldierIndices.set(enemy.soldierState, stateIndex + 1);
        }
      }
    });
    
    // Update instance counts and mark for update
    if (this.zombieMesh) {
      this.zombieMesh.count = zombieIndex;
      this.zombieMesh.instanceMatrix.needsUpdate = true;
      if (skippedZombies > 0) {
        console.warn(`⚠️ Skipped rendering ${skippedZombies} zombies (exceeded capacity)`);
      }
    }
    
    if (this.goblinMesh) {
      this.goblinMesh.count = goblinIndex;
      this.goblinMesh.instanceMatrix.needsUpdate = true;
    }
    
    if (this.impMesh) {
      this.impMesh.count = impIndex;
      this.impMesh.instanceMatrix.needsUpdate = true;
    }
    
    if (this.ghastMesh) {
      this.ghastMesh.count = ghastIndex;
      this.ghastMesh.instanceMatrix.needsUpdate = true;
    }
    
    // Update soldier meshes for each state
    this.soldierMeshes.forEach((mesh, state) => {
      const count = soldierIndices.get(state) || 0;
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    });
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
    
    if (this.ghastMesh) {
      this.scene.remove(this.ghastMesh);
      this.ghastMesh.dispose();
    }
    
    // Clean up soldier meshes
    this.soldierMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.dispose();
    });
    this.soldierMeshes.clear();
    this.soldierTextures.clear();
    
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