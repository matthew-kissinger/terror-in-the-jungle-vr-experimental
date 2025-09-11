import * as THREE from 'three';
import { GameSystem, BillboardInstance } from '../types';
import { GlobalBillboardSystem } from './GlobalBillboardSystem';
import { AssetLoader } from './AssetLoader';
import { ImprovedChunkManager } from './ImprovedChunkManager';

interface Enemy {
  id: string;
  type: 'imp' | 'attacker';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  scale: THREE.Vector3;
  wanderAngle: number;
  timeToDirectionChange: number;
  billboardIndex?: number;
}

export class EnemySystem implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private globalBillboardSystem: GlobalBillboardSystem;
  private assetLoader: AssetLoader;
  private chunkManager?: ImprovedChunkManager;
  
  private enemies: Map<string, Enemy> = new Map();
  private impMesh?: THREE.InstancedMesh;
  private attackerMesh?: THREE.InstancedMesh;
  private nextEnemyId = 0;
  
  // Spawn settings
  private readonly MAX_ENEMIES = 20;
  private readonly SPAWN_RADIUS = 30;
  private readonly MIN_SPAWN_DISTANCE = 15;
  private readonly WANDER_RADIUS = 40;
  private readonly ENEMY_SPEED = 8;
  
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
    const impTexture = this.assetLoader.getTexture('imp');
    const attackerTexture = this.assetLoader.getTexture('attacker');
    
    if (!impTexture || !attackerTexture) {
      console.warn('⚠️ Enemy textures not found');
      return;
    }
    
    // Create imp billboard type
    const impGeometry = new THREE.PlaneGeometry(6, 6); // Size for enemies
    const impMaterial = new THREE.MeshBasicMaterial({
      map: impTexture,
      transparent: true,
      alphaTest: 0.5,  // Discard pixels with alpha < 0.5
      side: THREE.DoubleSide,
      depthWrite: true  // Write to depth buffer
    });
    
    this.impMesh = new THREE.InstancedMesh(impGeometry, impMaterial, this.MAX_ENEMIES);
    this.impMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.impMesh.frustumCulled = false;
    this.impMesh.count = 0;
    this.impMesh.renderOrder = 1;  // Render after terrain but before other transparent objects
    this.scene.add(this.impMesh);
    
    // Create attacker billboard type
    const attackerGeometry = new THREE.PlaneGeometry(7, 7); // Slightly bigger
    const attackerMaterial = new THREE.MeshBasicMaterial({
      map: attackerTexture,
      transparent: true,
      alphaTest: 0.5,  // Discard pixels with alpha < 0.5
      side: THREE.DoubleSide,
      depthWrite: true  // Write to depth buffer
    });
    
    this.attackerMesh = new THREE.InstancedMesh(attackerGeometry, attackerMaterial, this.MAX_ENEMIES);
    this.attackerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.attackerMesh.frustumCulled = false;
    this.attackerMesh.count = 0;
    this.attackerMesh.renderOrder = 1;  // Render after terrain but before other transparent objects
    this.scene.add(this.attackerMesh);
  }

  private spawnInitialEnemies(): void {
    // Spawn a mix of enemies around origin
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const distance = this.MIN_SPAWN_DISTANCE + Math.random() * 10;
      
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = this.getTerrainHeight(x, z) + 3; // Get terrain height + offset
      
      const position = new THREE.Vector3(x, y, z);
      
      const type = Math.random() > 0.5 ? 'imp' : 'attacker';
      this.spawnEnemy(position, type);
    }
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
      
      const type = Math.random() > 0.6 ? 'attacker' : 'imp';
      this.spawnEnemy(position, type);
    }
  }

  private spawnEnemy(position: THREE.Vector3, type: 'imp' | 'attacker'): void {
    const id = `enemy_${this.nextEnemyId++}`;
    
    const enemy: Enemy = {
      id,
      type,
      position: position.clone(),
      velocity: new THREE.Vector3(),
      rotation: Math.random() * Math.PI * 2,
      scale: new THREE.Vector3(1, 1, 1),
      wanderAngle: Math.random() * Math.PI * 2,
      timeToDirectionChange: Math.random() * 3
    };
    
    this.enemies.set(id, enemy);
    console.log(`👹 Spawned ${type} at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
  }

  private updateEnemy(enemy: Enemy, deltaTime: number): void {
    // Update wander behavior
    enemy.timeToDirectionChange -= deltaTime;
    
    if (enemy.timeToDirectionChange <= 0) {
      // Change direction - loosely follow player with randomness
      const toPlayer = new THREE.Vector3()
        .subVectors(this.playerPosition, enemy.position)
        .normalize();
      
      // Add random wander to the direction
      const wanderX = (Math.random() - 0.5) * 2;
      const wanderZ = (Math.random() - 0.5) * 2;
      
      // Mix player direction with wander (70% wander, 30% follow)
      enemy.velocity.set(
        toPlayer.x * 0.3 + wanderX * 0.7,
        0,
        toPlayer.z * 0.3 + wanderZ * 0.7
      ).normalize().multiplyScalar(this.ENEMY_SPEED);
      
      enemy.timeToDirectionChange = 2 + Math.random() * 3; // Change direction every 2-5 seconds
    }
    
    // Update position
    const movement = enemy.velocity.clone().multiplyScalar(deltaTime);
    enemy.position.add(movement);
    
    // Keep enemies within wander radius of player
    const distanceToPlayer = enemy.position.distanceTo(this.playerPosition);
    if (distanceToPlayer > this.WANDER_RADIUS) {
      // Pull back towards player
      const pullDirection = new THREE.Vector3()
        .subVectors(this.playerPosition, enemy.position)
        .normalize()
        .multiplyScalar(this.ENEMY_SPEED * 0.5);
      enemy.position.add(pullDirection.multiplyScalar(deltaTime));
    }
    
    // Follow terrain height with bobbing animation
    const terrainHeight = this.getTerrainHeight(enemy.position.x, enemy.position.z);
    const bobHeight = Math.sin(Date.now() * 0.002 + enemy.wanderAngle) * 0.5;
    enemy.position.y = terrainHeight + 3 + bobHeight; // Terrain + offset + bob
  }

  private updateBillboards(): void {
    const dummy = new THREE.Object3D();
    const cameraPos = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPos);
    
    let impIndex = 0;
    let attackerIndex = 0;
    
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
      
      if (enemy.type === 'imp' && this.impMesh) {
        this.impMesh.setMatrixAt(impIndex, dummy.matrix);
        enemy.billboardIndex = impIndex;
        impIndex++;
      } else if (enemy.type === 'attacker' && this.attackerMesh) {
        this.attackerMesh.setMatrixAt(attackerIndex, dummy.matrix);
        enemy.billboardIndex = attackerIndex;
        attackerIndex++;
      }
    });
    
    // Update instance counts and mark for update
    if (this.impMesh) {
      this.impMesh.count = impIndex;
      this.impMesh.instanceMatrix.needsUpdate = true;
    }
    
    if (this.attackerMesh) {
      this.attackerMesh.count = attackerIndex;
      this.attackerMesh.instanceMatrix.needsUpdate = true;
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
    if (this.impMesh) {
      this.scene.remove(this.impMesh);
      this.impMesh.dispose();
    }
    
    if (this.attackerMesh) {
      this.scene.remove(this.attackerMesh);
      this.attackerMesh.dispose();
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