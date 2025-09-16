import * as THREE from 'three';
import { Combatant, CombatantState, Faction } from './types';

export class CombatantHitDetection {
  private readonly MAX_ENGAGEMENT_RANGE = 150;
  private readonly FRIENDLY_FIRE_ENABLED = false;

  checkPlayerHit(
    ray: THREE.Ray,
    playerPosition: THREE.Vector3
  ): { hit: boolean; point: THREE.Vector3; headshot: boolean } {
    const playerHitZones = [
      { offset: new THREE.Vector3(0, 0.0, 0), radius: 0.35, isHead: true },
      { offset: new THREE.Vector3(0.2, -1.1, 0), radius: 0.65, isHead: false },
      { offset: new THREE.Vector3(0, -2.1, 0), radius: 0.55, isHead: false },
      { offset: new THREE.Vector3(-0.2, -3.1, 0), radius: 0.35, isHead: false },
      { offset: new THREE.Vector3(0.2, -3.1, 0), radius: 0.35, isHead: false }
    ];

    const tmp = new THREE.Vector3();

    for (const zone of playerHitZones) {
      const zoneCenter = playerPosition.clone().add(zone.offset);
      const toCenter = tmp.subVectors(zoneCenter, ray.origin);
      const t = toCenter.dot(ray.direction);

      if (t < 0 || t > this.MAX_ENGAGEMENT_RANGE) continue;

      const closestPoint = new THREE.Vector3()
        .copy(ray.origin)
        .addScaledVector(ray.direction, t);

      const distSq = closestPoint.distanceToSquared(zoneCenter);

      if (distSq <= zone.radius * zone.radius) {
        const hitDir = closestPoint.clone().sub(zoneCenter).normalize();
        const actualHitPoint = zoneCenter.clone().add(hitDir.multiplyScalar(zone.radius));

        return {
          hit: true,
          point: actualHitPoint,
          headshot: zone.isHead
        };
      }
    }

    return { hit: false, point: new THREE.Vector3(), headshot: false };
  }

  raycastCombatants(
    ray: THREE.Ray,
    shooterFaction: Faction,
    allCombatants: Map<string, Combatant>
  ): { combatant: Combatant; distance: number; point: THREE.Vector3; headshot: boolean } | null {
    let closest: { combatant: Combatant; distance: number; point: THREE.Vector3; headshot: boolean } | null = null;
    const tmp = new THREE.Vector3();

    allCombatants.forEach(combatant => {
      if (!this.FRIENDLY_FIRE_ENABLED && combatant.faction === shooterFaction) return;
      if (combatant.state === CombatantState.DEAD) return;

      const hitZones = this.getHitZonesForState(combatant.state);

      for (const zone of hitZones) {
        const zoneCenter = combatant.position.clone().add(zone.offset);
        const toCenter = tmp.subVectors(zoneCenter, ray.origin);
        const t = toCenter.dot(ray.direction);

        if (t < 0 || t > this.MAX_ENGAGEMENT_RANGE) continue;

        const closestPoint = new THREE.Vector3()
          .copy(ray.origin)
          .addScaledVector(ray.direction, t);

        const distSq = closestPoint.distanceToSquared(zoneCenter);

        if (distSq <= zone.radius * zone.radius) {
          const distance = t;

          if (!closest || distance < closest.distance) {
            const hitDir = closestPoint.clone().sub(zoneCenter).normalize();
            const actualHitPoint = zoneCenter.clone().add(hitDir.multiplyScalar(zone.radius));

            closest = {
              combatant,
              distance,
              point: actualHitPoint,
              headshot: zone.isHead
            };
            break;
          }
        }
      }
    });

    return closest;
  }

  private getHitZonesForState(state: CombatantState): Array<{ offset: THREE.Vector3; radius: number; isHead: boolean }> {
    if (state === CombatantState.ENGAGING || state === CombatantState.SUPPRESSING) {
      return [
        { offset: new THREE.Vector3(0, 2.5, 0), radius: 0.3, isHead: true },
        { offset: new THREE.Vector3(0.2, 1.4, 0), radius: 0.65, isHead: false },
        { offset: new THREE.Vector3(0, 0.4, 0), radius: 0.5, isHead: false },
        { offset: new THREE.Vector3(-0.2, -0.6, 0), radius: 0.35, isHead: false },
        { offset: new THREE.Vector3(0.2, -0.6, 0), radius: 0.35, isHead: false }
      ];
    } else if (state === CombatantState.ALERT) {
      return [
        { offset: new THREE.Vector3(0, 2.7, 0), radius: 0.35, isHead: true },
        { offset: new THREE.Vector3(0, 1.5, 0), radius: 0.65, isHead: false },
        { offset: new THREE.Vector3(0, 0.5, 0), radius: 0.55, isHead: false },
        { offset: new THREE.Vector3(-0.35, -0.8, 0), radius: 0.4, isHead: false },
        { offset: new THREE.Vector3(0.35, -0.8, 0), radius: 0.4, isHead: false }
      ];
    } else {
      return [
        { offset: new THREE.Vector3(0, 2.8, 0), radius: 0.35, isHead: true },
        { offset: new THREE.Vector3(0, 1.5, 0), radius: 0.6, isHead: false },
        { offset: new THREE.Vector3(0, 0.5, 0), radius: 0.55, isHead: false },
        { offset: new THREE.Vector3(-0.3, -0.8, 0), radius: 0.4, isHead: false },
        { offset: new THREE.Vector3(0.3, -0.8, 0), radius: 0.4, isHead: false }
      ];
    }
  }
}