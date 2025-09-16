import * as THREE from 'three';
import { Combatant, CombatantState, Faction, Squad } from './types';
import { ImprovedChunkManager } from '../terrain/ImprovedChunkManager';
import { ZoneManager } from '../world/ZoneManager';

export class CombatantMovement {
  private chunkManager?: ImprovedChunkManager;
  private zoneManager?: ZoneManager;

  constructor(chunkManager?: ImprovedChunkManager, zoneManager?: ZoneManager) {
    this.chunkManager = chunkManager;
    this.zoneManager = zoneManager;
  }

  updateMovement(
    combatant: Combatant,
    deltaTime: number,
    squads: Map<string, Squad>,
    combatants: Map<string, Combatant>
  ): void {
    // Movement based on state
    if (combatant.state === CombatantState.PATROLLING) {
      this.updatePatrolMovement(combatant, deltaTime, squads, combatants);
    } else if (combatant.state === CombatantState.ENGAGING) {
      this.updateCombatMovement(combatant, deltaTime);
    }

    // Apply velocity
    combatant.position.add(combatant.velocity.clone().multiplyScalar(deltaTime));

    // Keep on terrain
    const terrainHeight = this.getTerrainHeight(combatant.position.x, combatant.position.z);
    combatant.position.y = terrainHeight + 3;
  }

  private updatePatrolMovement(
    combatant: Combatant,
    deltaTime: number,
    squads: Map<string, Squad>,
    combatants: Map<string, Combatant>
  ): void {
    // Squad movement for followers
    if (combatant.squadId && combatant.squadRole === 'follower') {
      const squad = squads.get(combatant.squadId);
      if (squad && squad.leaderId) {
        const leader = combatants.get(squad.leaderId);
        if (leader && leader.id !== combatant.id) {
          const toLeader = new THREE.Vector3()
            .subVectors(leader.position, combatant.position);

          if (toLeader.length() > 6) {
            toLeader.normalize();
            combatant.velocity.set(
              toLeader.x * 3,
              0,
              toLeader.z * 3
            );
            combatant.rotation = Math.atan2(toLeader.z, toLeader.x);
            return;
          }
        }
      }
    }

    // Leaders: head toward nearest capturable zone
    if (combatant.squadRole === 'leader' && this.zoneManager) {
      const targetZone = this.zoneManager.getNearestCapturableZone(
        combatant.position,
        combatant.faction
      );
      if (targetZone) {
        const toZone = new THREE.Vector3().subVectors(targetZone.position, combatant.position);
        const distance = toZone.length();
        toZone.normalize();
        const speed = distance > 5 ? 4 : 0;
        combatant.velocity.set(toZone.x * speed, 0, toZone.z * speed);
        if (speed > 0.1) combatant.rotation = Math.atan2(toZone.z, toZone.x);
        return;
      }
    }

    // Fallback: advance toward enemy territory
    if (combatant.squadRole === 'leader') {
      const enemyBasePos = combatant.faction === Faction.US ?
        new THREE.Vector3(0, 0, 145) : // OPFOR base
        new THREE.Vector3(0, 0, -50); // US base

      const toEnemyBase = new THREE.Vector3()
        .subVectors(enemyBasePos, combatant.position)
        .normalize();

      combatant.velocity.set(
        toEnemyBase.x * 3,
        0,
        toEnemyBase.z * 3
      );
      combatant.rotation = Math.atan2(toEnemyBase.z, toEnemyBase.x);
    } else {
      // Followers: limited wander near leader
      combatant.timeToDirectionChange -= deltaTime;
      if (combatant.timeToDirectionChange <= 0) {
        combatant.wanderAngle = Math.random() * Math.PI * 2;
        combatant.timeToDirectionChange = 2 + Math.random() * 2;
      }

      combatant.velocity.set(
        Math.cos(combatant.wanderAngle) * 2,
        0,
        Math.sin(combatant.wanderAngle) * 2
      );
    }

    // Update rotation to match movement direction
    if (combatant.velocity.length() > 0.1) {
      combatant.rotation = Math.atan2(combatant.velocity.z, combatant.velocity.x);
    }
  }

  private updateCombatMovement(combatant: Combatant, deltaTime: number): void {
    if (!combatant.target) return;

    const toTarget = new THREE.Vector3()
      .subVectors(combatant.target.position, combatant.position);
    const distance = toTarget.length();
    toTarget.normalize();

    const idealEngagementDistance = 30;

    if (distance > idealEngagementDistance + 10) {
      // Move closer
      combatant.velocity.copy(toTarget).multiplyScalar(3);
    } else if (distance < idealEngagementDistance - 10) {
      // Back up
      combatant.velocity.copy(toTarget).multiplyScalar(-2);
    } else {
      // Strafe
      const strafeAngle = Math.sin(Date.now() * 0.001) * 0.5;
      const strafeDirection = new THREE.Vector3(-toTarget.z, 0, toTarget.x);
      combatant.velocity.copy(strafeDirection).multiplyScalar(strafeAngle * 2);
    }
  }

  updateRotation(combatant: Combatant, deltaTime: number): void {
    // Smooth rotation interpolation
    let rotationDifference = combatant.rotation - combatant.visualRotation;

    // Normalize to -PI to PI range
    while (rotationDifference > Math.PI) rotationDifference -= Math.PI * 2;
    while (rotationDifference < -Math.PI) rotationDifference += Math.PI * 2;

    // Apply smooth interpolation with velocity for natural movement
    const rotationAcceleration = rotationDifference * 15; // Spring constant
    const rotationDamping = combatant.rotationVelocity * 10; // Damping

    combatant.rotationVelocity += (rotationAcceleration - rotationDamping) * deltaTime;
    combatant.visualRotation += combatant.rotationVelocity * deltaTime;

    // Normalize visual rotation
    while (combatant.visualRotation > Math.PI * 2) combatant.visualRotation -= Math.PI * 2;
    while (combatant.visualRotation < 0) combatant.visualRotation += Math.PI * 2;
  }

  private getTerrainHeight(x: number, z: number): number {
    if (this.chunkManager) {
      const height = this.chunkManager.getHeightAt(x, z);
      // If chunk isn't loaded, use a reasonable default height
      if (height === 0 && (Math.abs(x) > 50 || Math.abs(z) > 50)) {
        return 5; // Assume flat terrain at y=5 for unloaded chunks
      }
      return height;
    }
    return 5; // Default terrain height
  }

  setChunkManager(chunkManager: ImprovedChunkManager): void {
    this.chunkManager = chunkManager;
  }

  setZoneManager(zoneManager: ZoneManager): void {
    this.zoneManager = zoneManager;
  }
}