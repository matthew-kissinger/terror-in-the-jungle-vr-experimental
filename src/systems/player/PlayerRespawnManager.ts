import * as THREE from 'three';
import { Faction } from '../combat/types';
import { ZoneManager, ZoneState } from '../world/ZoneManager';
import { TicketSystem } from '../world/TicketSystem';
import { PlayerState } from './PlayerHealthSystem';

export class PlayerRespawnManager {
  private zoneManager?: ZoneManager;
  private ticketSystem?: TicketSystem;
  private playerController?: any;
  private firstPersonWeapon?: any;

  private onRespawnCallback?: (position: THREE.Vector3) => void;
  private onDeathCallback?: () => void;

  setZoneManager(manager: ZoneManager): void {
    this.zoneManager = manager;
  }

  setTicketSystem(system: TicketSystem): void {
    this.ticketSystem = system;
  }

  setPlayerController(controller: any): void {
    this.playerController = controller;
  }

  setFirstPersonWeapon(weapon: any): void {
    this.firstPersonWeapon = weapon;
  }

  setRespawnCallback(callback: (position: THREE.Vector3) => void): void {
    this.onRespawnCallback = callback;
  }

  setDeathCallback(callback: () => void): void {
    this.onDeathCallback = callback;
  }

  getSpawnableZones(): Array<{ id: string; name: string; position: THREE.Vector3 }> {
    if (!this.zoneManager) {
      return [];
    }

    const zones = this.zoneManager
      .getAllZones()
      .filter(z => z.owner === Faction.US && !z.isHomeBase);

    console.log(`🚩 Found ${zones.length} spawnable zones:`, zones.map(z => `${z.name} (${z.state})`));

    return zones.map(z => ({
      id: z.id,
      name: z.name,
      position: z.position.clone()
    }));
  }

  canSpawnAtZone(): boolean {
    if (!this.zoneManager) return false;

    const zones = this.zoneManager.getAllZones();
    return zones.some(zone => zone.state === ZoneState.US_CONTROLLED && !zone.isHomeBase);
  }

  respawnAtBase(): void {
    if (!this.zoneManager) {
      this.respawn(new THREE.Vector3(0, 5, -50));
      return;
    }

    const usBase = this.zoneManager.getAllZones().find(
      z => z.id === 'us_base' || (z.isHomeBase && z.owner === Faction.US)
    );

    const basePos = usBase ? usBase.position.clone() : new THREE.Vector3(0, 5, -50);
    basePos.y = 5;
    this.respawn(basePos);
  }

  respawnAtSpecificZone(zoneId: string): void {
    if (!this.zoneManager) return;

    const zone = this.zoneManager.getAllZones().find(z => z.id === zoneId);
    if (!zone) return;

    const target = zone.position.clone().add(new THREE.Vector3(5, 2, 5));
    this.respawn(target);
  }

  private respawn(position: THREE.Vector3): void {
    // Move player to spawn position
    if (this.playerController) {
      if (typeof this.playerController.setPosition === 'function') {
        this.playerController.setPosition(position);
      }
      if (typeof this.playerController.enableControls === 'function') {
        this.playerController.enableControls();
      }
    }

    // Re-enable weapon
    if (this.firstPersonWeapon && typeof this.firstPersonWeapon.enable === 'function') {
      this.firstPersonWeapon.enable();
    }

    console.log(`🏥 Player respawned at ${position.x}, ${position.y}, ${position.z}`);

    // Trigger callback
    if (this.onRespawnCallback) {
      this.onRespawnCallback(position);
    }
  }

  onPlayerDeath(): void {
    console.log('💀 Player eliminated!');

    // Disable player controls
    if (this.playerController && typeof this.playerController.disableControls === 'function') {
      this.playerController.disableControls();
    }

    // Hide weapon
    if (this.firstPersonWeapon && typeof this.firstPersonWeapon.disable === 'function') {
      this.firstPersonWeapon.disable();
    }

    // Notify ticket system
    if (this.ticketSystem) {
      this.ticketSystem.onCombatantDeath(Faction.US);
    }

    // Trigger callback
    if (this.onDeathCallback) {
      this.onDeathCallback();
    }
  }
}