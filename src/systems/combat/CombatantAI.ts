import * as THREE from 'three';
import { Combatant, CombatantState, Faction } from './types';

export class CombatantAI {
  private readonly FRIENDLY_FIRE_ENABLED = false;
  private readonly MAX_ENGAGEMENT_RANGE = 150;

  updateAI(
    combatant: Combatant,
    deltaTime: number,
    playerPosition: THREE.Vector3,
    allCombatants: Map<string, Combatant>
  ): void {
    switch (combatant.state) {
      case CombatantState.PATROLLING:
        this.handlePatrolling(combatant, deltaTime, playerPosition, allCombatants);
        break;
      case CombatantState.ALERT:
        this.handleAlert(combatant, deltaTime, playerPosition);
        break;
      case CombatantState.ENGAGING:
        this.handleEngaging(combatant, deltaTime, playerPosition, allCombatants);
        break;
      case CombatantState.SUPPRESSING:
        this.handleSuppressing(combatant, deltaTime);
        break;
    }
  }

  private handlePatrolling(
    combatant: Combatant,
    deltaTime: number,
    playerPosition: THREE.Vector3,
    allCombatants: Map<string, Combatant>
  ): void {
    const enemy = this.findNearestEnemy(combatant, playerPosition, allCombatants);
    if (enemy) {
      const targetPos = enemy.id === 'PLAYER' ? playerPosition : enemy.position;
      const toTarget = new THREE.Vector3().subVectors(targetPos, combatant.position).normalize();
      combatant.rotation = Math.atan2(toTarget.z, toTarget.x);

      if (this.canSeeTarget(combatant, enemy, playerPosition)) {
        combatant.state = CombatantState.ALERT;
        combatant.target = enemy;
        combatant.reactionTimer = combatant.skillProfile.reactionDelayMs / 1000;
        combatant.alertTimer = 1.5;
        console.log(`🎯 ${combatant.faction} soldier spotted enemy!`);
      }
    }
  }

  private handleAlert(
    combatant: Combatant,
    deltaTime: number,
    playerPosition: THREE.Vector3
  ): void {
    combatant.alertTimer -= deltaTime;
    combatant.reactionTimer -= deltaTime;

    if (combatant.reactionTimer <= 0 && combatant.target) {
      const targetPos = combatant.target.id === 'PLAYER' ? playerPosition : combatant.target.position;
      const toTarget = new THREE.Vector3().subVectors(targetPos, combatant.position).normalize();
      combatant.rotation = Math.atan2(toTarget.z, toTarget.x);

      if (this.canSeeTarget(combatant, combatant.target, playerPosition)) {
        combatant.state = CombatantState.ENGAGING;
        combatant.currentBurst = 0;
        console.log(`🔫 ${combatant.faction} soldier engaging!`);
      } else {
        combatant.state = CombatantState.PATROLLING;
        combatant.target = null;
      }
    }
  }

  private handleEngaging(
    combatant: Combatant,
    deltaTime: number,
    playerPosition: THREE.Vector3,
    allCombatants: Map<string, Combatant>
  ): void {
    if (!combatant.target || combatant.target.state === CombatantState.DEAD) {
      combatant.state = CombatantState.PATROLLING;
      combatant.target = null;
      combatant.isFullAuto = false;
      return;
    }

    const targetPos = combatant.target.id === 'PLAYER' ? playerPosition : combatant.target.position;
    const toTargetDir = new THREE.Vector3().subVectors(targetPos, combatant.position).normalize();
    combatant.rotation = Math.atan2(toTargetDir.z, toTargetDir.x);

    const targetDistance = combatant.position.distanceTo(targetPos);
    combatant.isFullAuto = false;

    // Determine full auto conditions
    if (targetDistance < 15) {
      combatant.isFullAuto = true;
      combatant.skillProfile.burstLength = 8;
      combatant.skillProfile.burstPauseMs = 200;
    }

    const timeSinceHit = (Date.now() - combatant.lastHitTime) / 1000;
    if (timeSinceHit < 2.0) {
      combatant.panicLevel = Math.min(1.0, combatant.panicLevel + 0.3);
      if (combatant.panicLevel > 0.5) {
        combatant.isFullAuto = true;
        combatant.skillProfile.burstLength = 10;
        combatant.skillProfile.burstPauseMs = 150;
      }
    } else {
      combatant.panicLevel = Math.max(0, combatant.panicLevel - deltaTime * 0.2);
    }

    const nearbyEnemyCount = this.countNearbyEnemies(combatant, 20, playerPosition, allCombatants);
    if (nearbyEnemyCount > 2) {
      combatant.isFullAuto = true;
      combatant.skillProfile.burstLength = 6;
    }

    // Reset burst params if not full auto
    if (!combatant.isFullAuto) {
      const isLeader = combatant.squadRole === 'leader';
      if (combatant.faction === Faction.OPFOR) {
        combatant.skillProfile.burstLength = isLeader ? 4 : 3;
        combatant.skillProfile.burstPauseMs = isLeader ? 800 : 1000;
      } else {
        combatant.skillProfile.burstLength = 3;
        combatant.skillProfile.burstPauseMs = isLeader ? 900 : 1100;
      }
    }

    if (!this.canSeeTarget(combatant, combatant.target, playerPosition)) {
      combatant.lastKnownTargetPos = combatant.target.position.clone();
      combatant.state = CombatantState.SUPPRESSING;
      combatant.isFullAuto = true;
      combatant.skillProfile.burstLength = 12;
      combatant.skillProfile.burstPauseMs = 100;
      return;
    }

    combatant.lastKnownTargetPos = combatant.target.position.clone();
  }

  private handleSuppressing(combatant: Combatant, deltaTime: number): void {
    combatant.alertTimer -= deltaTime;

    if (combatant.alertTimer <= 0) {
      combatant.state = CombatantState.PATROLLING;
      combatant.target = null;
      combatant.lastKnownTargetPos = undefined;
    }
  }

  findNearestEnemy(
    combatant: Combatant,
    playerPosition: THREE.Vector3,
    allCombatants: Map<string, Combatant>
  ): Combatant | null {
    let nearestEnemy: Combatant | null = null;
    let minDistance = combatant.skillProfile.visualRange;

    // Check player first if OPFOR
    if (combatant.faction === Faction.OPFOR) {
      const playerDistance = combatant.position.distanceTo(playerPosition);
      if (playerDistance < combatant.skillProfile.visualRange) {
        return {
          id: 'PLAYER',
          faction: Faction.US,
          position: playerPosition.clone(),
          velocity: new THREE.Vector3(),
          state: CombatantState.ENGAGING,
          health: 100,
          maxHealth: 100
        } as Combatant;
      }
    }

    // Check other combatants
    allCombatants.forEach(other => {
      if (other.faction === combatant.faction) return;
      if (other.state === CombatantState.DEAD) return;

      const distance = combatant.position.distanceTo(other.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearestEnemy = other;
      }
    });

    return nearestEnemy;
  }

  canSeeTarget(
    combatant: Combatant,
    target: Combatant,
    playerPosition: THREE.Vector3
  ): boolean {
    const targetPos = target.id === 'PLAYER' ? playerPosition : target.position;
    const distance = combatant.position.distanceTo(targetPos);

    if (distance > combatant.skillProfile.visualRange) return false;

    // Check FOV
    const toTarget = new THREE.Vector3()
      .subVectors(targetPos, combatant.position)
      .normalize();

    const forward = new THREE.Vector3(
      Math.cos(combatant.rotation),
      0,
      Math.sin(combatant.rotation)
    );

    const angle = Math.acos(forward.dot(toTarget));
    const halfFov = THREE.MathUtils.degToRad(combatant.skillProfile.fieldOfView / 2);

    return angle <= halfFov;
  }

  private countNearbyEnemies(
    combatant: Combatant,
    radius: number,
    playerPosition: THREE.Vector3,
    allCombatants: Map<string, Combatant>
  ): number {
    let count = 0;

    if (combatant.faction === Faction.OPFOR) {
      if (combatant.position.distanceTo(playerPosition) < radius) {
        count++;
      }
    }

    allCombatants.forEach(other => {
      if (other.faction !== combatant.faction &&
          other.state !== CombatantState.DEAD &&
          other.position.distanceTo(combatant.position) < radius) {
        count++;
      }
    });

    return count;
  }
}