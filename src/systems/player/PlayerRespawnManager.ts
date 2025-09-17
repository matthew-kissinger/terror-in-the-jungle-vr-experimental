import * as THREE from 'three';
import { GameSystem } from '../../types';
import { Faction } from '../combat/types';
import { ZoneManager, ZoneState } from '../world/ZoneManager';
import { PlayerHealthSystem } from './PlayerHealthSystem';
import { GameModeManager } from '../world/GameModeManager';

export class PlayerRespawnManager implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private zoneManager?: ZoneManager;
  private playerHealthSystem?: PlayerHealthSystem;
  private gameModeManager?: GameModeManager;
  private playerController?: any;
  private firstPersonWeapon?: any;

  // Respawn state
  private isRespawnUIVisible = false;
  private respawnTimer = 0;
  private selectedSpawnPoint?: string;
  private respawnUIContainer?: HTMLDivElement;
  private availableSpawnPoints: Array<{ id: string; name: string; position: THREE.Vector3; safe: boolean }> = [];

  private onRespawnCallback?: (position: THREE.Vector3) => void;
  private onDeathCallback?: () => void;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
  }

  async init(): Promise<void> {
    console.log('🏥 Initializing Player Respawn Manager...');
    this.createRespawnUI();
  }

  private createRespawnUI(): void {
    // Create container for respawn UI
    this.respawnUIContainer = document.createElement('div');
    this.respawnUIContainer.id = 'respawn-ui';
    this.respawnUIContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.85);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: 'Courier New', monospace;
    `;

    // Create inner content container
    const content = document.createElement('div');
    content.style.cssText = `
      background: rgba(20, 20, 20, 0.95);
      border: 2px solid #00ff00;
      border-radius: 8px;
      padding: 30px;
      max-width: 800px;
      width: 90%;
      color: white;
    `;

    // Title
    const title = document.createElement('h2');
    title.style.cssText = `
      color: #00ff00;
      margin: 0 0 20px 0;
      text-align: center;
      font-size: 28px;
      text-transform: uppercase;
      letter-spacing: 2px;
    `;
    title.textContent = 'Select Spawn Point';
    content.appendChild(title);

    // Instructions
    const instructions = document.createElement('p');
    instructions.style.cssText = `
      color: #888;
      text-align: center;
      margin-bottom: 25px;
      font-size: 14px;
    `;
    instructions.textContent = 'Click on a spawn point or use number keys (1-9) to respawn';
    content.appendChild(instructions);

    // Spawn points list container
    const spawnList = document.createElement('div');
    spawnList.id = 'spawn-list';
    spawnList.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 15px;
      max-height: 400px;
      overflow-y: auto;
      padding: 10px;
    `;
    content.appendChild(spawnList);

    // Timer display
    const timerDisplay = document.createElement('div');
    timerDisplay.id = 'respawn-timer';
    timerDisplay.style.cssText = `
      text-align: center;
      margin-top: 20px;
      color: #ff6600;
      font-size: 16px;
      font-weight: bold;
    `;
    content.appendChild(timerDisplay);

    this.respawnUIContainer.appendChild(content);
    document.body.appendChild(this.respawnUIContainer);

    // Add keyboard listener for number keys
    document.addEventListener('keydown', (e) => this.handleRespawnKeyPress(e));
  }

  private handleRespawnKeyPress(event: KeyboardEvent): void {
    if (!this.isRespawnUIVisible) return;

    const key = parseInt(event.key);
    if (key >= 1 && key <= 9) {
      const index = key - 1;
      if (index < this.availableSpawnPoints.length) {
        this.selectSpawnPoint(this.availableSpawnPoints[index].id);
      }
    }
  }

  update(deltaTime: number): void {
    if (this.respawnTimer > 0) {
      this.respawnTimer -= deltaTime;
      if (this.respawnTimer <= 0) {
        this.showRespawnUI();
      }
    }
  }

  dispose(): void {
    this.hideRespawnUI();
    if (this.respawnUIContainer?.parentElement) {
      this.respawnUIContainer.parentElement.removeChild(this.respawnUIContainer);
    }
    document.removeEventListener('keydown', (e) => this.handleRespawnKeyPress(e));
  }

  setZoneManager(manager: ZoneManager): void {
    this.zoneManager = manager;
  }

  setPlayerHealthSystem(system: PlayerHealthSystem): void {
    this.playerHealthSystem = system;
  }

  setGameModeManager(manager: GameModeManager): void {
    this.gameModeManager = manager;
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

    // Check if game mode allows spawning at zones
    const canSpawnAtZones = this.gameModeManager?.canPlayerSpawnAtZones() ?? false;

    // Always include HQs
    const zones = this.zoneManager.getAllZones().filter(z =>
      z.owner === Faction.US && (z.isHomeBase || (canSpawnAtZones && !z.isHomeBase))
    );

    console.log(`🚩 Found ${zones.length} spawnable zones:`, zones.map(z => `${z.name} (${z.state})`));

    return zones.map(z => ({
      id: z.id,
      name: z.name,
      position: z.position.clone()
    }));
  }

  canSpawnAtZone(): boolean {
    if (!this.zoneManager || !this.gameModeManager) return false;

    // Check if game mode allows spawning at zones
    if (!this.gameModeManager.canPlayerSpawnAtZones()) {
      return false;
    }

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

    // Apply spawn protection per game mode
    const protection = this.gameModeManager?.getSpawnProtectionDuration() ?? 0;
    if (this.playerHealthSystem && protection > 0 && typeof (this.playerHealthSystem as any).applySpawnProtection === 'function') {
      (this.playerHealthSystem as any).applySpawnProtection(protection);
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

    // Start respawn timer
    const respawnTime = this.gameModeManager?.getRespawnTime() ?? 5;
    this.respawnTimer = respawnTime;

    // Trigger callback
    if (this.onDeathCallback) {
      this.onDeathCallback();
    }
  }

  private showRespawnUI(): void {
    if (this.isRespawnUIVisible || !this.respawnUIContainer) return;

    this.isRespawnUIVisible = true;

    // Update available spawn points
    this.updateAvailableSpawnPoints();

    // Show the UI
    this.respawnUIContainer.style.display = 'flex';

    // Update spawn point buttons
    this.updateSpawnPointDisplay();

    // Start updating the UI periodically to show zone status changes
    const updateInterval = setInterval(() => {
      if (!this.isRespawnUIVisible) {
        clearInterval(updateInterval);
        return;
      }
      this.updateSpawnPointDisplay();
    }, 1000);
  }

  private updateAvailableSpawnPoints(): void {
    if (!this.zoneManager) {
      this.availableSpawnPoints = [{
        id: 'default',
        name: 'Base',
        position: new THREE.Vector3(0, 5, -50),
        safe: true
      }];
      return;
    }

    const canSpawnAtZones = this.gameModeManager?.canPlayerSpawnAtZones() ?? false;
    const zones = this.zoneManager.getAllZones();

    this.availableSpawnPoints = zones
      .filter(z => {
        // Can spawn at US-owned bases
        if (z.isHomeBase && z.owner === Faction.US) return true;
        // Can spawn at captured zones if game mode allows
        if (canSpawnAtZones && !z.isHomeBase && z.owner === Faction.US) return true;
        return false;
      })
      .map(z => ({
        id: z.id,
        name: z.name,
        position: z.position.clone(),
        safe: z.state !== ZoneState.CONTESTED
      }));
  }

  private updateSpawnPointDisplay(): void {
    const spawnList = document.getElementById('spawn-list');
    if (!spawnList) return;

    // Clear existing buttons
    spawnList.innerHTML = '';

    // Create button for each spawn point
    this.availableSpawnPoints.forEach((point, index) => {
      const button = document.createElement('button');
      button.style.cssText = `
        background: ${point.safe ? 'rgba(0, 100, 0, 0.3)' : 'rgba(100, 50, 0, 0.3)'};
        border: 2px solid ${point.safe ? '#00ff00' : '#ff6600'};
        color: white;
        padding: 15px;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
        text-align: left;
      `;

      // Add hover effect
      button.onmouseover = () => {
        button.style.background = point.safe ? 'rgba(0, 150, 0, 0.5)' : 'rgba(150, 75, 0, 0.5)';
        button.style.transform = 'scale(1.05)';
      };
      button.onmouseout = () => {
        button.style.background = point.safe ? 'rgba(0, 100, 0, 0.3)' : 'rgba(100, 50, 0, 0.3)';
        button.style.transform = 'scale(1)';
      };

      // Number indicator
      const numberBadge = document.createElement('div');
      numberBadge.style.cssText = `
        position: absolute;
        top: 5px;
        right: 10px;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid #888;
        border-radius: 3px;
        padding: 2px 6px;
        font-size: 12px;
        color: #ccc;
      `;
      numberBadge.textContent = `${index + 1}`;
      button.appendChild(numberBadge);

      // Spawn point name
      const name = document.createElement('div');
      name.style.cssText = `
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 5px;
        color: ${point.safe ? '#00ff00' : '#ff6600'};
      `;
      name.textContent = point.name;
      button.appendChild(name);

      // Status indicator
      const status = document.createElement('div');
      status.style.cssText = `
        font-size: 12px;
        color: ${point.safe ? '#88ff88' : '#ffaa66'};
      `;
      status.textContent = point.safe ? '✓ SAFE' : '⚠ CONTESTED';
      button.appendChild(status);

      // Position info
      const posInfo = document.createElement('div');
      posInfo.style.cssText = `
        font-size: 10px;
        color: #666;
        margin-top: 5px;
      `;
      posInfo.textContent = `Position: ${Math.round(point.position.x)}, ${Math.round(point.position.z)}`;
      button.appendChild(posInfo);

      // Click handler
      button.onclick = () => this.selectSpawnPoint(point.id);

      spawnList.appendChild(button);
    });
  }

  private selectSpawnPoint(pointId: string): void {
    const spawnPoint = this.availableSpawnPoints.find(p => p.id === pointId);
    if (!spawnPoint) return;

    console.log(`🎯 Spawning at ${spawnPoint.name}`);
    this.selectedSpawnPoint = pointId;
    this.hideRespawnUI();

    // Add slight randomization to avoid spawn camping
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      2,
      (Math.random() - 0.5) * 10
    );
    const finalPosition = spawnPoint.position.clone().add(offset);

    this.respawn(finalPosition);
  }

  private hideRespawnUI(): void {
    this.isRespawnUIVisible = false;
    if (this.respawnUIContainer) {
      this.respawnUIContainer.style.display = 'none';
    }
    this.selectedSpawnPoint = undefined;
  }
}