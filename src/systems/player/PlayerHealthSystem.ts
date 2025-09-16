import * as THREE from 'three';
import { GameSystem } from '../../types';
import { Faction } from '../combat/types';
import { ZoneManager } from '../world/ZoneManager';
import { TicketSystem } from '../world/TicketSystem';
import { PlayerHealthUI } from './PlayerHealthUI';
import { PlayerHealthEffects } from './PlayerHealthEffects';
import { PlayerRespawnManager } from './PlayerRespawnManager';

export interface PlayerState {
  health: number;
  maxHealth: number;
  isAlive: boolean;
  isDead: boolean;
  deathTime: number;
  respawnTime: number;
  invulnerabilityTime: number;
}

export class PlayerHealthSystem implements GameSystem {
  private playerState: PlayerState = {
    health: 150,
    maxHealth: 150,
    isAlive: true,
    isDead: false,
    deathTime: 0,
    respawnTime: 3.0,
    invulnerabilityTime: 0
  };

  private healthRegenDelay = 5.0;
  private lastDamageTime = 0;
  private readonly healthRegenRate = 20;

  // Modules
  private ui: PlayerHealthUI;
  private effects: PlayerHealthEffects;
  private respawnManager: PlayerRespawnManager;

  constructor() {
    this.ui = new PlayerHealthUI();
    this.effects = new PlayerHealthEffects();
    this.respawnManager = new PlayerRespawnManager();

    this.setupCallbacks();
  }

  private setupCallbacks(): void {
    // Setup respawn callbacks
    this.respawnManager.setRespawnCallback((position: THREE.Vector3) => {
      this.playerState.health = this.playerState.maxHealth;
      this.playerState.isAlive = true;
      this.playerState.isDead = false;
      this.playerState.invulnerabilityTime = 0;

      this.effects.clearDamageIndicators();
      this.ui.hideDeathScreen();
      this.updateHealthDisplay();
      this.effects.stopHeartbeat();
    });

    this.respawnManager.setDeathCallback(() => {
      this.ui.showDeathScreen();
    });

    // Setup UI button callbacks
    const spawnBaseBtn = this.ui.getSpawnBaseButton();
    if (spawnBaseBtn) {
      spawnBaseBtn.addEventListener('click', () => this.respawnManager.respawnAtBase());
    }
  }

  async init(): Promise<void> {
    console.log('❤️ Initializing Player Health System...');

    this.ui.init();
    this.effects.init();
    this.updateHealthDisplay();

    console.log('✅ Player Health System initialized');
  }

  update(deltaTime: number): void {
    if (this.playerState.isDead) {
      this.updateDeathState(deltaTime);
      return;
    }

    // Update invulnerability
    if (this.playerState.invulnerabilityTime > 0) {
      this.playerState.invulnerabilityTime -= deltaTime;
      if (this.playerState.invulnerabilityTime <= 0) {
        this.ui.setSpawnProtection(false);
        console.log('🛡️ Spawn protection ended');
      }
    }

    // Health regeneration
    const timeSinceLastDamage = (Date.now() - this.lastDamageTime) / 1000;
    if (timeSinceLastDamage > this.healthRegenDelay && this.playerState.health < this.playerState.maxHealth) {
      this.playerState.health = Math.min(
        this.playerState.maxHealth,
        this.playerState.health + this.healthRegenRate * deltaTime
      );
      this.updateHealthDisplay();
    }

    // Update effects
    this.effects.updateDamageIndicators(deltaTime);
    this.updateLowHealthEffects();
    this.effects.renderDamageOverlay(this.playerState.health, this.playerState.maxHealth);
  }

  private updateHealthDisplay(): void {
    this.ui.updateHealthDisplay(this.playerState.health, this.playerState.maxHealth);
  }

  private updateLowHealthEffects(): void {
    const isLowHealth = this.playerState.health < 30;
    this.ui.setLowHealthEffect(isLowHealth);

    if (isLowHealth) {
      this.effects.startHeartbeat();
    } else {
      this.effects.stopHeartbeat();
    }
  }

  private updateDeathState(deltaTime: number): void {
    this.playerState.deathTime -= deltaTime;
    this.ui.updateDeathTimer(this.playerState.deathTime);

    if (this.playerState.deathTime <= 0) {
      const spawnables = this.respawnManager.getSpawnableZones();
      this.ui.updateSpawnZonesList(
        spawnables,
        (zoneId: string) => this.respawnManager.respawnAtSpecificZone(zoneId)
      );
      this.ui.enableSpawnButtons();
    }
  }

  // Public API

  takeDamage(amount: number, sourcePosition?: THREE.Vector3, playerPosition?: THREE.Vector3): boolean {
    if (this.playerState.isDead || this.playerState.invulnerabilityTime > 0) {
      return false;
    }

    this.playerState.health = Math.max(0, this.playerState.health - amount);
    this.lastDamageTime = Date.now();

    console.log(`💥 Player took ${amount} damage, health: ${Math.round(this.playerState.health)}`);

    // Add damage effects
    this.effects.addDamageIndicator(amount, sourcePosition, playerPosition);

    // Check for death
    if (this.playerState.health <= 0) {
      this.onPlayerDeath();
      return true;
    }

    this.updateHealthDisplay();
    return false;
  }

  private onPlayerDeath(): void {
    if (this.playerState.isDead) return;

    this.playerState.isAlive = false;
    this.playerState.isDead = true;
    this.playerState.deathTime = this.playerState.respawnTime;

    this.respawnManager.onPlayerDeath();
    this.effects.stopHeartbeat();
  }

  // Getters

  getHealth(): number {
    return this.playerState.health;
  }

  getMaxHealth(): number {
    return this.playerState.maxHealth;
  }

  isAlive(): boolean {
    return this.playerState.isAlive;
  }

  isDead(): boolean {
    return this.playerState.isDead;
  }

  hasSpawnProtection(): boolean {
    return this.playerState.invulnerabilityTime > 0;
  }

  // System connections

  setZoneManager(manager: ZoneManager): void {
    this.respawnManager.setZoneManager(manager);
  }

  setTicketSystem(system: TicketSystem): void {
    this.respawnManager.setTicketSystem(system);
  }

  setPlayerController(playerController: any): void {
    this.respawnManager.setPlayerController(playerController);
  }

  setFirstPersonWeapon(weapon: any): void {
    this.respawnManager.setFirstPersonWeapon(weapon);
  }

  dispose(): void {
    this.ui.dispose();
    this.effects.dispose();
    console.log('🧹 Player Health System disposed');
  }
}