import * as THREE from 'three';
import { GameSystem, EnemyState, BillboardInstance } from '../types';
import { MathUtils } from '../utils/Math';
import { BillboardSystem } from './Billboard';
import { Terrain } from './Terrain';

export class EnemyAI implements GameSystem {
  private enemies: Map<string, EnemyState> = new Map();
  private billboardSystem: BillboardSystem;
  private terrain: Terrain;
  private enemyTexture?: THREE.Texture;

  constructor(billboardSystem: BillboardSystem, terrain: Terrain) {
    this.billboardSystem = billboardSystem;
    this.terrain = terrain;
  }

  async init(): Promise<void> {
    // EnemyAI will be initialized when texture and spawn points are provided
  }

  update(deltaTime: number): void {
    this.updateEnemies(deltaTime);
  }

  dispose(): void {
    this.enemies.clear();
  }

  initializeEnemies(enemyTexture: THREE.Texture, spawnPoints: THREE.Vector3[]): void {
    this.enemyTexture = enemyTexture;
    
    console.log(`👹 ENEMY INITIALIZATION DEBUG:`);
    console.log(`- Enemy texture:`, enemyTexture);
    console.log(`- Spawn points received: ${spawnPoints.length}`);
    
    // Create billboard type for enemies
    this.billboardSystem.createBillboardType('imp', enemyTexture, spawnPoints.length, 1.5, 2);

    console.log(`Initializing ${spawnPoints.length} enemies...`);

    let successfullyAdded = 0;
    // Create enemy instances
    spawnPoints.forEach((spawnPoint, index) => {
      const enemyId = `enemy_${index}`;
      
      console.log(`Creating enemy ${index} at position:`, spawnPoint);
      
      const enemyState: EnemyState = {
        id: enemyId,
        position: spawnPoint.clone(),
        velocity: new THREE.Vector3(),
        wanderTarget: this.generateWanderTarget(spawnPoint),
        wanderTimer: MathUtils.randomInRange(2, 5),
        speed: MathUtils.randomInRange(1, 3)
      };

      this.enemies.set(enemyId, enemyState);

      // Create billboard instance
      const billboardInstance: BillboardInstance = {
        position: enemyState.position.clone(),
        scale: new THREE.Vector3(
          MathUtils.randomInRange(0.8, 1.2),
          MathUtils.randomInRange(0.9, 1.1),
          1
        ),
        rotation: 0,
        velocity: enemyState.velocity
      };

      const index_result = this.billboardSystem.addInstance('imp', billboardInstance);
      if (index_result >= 0) successfullyAdded++;
      console.log(`Enemy ${index} added to billboard system with index: ${index_result}`);
    });

    console.log(`✅ Initialized ${this.enemies.size} enemy states`);
    console.log(`✅ Added ${successfullyAdded} enemies to billboard system`);
    console.log(`Final imp count: ${this.billboardSystem.getInstanceCount('imp')}`);
  }

  private updateEnemies(deltaTime: number): void {
    let enemyIndex = 0;
    
    this.enemies.forEach((enemy) => {
      this.updateEnemyBehavior(enemy, deltaTime);
      this.updateEnemyMovement(enemy, deltaTime);
      this.updateBillboardPosition(enemy, enemyIndex);
      enemyIndex++;
    });
  }

  private updateEnemyBehavior(enemy: EnemyState, deltaTime: number): void {
    enemy.wanderTimer -= deltaTime;

    // Check if reached target or timer expired
    const distanceToTarget = enemy.position.distanceTo(enemy.wanderTarget);
    if (distanceToTarget < 2 || enemy.wanderTimer <= 0) {
      // Generate new wander target
      enemy.wanderTarget = this.generateWanderTarget(enemy.position);
      enemy.wanderTimer = MathUtils.randomInRange(3, 8);
      
      // Occasionally pause
      if (Math.random() < 0.3) {
        enemy.wanderTimer += MathUtils.randomInRange(1, 3);
        enemy.velocity.set(0, 0, 0);
        return;
      }
    }

    // Calculate direction to wander target
    const direction = enemy.wanderTarget.clone().sub(enemy.position);
    direction.y = 0; // Keep movement horizontal
    direction.normalize();

    // Apply some randomness to movement
    const randomFactor = 0.3;
    direction.x += MathUtils.randomInRange(-randomFactor, randomFactor);
    direction.z += MathUtils.randomInRange(-randomFactor, randomFactor);
    direction.normalize();

    // Set velocity
    enemy.velocity.copy(direction.multiplyScalar(enemy.speed));
  }

  private updateEnemyMovement(enemy: EnemyState, deltaTime: number): void {
    // Apply movement
    const movement = enemy.velocity.clone().multiplyScalar(deltaTime);
    const newPosition = enemy.position.clone().add(movement);

    // Keep within terrain bounds
    const terrainSize = this.terrain.getSize();
    const halfSize = terrainSize / 2 - 10;
    newPosition.x = MathUtils.clamp(newPosition.x, -halfSize, halfSize);
    newPosition.z = MathUtils.clamp(newPosition.z, -halfSize, halfSize);

    // Update height based on terrain
    newPosition.y = this.terrain.getHeightAt(newPosition.x, newPosition.z) + 1; // Enemy height above ground

    enemy.position.copy(newPosition);
  }

  private updateBillboardPosition(enemy: EnemyState, index: number): void {
    const billboardInstance = this.billboardSystem.getInstance('imp', index);
    if (billboardInstance) {
      billboardInstance.position.copy(enemy.position);
      billboardInstance.velocity = enemy.velocity;
      this.billboardSystem.updateInstance('imp', index, billboardInstance);
    }
  }

  private generateWanderTarget(currentPosition: THREE.Vector3): THREE.Vector3 {
    const wanderRadius = MathUtils.randomInRange(5, 15);
    const angle = MathUtils.randomInRange(0, Math.PI * 2);
    
    const target = new THREE.Vector3(
      currentPosition.x + Math.cos(angle) * wanderRadius,
      currentPosition.y,
      currentPosition.z + Math.sin(angle) * wanderRadius
    );

    // Ensure target is within terrain bounds
    const terrainSize = this.terrain.getSize();
    const halfSize = terrainSize / 2 - 10;
    target.x = MathUtils.clamp(target.x, -halfSize, halfSize);
    target.z = MathUtils.clamp(target.z, -halfSize, halfSize);
    target.y = this.terrain.getHeightAt(target.x, target.z);

    return target;
  }

  getEnemyCount(): number {
    return this.enemies.size;
  }

  getEnemyById(id: string): EnemyState | undefined {
    return this.enemies.get(id);
  }

  getAllEnemies(): EnemyState[] {
    return Array.from(this.enemies.values());
  }

  getEnemiesInRadius(center: THREE.Vector3, radius: number): EnemyState[] {
    return Array.from(this.enemies.values()).filter(enemy => 
      enemy.position.distanceTo(center) <= radius
    );
  }

  removeEnemy(id: string): void {
    this.enemies.delete(id);
    // Note: In a full implementation, you'd also need to remove from billboard system
    // This would require more complex index management
  }
}