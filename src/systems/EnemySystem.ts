import * as THREE from 'three';
import { GameSystem, BillboardInstance } from '../types';
import { GlobalBillboardSystem } from './GlobalBillboardSystem';
import { AssetLoader } from './AssetLoader';
import { ImprovedChunkManager } from './ImprovedChunkManager';

interface Enemy {
  id: string;
  type: 'soldier';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  scale: THREE.Vector3;
  wanderAngle: number;
  timeToDirectionChange: number;
  billboardIndex?: number;
  packId?: string;  // For soldier squads
  packRole?: 'leader' | 'follower';
  detectionRadius: number;
  moveSpeed: number;
  isChasing: boolean;
  lastKnownPlayerPos?: THREE.Vector3;
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
  private soldierMeshes: Map<string, THREE.InstancedMesh> = new Map(); // One mesh per soldier state
  private soldierTextures: Map<string, THREE.Texture> = new Map();
  private nextEnemyId = 0;
  private nextPackId = 0;
  
  // Group tracking
  private packs: Map<string, string[]> = new Map();  // packId -> enemyIds (for soldier squads)
  
  // Spawn settings
  private readonly MAX_ENEMIES = 60; // Increased for more soldiers
  private readonly SPAWN_RADIUS = 60;  // Increased spawn radius
  private readonly MIN_SPAWN_DISTANCE = 20;
  private readonly DESPAWN_DISTANCE = 120;  // Much larger despawn distance
  private readonly WANDER_RADIUS = 40;
  
  // Speed settings for soldiers
  private readonly SOLDIER_SPEED_WALKING = 4;
  private readonly SOLDIER_SPEED_ALERT = 6;
  private readonly SOLDIER_SPEED_FIRING = 2; // Slower when aiming
  
  // Detection ranges
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
    console.log('🪖 Initializing Soldier Enemy System...');
    
    // Create enemy billboard types
    await this.createEnemyBillboards();
    
    // Spawn initial enemies
    this.spawnInitialEnemies();
    
    console.log('✅ Soldier Enemy System initialized');
  }

  private async createEnemyBillboards(): Promise<void> {
    // Load soldier textures
    const soldierWalkingTexture = this.assetLoader.getTexture('SoliderWalking');
    const soldierAlertTexture = this.assetLoader.getTexture('SoldierAlert');
    const soldierFiringTexture = this.assetLoader.getTexture('SoliderFiring');
    
    if (soldierWalkingTexture) this.soldierTextures.set('walking', soldierWalkingTexture);
    if (soldierAlertTexture) this.soldierTextures.set('alert', soldierAlertTexture);
    if (soldierFiringTexture) this.soldierTextures.set('firing', soldierFiringTexture);
    
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
    this.spawnSoldierSquad(new THREE.Vector3(30, 0, -30));
    this.spawnSoldierSquad(new THREE.Vector3(-30, 0, 25));
    
    console.log('🪖 Terror in the Jungle: Initial soldier forces deployed');
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
      const enemyId = this.spawnEnemy(position, { packId: squadId, packRole });
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
    
    // Spawn new enemies if needed - only soldiers now
    while (this.enemies.size < this.MAX_ENEMIES) {
      const angle = Math.random() * Math.PI * 2;
      const distance = this.MIN_SPAWN_DISTANCE + Math.random() * (this.SPAWN_RADIUS - this.MIN_SPAWN_DISTANCE);
      
      const x = this.playerPosition.x + Math.cos(angle) * distance;
      const z = this.playerPosition.z + Math.sin(angle) * distance;
      const y = this.getTerrainHeight(x, z) + 3;
      
      const position = new THREE.Vector3(x, y, z);
      
      // Always spawn soldier squads
      this.spawnSoldierSquad(position);
      break; // Only spawn one group at a time
    }
  }

  private spawnEnemy(position: THREE.Vector3, groupData?: { packId?: string; packRole?: 'leader' | 'follower' }): string {
    const id = `enemy_${this.nextEnemyId++}`;
    
    const enemy: Enemy = {
      id,
      type: 'soldier',
      position: position.clone(),
      velocity: new THREE.Vector3(),
      rotation: Math.random() * Math.PI * 2,
      scale: new THREE.Vector3(1, 1, 1),
      wanderAngle: Math.random() * Math.PI * 2,
      timeToDirectionChange: Math.random() * 3,
      moveSpeed: this.SOLDIER_SPEED_WALKING,
      detectionRadius: this.SOLDIER_DETECTION,
      isChasing: false,
      soldierState: 'walking',
      alertTimer: 0,
      hasLineOfSight: false,
      currentTexture: this.soldierTextures.get('walking'),
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
    
    // Update soldier behavior
    this.updateSoldier(enemy, deltaTime);
    
    // Apply velocity
    enemy.position.add(enemy.velocity.clone().multiplyScalar(deltaTime));
    
    // Keep enemy on terrain
    const terrainHeight = this.getTerrainHeight(enemy.position.x, enemy.position.z);
    enemy.position.y = terrainHeight + 3;
  }
  
  private updateSoldier(enemy: Enemy, deltaTime: number): void {
    const distanceToPlayer = enemy.position.distanceTo(this.playerPosition);
    
    // Check line of sight for state transitions
    enemy.hasLineOfSight = this.checkLineOfSight(enemy.position, this.playerPosition);
    
    // State machine for soldier behavior
    if (enemy.soldierState === 'walking') {
      // Walking/patrolling state
      if (distanceToPlayer < enemy.detectionRadius && enemy.hasLineOfSight) {
        // Transition to alert
        enemy.soldierState = 'alert';
        enemy.alertTimer = 1.5; // Alert for 1.5 seconds before firing
        enemy.currentTexture = this.soldierTextures.get('alert');
        enemy.moveSpeed = this.SOLDIER_SPEED_ALERT;
        console.log(`🪖 Soldier ${enemy.id} spotted player!`);
      } else {
        // Patrol behavior
        if (enemy.packId && enemy.packRole === 'follower') {
          // Follow leader
          const pack = this.packs.get(enemy.packId);
          if (pack) {
            const leaderId = pack[0];
            const leader = this.enemies.get(leaderId);
            if (leader && leader.id !== enemy.id) {
              const toLeader = new THREE.Vector3()
                .subVectors(leader.position, enemy.position);
              
              if (toLeader.length() > 5) {
                toLeader.normalize();
                enemy.velocity.set(
                  toLeader.x * enemy.moveSpeed,
                  0,
                  toLeader.z * enemy.moveSpeed
                );
              } else {
                // Stay close to leader but wander a bit
                enemy.velocity.set(
                  Math.cos(enemy.wanderAngle) * enemy.moveSpeed * 0.3,
                  0,
                  Math.sin(enemy.wanderAngle) * enemy.moveSpeed * 0.3
                );
              }
            }
          }
        } else {
          // Leader or solo patrol
          enemy.timeToDirectionChange -= deltaTime;
          if (enemy.timeToDirectionChange <= 0) {
            enemy.wanderAngle = Math.random() * Math.PI * 2;
            enemy.timeToDirectionChange = 2 + Math.random() * 2;
          }
          
          enemy.velocity.set(
            Math.cos(enemy.wanderAngle) * enemy.moveSpeed,
            0,
            Math.sin(enemy.wanderAngle) * enemy.moveSpeed
          );
        }
      }
    } else if (enemy.soldierState === 'alert') {
      // Alert state - preparing to fire
      enemy.alertTimer! -= deltaTime;
      
      // Move towards player cautiously
      const toPlayer = new THREE.Vector3()
        .subVectors(this.playerPosition, enemy.position)
        .normalize();
      
      enemy.velocity.set(
        toPlayer.x * enemy.moveSpeed,
        0,
        toPlayer.z * enemy.moveSpeed
      );
      
      if (enemy.alertTimer! <= 0) {
        if (distanceToPlayer < this.SOLDIER_FIRING_RANGE && enemy.hasLineOfSight) {
          // Transition to firing
          enemy.soldierState = 'firing';
          enemy.currentTexture = this.soldierTextures.get('firing');
          enemy.moveSpeed = this.SOLDIER_SPEED_FIRING;
          console.log(`🪖 Soldier ${enemy.id} opening fire!`);
        } else {
          // Lost target, go back to walking
          enemy.soldierState = 'walking';
          enemy.currentTexture = this.soldierTextures.get('walking');
          enemy.moveSpeed = this.SOLDIER_SPEED_WALKING;
        }
      }
    } else if (enemy.soldierState === 'firing') {
      // Firing state
      if (distanceToPlayer > this.SOLDIER_FIRING_RANGE || !enemy.hasLineOfSight) {
        // Target out of range or lost sight
        enemy.soldierState = 'alert';
        enemy.alertTimer = 1.0;
        enemy.currentTexture = this.soldierTextures.get('alert');
        enemy.moveSpeed = this.SOLDIER_SPEED_ALERT;
      } else {
        // Continue firing - strafe while shooting
        const toPlayer = new THREE.Vector3()
          .subVectors(this.playerPosition, enemy.position)
          .normalize();
        
        // Strafe movement
        const strafeAngle = Math.sin(Date.now() * 0.002) * 0.5;
        const strafeDir = new THREE.Vector3(
          -toPlayer.z * strafeAngle,
          0,
          toPlayer.x * strafeAngle
        );
        
        enemy.velocity.set(
          (toPlayer.x * 0.3 + strafeDir.x) * enemy.moveSpeed,
          0,
          (toPlayer.z * 0.3 + strafeDir.z) * enemy.moveSpeed
        );
      }
    }
  }
  
  private checkLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    // Simple line of sight check - could be enhanced with raycasting
    const distance = from.distanceTo(to);
    
    // Check if there's terrain blocking (simplified)
    const steps = Math.ceil(distance / 5);
    const direction = new THREE.Vector3().subVectors(to, from).normalize();
    
    for (let i = 1; i < steps; i++) {
      const checkPoint = from.clone().add(direction.clone().multiplyScalar(i * 5));
      const terrainHeight = this.getTerrainHeight(checkPoint.x, checkPoint.z);
      
      // If terrain is significantly higher than the line between enemies and player
      if (terrainHeight > checkPoint.y + 5) {
        return false;
      }
    }
    
    return true;
  }

  private updateBillboards(): void {
    // Reset all counts
    this.soldierMeshes.forEach(mesh => mesh.count = 0);
    
    // Group enemies by soldier state
    const soldiersByState = new Map<string, Enemy[]>();
    soldiersByState.set('walking', []);
    soldiersByState.set('alert', []);
    soldiersByState.set('firing', []);
    
    this.enemies.forEach(enemy => {
      if (enemy.type === 'soldier' && enemy.soldierState) {
        soldiersByState.get(enemy.soldierState)!.push(enemy);
      }
    });
    
    // Update each soldier state mesh
    soldiersByState.forEach((soldiers, state) => {
      const mesh = this.soldierMeshes.get(state);
      if (!mesh || soldiers.length === 0) return;
      
      const matrix = new THREE.Matrix4();
      const cameraDirection = new THREE.Vector3();
      this.camera.getWorldDirection(cameraDirection);
      const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z);
      
      soldiers.forEach((enemy, index) => {
        // Make billboard face camera
        const rotation = cameraAngle;
        
        matrix.makeRotationY(rotation);
        matrix.setPosition(enemy.position);
        
        const scaleMatrix = new THREE.Matrix4().makeScale(
          enemy.scale.x,
          enemy.scale.y,
          enemy.scale.z
        );
        matrix.multiply(scaleMatrix);
        
        mesh.setMatrixAt(index, matrix);
        enemy.billboardIndex = index;
      });
      
      mesh.count = soldiers.length;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  private removeEnemy(id: string): void {
    const enemy = this.enemies.get(id);
    if (!enemy) return;
    
    // Remove from pack if part of one
    if (enemy.packId) {
      const pack = this.packs.get(enemy.packId);
      if (pack) {
        const index = pack.indexOf(id);
        if (index > -1) {
          pack.splice(index, 1);
        }
        // Remove pack if empty
        if (pack.length === 0) {
          this.packs.delete(enemy.packId);
        }
      }
    }
    
    this.enemies.delete(id);
  }

  private getTerrainHeight(x: number, z: number): number {
    if (this.chunkManager) {
      return this.chunkManager.getHeightAt(x, z);
    }
    return 0;
  }

  getEnemyCount(): number {
    return this.enemies.size;
  }

  setChunkManager(chunkManager: ImprovedChunkManager): void {
    this.chunkManager = chunkManager;
  }

  dispose(): void {
    // Clean up meshes
    this.soldierMeshes.forEach(mesh => {
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
      this.scene.remove(mesh);
    });
    
    this.soldierMeshes.clear();
    this.soldierTextures.clear();
    this.enemies.clear();
    this.packs.clear();
  }
}