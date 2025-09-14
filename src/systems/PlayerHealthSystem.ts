import * as THREE from 'three';
import { GameSystem } from '../types';
import { Faction } from './CombatantSystem';
import { ZoneManager, ZoneState } from './ZoneManager';
import { TicketSystem } from './TicketSystem';

export interface DamageIndicator {
  direction: number; // Angle in radians where damage came from
  intensity: number; // Damage amount (0-1)
  timestamp: number; // When the damage occurred
  fadeTime: number; // How long to show indicator
}

export interface PlayerState {
  health: number;
  maxHealth: number;
  isAlive: boolean;
  isDead: boolean;
  deathTime: number;
  respawnTime: number;
  invulnerabilityTime: number; // Spawn protection
}

export class PlayerHealthSystem implements GameSystem {
  private playerState: PlayerState = {
    health: 100,
    maxHealth: 100,
    isAlive: true,
    isDead: false,
    deathTime: 0,
    respawnTime: 3.0, // 3 second respawn timer
    invulnerabilityTime: 3.0 // 3 second spawn protection
  };

  private damageIndicators: DamageIndicator[] = [];
  private healthRegenDelay = 5.0; // seconds before health starts regenerating
  private lastDamageTime = 0;
  private readonly healthRegenRate = 20; // HP per second when regenerating

  // Systems
  private zoneManager?: ZoneManager;
  private ticketSystem?: TicketSystem;
  private playerController?: any;

  // UI Elements
  private healthDisplay: HTMLDivElement;
  private damageOverlay: HTMLCanvasElement;
  private damageContext: CanvasRenderingContext2D;
  private deathScreen: HTMLDivElement;

  // Audio context for heartbeat effect
  private audioContext?: AudioContext;
  private heartbeatGain?: GainNode;
  private isPlayingHeartbeat = false;

  private readonly UI_STYLES = `
    .health-display {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(10, 10, 14, 0.35);
      backdrop-filter: blur(6px) saturate(1.1);
      -webkit-backdrop-filter: blur(6px) saturate(1.1);
      padding: 10px 14px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 10px;
      color: rgba(255, 255, 255, 0.95);
      font-family: 'Courier New', monospace;
      font-size: 16px;
      z-index: 200;
    }

    .health-bar {
      width: 260px;
      height: 14px;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      overflow: hidden;
      margin-top: 6px;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }

    .health-fill {
      height: 100%;
      background: linear-gradient(90deg, rgba(255,68,68,0.9) 0%, rgba(255,170,68,0.9) 50%, rgba(68,255,68,0.9) 100%);
      transition: width 0.3s ease;
      border-radius: 999px;
    }

    .damage-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 150;
    }

    .death-screen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      font-family: 'Courier New', monospace;
      z-index: 1000;
    }

    .death-title {
      font-size: 48px;
      color: #ff4444;
      margin-bottom: 20px;
      text-transform: uppercase;
    }

    .respawn-timer {
      font-size: 24px;
      margin: 20px 0;
    }

    .spawn-options {
      margin-top: 30px;
      text-align: center;
    }

    .spawn-button {
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 10px 20px;
      margin: 5px;
      border-radius: 5px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      transition: all 0.3s ease;
    }

    .spawn-button:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.5);
    }

    .spawn-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .low-health {
      animation: redPulse 1s infinite;
    }

    @keyframes redPulse {
      0%, 100% { box-shadow: 0 0 0 rgba(255, 68, 68, 0); }
      50% { box-shadow: 0 0 20px rgba(255, 68, 68, 0.6); }
    }

    .spawn-protection {
      animation: protectionPulse 0.5s infinite;
    }

    @keyframes protectionPulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1.0; }
    }

    .spawn-zones-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-top: 8px;
      max-width: 720px;
    }
    .spawn-zone-button {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.25);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-size: 13px;
    }
    .spawn-zone-button:hover { background: rgba(255, 255, 255, 0.15); }
  `;

  constructor() {
    // Create health display
    this.healthDisplay = document.createElement('div');
    this.healthDisplay.className = 'health-display';

    // Create damage overlay canvas
    this.damageOverlay = document.createElement('canvas');
    this.damageOverlay.className = 'damage-overlay';
    this.damageContext = this.damageOverlay.getContext('2d')!;

    // Create death screen
    this.deathScreen = document.createElement('div');
    this.deathScreen.className = 'death-screen';
    this.deathScreen.style.display = 'none';

    this.setupUI();
    this.setupAudio();

    // Add styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = this.UI_STYLES;
    document.head.appendChild(styleSheet);
  }

  async init(): Promise<void> {
    console.log('❤️ Initializing Player Health System...');

    // Add UI to DOM
    document.body.appendChild(this.healthDisplay);
    document.body.appendChild(this.damageOverlay);
    document.body.appendChild(this.deathScreen);

    // Set canvas size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

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
        this.healthDisplay.classList.remove('spawn-protection');
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

    // Update damage indicators
    this.updateDamageIndicators(deltaTime);

    // Update low health effects
    this.updateLowHealthEffects();

    // Render damage overlay
    this.renderDamageOverlay();
  }

  private setupUI(): void {
    this.healthDisplay.innerHTML = `
      <div>Health: <span id="health-value">100</span>/100</div>
      <div class="health-bar">
        <div class="health-fill" id="health-fill" style="width: 100%"></div>
      </div>
    `;

    this.deathScreen.innerHTML = `
      <div class="death-title">K.I.A.</div>
      <div>You have been eliminated</div>
      <div class="respawn-timer" id="respawn-timer">Respawning in 3...</div>
      <div class="spawn-options">
        <button class="spawn-button" id="spawn-base">Spawn at Base</button>
        <div class="spawn-zones-list" id="spawn-zones-list"></div>
      </div>
    `;

    // Setup spawn button handlers
    const spawnBaseBtn = this.deathScreen.querySelector('#spawn-base') as HTMLButtonElement;
    spawnBaseBtn.addEventListener('click', () => this.respawnAtBase());
  }

  private setupAudio(): void {
    try {
      this.audioContext = new AudioContext();
      this.heartbeatGain = this.audioContext.createGain();
      this.heartbeatGain.connect(this.audioContext.destination);
      this.heartbeatGain.gain.value = 0;
    } catch (e) {
      console.warn('Audio context not available for heartbeat effect');
    }
  }

  private resizeCanvas(): void {
    this.damageOverlay.width = window.innerWidth;
    this.damageOverlay.height = window.innerHeight;
  }

  private updateHealthDisplay(): void {
    const healthValue = document.getElementById('health-value');
    const healthFill = document.getElementById('health-fill');

    if (healthValue && healthFill) {
      healthValue.textContent = Math.round(this.playerState.health).toString();
      const healthPercent = (this.playerState.health / this.playerState.maxHealth) * 100;
      healthFill.style.width = `${healthPercent}%`;
    }
  }

  private updateLowHealthEffects(): void {
    const isLowHealth = this.playerState.health < 30;

    if (isLowHealth && !this.healthDisplay.classList.contains('low-health')) {
      this.healthDisplay.classList.add('low-health');
      this.startHeartbeat();
    } else if (!isLowHealth && this.healthDisplay.classList.contains('low-health')) {
      this.healthDisplay.classList.remove('low-health');
      this.stopHeartbeat();
    }
  }

  private startHeartbeat(): void {
    if (!this.audioContext || this.isPlayingHeartbeat) return;

    this.isPlayingHeartbeat = true;
    const playHeartbeat = () => {
      if (!this.isPlayingHeartbeat || !this.audioContext || !this.heartbeatGain) return;

      // Create heartbeat sound using oscillator
      const osc = this.audioContext.createOscillator();
      const envelope = this.audioContext.createGain();

      osc.connect(envelope);
      envelope.connect(this.heartbeatGain);

      osc.frequency.setValueAtTime(80, this.audioContext.currentTime);
      osc.type = 'sine';

      envelope.gain.setValueAtTime(0, this.audioContext.currentTime);
      envelope.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.05);
      envelope.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

      osc.start(this.audioContext.currentTime);
      osc.stop(this.audioContext.currentTime + 0.3);

      // Schedule next heartbeat
      setTimeout(playHeartbeat, 800);
    };

    playHeartbeat();
  }

  private stopHeartbeat(): void {
    this.isPlayingHeartbeat = false;
  }

  private updateDamageIndicators(deltaTime: number): void {
    // Remove expired indicators
    this.damageIndicators = this.damageIndicators.filter(indicator => {
      const age = (Date.now() - indicator.timestamp) / 1000;
      return age < indicator.fadeTime;
    });
  }

  private renderDamageOverlay(): void {
    this.damageContext.clearRect(0, 0, this.damageOverlay.width, this.damageOverlay.height);

    // Render damage indicators
    this.damageIndicators.forEach(indicator => {
      const age = (Date.now() - indicator.timestamp) / 1000;
      const alpha = Math.max(0, (indicator.fadeTime - age) / indicator.fadeTime);

      this.damageContext.save();
      this.damageContext.globalAlpha = alpha * indicator.intensity;

      // Draw directional damage indicator
      const centerX = this.damageOverlay.width / 2;
      const centerY = this.damageOverlay.height / 2;
      const distance = Math.min(centerX, centerY) * 0.8;

      const x = centerX + Math.cos(indicator.direction) * distance;
      const y = centerY + Math.sin(indicator.direction) * distance;

      // Draw arrow pointing to damage source
      this.damageContext.fillStyle = '#ff4444';
      this.damageContext.beginPath();
      this.damageContext.arc(x, y, 10 * indicator.intensity, 0, Math.PI * 2);
      this.damageContext.fill();

      // Draw line to edge
      this.damageContext.strokeStyle = '#ff4444';
      this.damageContext.lineWidth = 3 * indicator.intensity;
      this.damageContext.beginPath();
      this.damageContext.moveTo(centerX, centerY);
      this.damageContext.lineTo(x, y);
      this.damageContext.stroke();

      this.damageContext.restore();
    });

    // Red screen edge effect when low health
    if (this.playerState.health < 30) {
      const intensity = (30 - this.playerState.health) / 30;
      this.damageContext.save();
      this.damageContext.globalAlpha = intensity * 0.3;
      this.damageContext.fillStyle = '#ff0000';

      // Draw red vignette
      const gradient = this.damageContext.createRadialGradient(
        this.damageOverlay.width / 2, this.damageOverlay.height / 2, 0,
        this.damageOverlay.width / 2, this.damageOverlay.height / 2, Math.max(this.damageOverlay.width, this.damageOverlay.height) / 2
      );
      gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 1)');

      this.damageContext.fillStyle = gradient;
      this.damageContext.fillRect(0, 0, this.damageOverlay.width, this.damageOverlay.height);
      this.damageContext.restore();
    }
  }

  private updateDeathState(deltaTime: number): void {
    this.playerState.deathTime -= deltaTime;

    const timerElement = document.getElementById('respawn-timer');
    const zonesList = document.getElementById('spawn-zones-list');
    if (timerElement) {
      if (this.playerState.deathTime > 0) {
        timerElement.textContent = `Respawning in ${Math.ceil(this.playerState.deathTime)}...`;
      } else {
        timerElement.textContent = 'Choose spawn location:';

        // Populate spawnable zones list
        if (zonesList) {
          zonesList.innerHTML = '';
          const spawnables = this.getSpawnableZones();
          spawnables.forEach(zone => {
            const btn = document.createElement('button');
            btn.className = 'spawn-zone-button';
            btn.textContent = `Spawn at ${zone.name}`;
            btn.addEventListener('click', () => this.respawnAtSpecificZone(zone.id));
            zonesList.appendChild(btn);
          });
        }

        // Enable base button
        const spawnBaseBtn = document.getElementById('spawn-base') as HTMLButtonElement;
        if (spawnBaseBtn) spawnBaseBtn.disabled = false;
      }
    }
  }

  private canSpawnAtZone(): boolean {
    if (!this.zoneManager) return false;

    const zones = this.zoneManager.getAllZones();
    return zones.some(zone => zone.state === ZoneState.US_CONTROLLED && !zone.isHomeBase);
  }

  private getSpawnableZones() {
    if (!this.zoneManager) return [] as Array<{ id: string; name: string; position: THREE.Vector3 }>;
    return this.zoneManager
      .getAllZones()
      .filter(z => z.state === ZoneState.US_CONTROLLED && !z.isHomeBase)
      .map(z => ({ id: z.id, name: z.name, position: z.position.clone() }));
  }

  private respawnAtBase(): void {
    if (!this.zoneManager) { this.respawn(new THREE.Vector3(0, 5, -50)); return; }
    const usBase = this.zoneManager.getAllZones().find(z => z.id === 'us_base' || (z.isHomeBase && z.owner === Faction.US));
    const basePos = usBase ? usBase.position.clone() : new THREE.Vector3(0, 5, -50); // Consistent with PlayerController spawn
    basePos.y = 5; // Consistent height with initial spawn
    this.respawn(basePos);
  }

  private respawnAtSpecificZone(zoneId: string): void {
    if (!this.zoneManager) return;
    const zone = this.zoneManager.getAllZones().find(z => z.id === zoneId);
    if (!zone) return;
    const target = zone.position.clone().add(new THREE.Vector3(5, 2, 5));
    this.respawn(target);
  }

  private respawn(position: THREE.Vector3): void {
    this.playerState.health = this.playerState.maxHealth;
    this.playerState.isAlive = true;
    this.playerState.isDead = false;
    this.playerState.invulnerabilityTime = 0; // No spawn protection

    // Clear damage indicators
    this.damageIndicators = [];

    // Hide death screen
    this.deathScreen.style.display = 'none';

    // Move player to spawn position and re-enable controls
    if (this.playerController) {
      if (typeof this.playerController.setPosition === 'function') {
        this.playerController.setPosition(position);
      }
      if (typeof this.playerController.enableControls === 'function') {
        this.playerController.enableControls();
      }
    }
    console.log(`🏥 Player respawned at ${position.x}, ${position.y}, ${position.z}`);

    this.updateHealthDisplay();
    this.stopHeartbeat();
  }

  // Public API

  takeDamage(amount: number, sourcePosition?: THREE.Vector3, playerPosition?: THREE.Vector3): boolean {
    if (this.playerState.isDead || this.playerState.invulnerabilityTime > 0) {
      return false; // No damage during invulnerability
    }

    this.playerState.health = Math.max(0, this.playerState.health - amount);
    this.lastDamageTime = Date.now();

    console.log(`💥 Player took ${amount} damage, health: ${Math.round(this.playerState.health)}`);

    // Add damage indicator if we know the source direction
    if (sourcePosition && playerPosition) {
      const direction = new THREE.Vector3()
        .subVectors(sourcePosition, playerPosition)
        .normalize();

      // Convert to screen angle (0 = right, PI/2 = down, PI = left, 3PI/2 = up)
      const screenAngle = Math.atan2(direction.z, direction.x);

      this.damageIndicators.push({
        direction: screenAngle,
        intensity: Math.min(1.0, amount / 50), // Scale based on damage
        timestamp: Date.now(),
        fadeTime: 2.0 // Show for 2 seconds
      });
    }

    // Screen flash effect
    document.body.style.animation = 'none';
    setTimeout(() => {
      document.body.style.animation = 'damageFlash 0.2s ease';
      setTimeout(() => {
        document.body.style.animation = 'none';
      }, 200);
    }, 10);

    // Check for death
    if (this.playerState.health <= 0) {
      this.onPlayerDeath();
      return true; // Player died
    }

    this.updateHealthDisplay();
    return false; // Player survived
  }

  private onPlayerDeath(): void {
    if (this.playerState.isDead) return;

    this.playerState.isAlive = false;
    this.playerState.isDead = true;
    this.playerState.deathTime = this.playerState.respawnTime;

    console.log('💀 Player eliminated!');

    // Disable player controls
    if (this.playerController && typeof this.playerController.disableControls === 'function') {
      this.playerController.disableControls();
    }

    // Notify ticket system
    if (this.ticketSystem) {
      this.ticketSystem.onCombatantDeath(Faction.US);
    }

    // Show death screen
    this.deathScreen.style.display = 'flex';

    // Disable spawn buttons initially
    const spawnBaseBtn = document.getElementById('spawn-base') as HTMLButtonElement;
    const spawnZoneBtn = document.getElementById('spawn-zone') as HTMLButtonElement;

    if (spawnBaseBtn) spawnBaseBtn.disabled = true;
    if (spawnZoneBtn) spawnZoneBtn.disabled = true;

    this.stopHeartbeat();
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
    this.zoneManager = manager;
  }

  setTicketSystem(system: TicketSystem): void {
    this.ticketSystem = system;
  }

  setPlayerController(playerController: any): void {
    this.playerController = playerController;
  }

  setFirstPersonWeapon(weapon: any): void {
    this.firstPersonWeapon = weapon;
  }

  dispose(): void {
    this.stopHeartbeat();

    if (this.healthDisplay.parentNode) {
      this.healthDisplay.parentNode.removeChild(this.healthDisplay);
    }
    if (this.damageOverlay.parentNode) {
      this.damageOverlay.parentNode.removeChild(this.damageOverlay);
    }
    if (this.deathScreen.parentNode) {
      this.deathScreen.parentNode.removeChild(this.deathScreen);
    }

    console.log('🧹 Player Health System disposed');
  }
}

// Add damage flash animation to global styles
const damageFlashStyle = document.createElement('style');
damageFlashStyle.textContent = `
  @keyframes damageFlash {
    0% { filter: brightness(1); }
    50% { filter: brightness(1.5) saturate(0.5) hue-rotate(-10deg); }
    100% { filter: brightness(1); }
  }
`;
document.head.appendChild(damageFlashStyle);