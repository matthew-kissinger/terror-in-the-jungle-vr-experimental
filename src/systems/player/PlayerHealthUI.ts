import { PlayerState } from './PlayerHealthSystem';
import { Faction } from '../combat/types';
import { ZoneManager, ZoneState } from '../world/ZoneManager';

export class PlayerHealthUI {
  private healthDisplay: HTMLDivElement;
  private deathScreen: HTMLDivElement;
  private styleSheet: HTMLStyleElement;

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

    .spawn-zone-button:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  `;

  constructor() {
    this.healthDisplay = document.createElement('div');
    this.healthDisplay.className = 'health-display';

    this.deathScreen = document.createElement('div');
    this.deathScreen.className = 'death-screen';
    this.deathScreen.style.display = 'none';

    this.styleSheet = document.createElement('style');
    this.styleSheet.textContent = this.UI_STYLES;

    this.setupUIContent();
  }

  private setupUIContent(): void {
    this.healthDisplay.innerHTML = `
      <div>Health: <span id="health-value">150</span>/150</div>
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
  }

  init(): void {
    document.head.appendChild(this.styleSheet);
    document.body.appendChild(this.healthDisplay);
    document.body.appendChild(this.deathScreen);
  }

  updateHealthDisplay(health: number, maxHealth: number): void {
    const healthValue = document.getElementById('health-value');
    const healthFill = document.getElementById('health-fill');

    if (healthValue && healthFill) {
      healthValue.textContent = Math.round(health).toString();
      const healthPercent = (health / maxHealth) * 100;
      healthFill.style.width = `${healthPercent}%`;
    }
  }

  setLowHealthEffect(isLowHealth: boolean): void {
    if (isLowHealth && !this.healthDisplay.classList.contains('low-health')) {
      this.healthDisplay.classList.add('low-health');
    } else if (!isLowHealth && this.healthDisplay.classList.contains('low-health')) {
      this.healthDisplay.classList.remove('low-health');
    }
  }

  setSpawnProtection(hasProtection: boolean): void {
    if (hasProtection) {
      this.healthDisplay.classList.add('spawn-protection');
    } else {
      this.healthDisplay.classList.remove('spawn-protection');
    }
  }

  showDeathScreen(): void {
    this.deathScreen.style.display = 'flex';
    this.disableSpawnButtons();
  }

  hideDeathScreen(): void {
    this.deathScreen.style.display = 'none';
  }

  updateDeathTimer(timeRemaining: number): void {
    const timerElement = document.getElementById('respawn-timer');
    if (timerElement) {
      if (timeRemaining > 0) {
        timerElement.textContent = `Respawning in ${Math.ceil(timeRemaining)}...`;
      } else {
        timerElement.textContent = 'Choose spawn location:';
      }
    }
  }

  updateSpawnZonesList(zones: Array<{ id: string; name: string }>, onSpawnClick: (zoneId: string) => void): void {
    const zonesList = document.getElementById('spawn-zones-list');
    if (zonesList) {
      zonesList.innerHTML = '';
      zones.forEach(zone => {
        const btn = document.createElement('button');
        btn.className = 'spawn-zone-button';
        btn.textContent = `Spawn at ${zone.name}`;
        btn.addEventListener('click', () => onSpawnClick(zone.id));
        zonesList.appendChild(btn);
      });
    }
  }

  enableSpawnButtons(): void {
    const spawnBaseBtn = document.getElementById('spawn-base') as HTMLButtonElement;
    if (spawnBaseBtn) spawnBaseBtn.disabled = false;
  }

  disableSpawnButtons(): void {
    const spawnBaseBtn = document.getElementById('spawn-base') as HTMLButtonElement;
    const spawnZoneBtn = document.getElementById('spawn-zone') as HTMLButtonElement;
    if (spawnBaseBtn) spawnBaseBtn.disabled = true;
    if (spawnZoneBtn) spawnZoneBtn.disabled = true;
  }

  getSpawnBaseButton(): HTMLButtonElement | null {
    return this.deathScreen.querySelector('#spawn-base') as HTMLButtonElement;
  }

  dispose(): void {
    if (this.healthDisplay.parentNode) {
      this.healthDisplay.parentNode.removeChild(this.healthDisplay);
    }
    if (this.deathScreen.parentNode) {
      this.deathScreen.parentNode.removeChild(this.deathScreen);
    }
    if (this.styleSheet.parentNode) {
      this.styleSheet.parentNode.removeChild(this.styleSheet);
    }
  }
}