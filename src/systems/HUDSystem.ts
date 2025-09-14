import { GameSystem } from '../types';
import { CombatantSystem, Faction } from './CombatantSystem';
import { ZoneManager, ZoneState, CaptureZone } from './ZoneManager';
import { TicketSystem, GameState } from './TicketSystem';

export class HUDSystem implements GameSystem {
  private combatantSystem?: CombatantSystem;
  private zoneManager?: ZoneManager;
  private ticketSystem?: TicketSystem;
  
  // Player stats
  private playerKills = 0;
  private playerDeaths = 0;

  // HUD Elements
  private hudContainer: HTMLDivElement;
  private objectivesList: HTMLDivElement;
  private ticketDisplay: HTMLDivElement;
  private combatStats: HTMLDivElement;
  private gameStatus: HTMLDivElement;
  private hitMarkerContainer: HTMLDivElement;
  private killCounter: HTMLDivElement;

  // Styles
  private readonly HUD_STYLES = `
    .hud-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      font-family: 'Courier New', monospace;
      color: white;
      z-index: 100;
    }

    .objectives-panel {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(10, 10, 14, 0.28);
      backdrop-filter: blur(6px) saturate(1.1);
      -webkit-backdrop-filter: blur(6px) saturate(1.1);
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      min-width: 240px;
    }

    .objectives-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
      text-transform: uppercase;
      border-bottom: 1px solid rgba(255, 255, 255, 0.3);
      padding-bottom: 5px;
    }

    .zone-item {
      margin: 8px 0;
      padding: 5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 3px;
    }

    .zone-name {
      font-weight: bold;
      text-transform: uppercase;
    }

    .zone-status {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .zone-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
    }

    .zone-neutral { background: #888; }
    .zone-us { background: #0066cc; }
    .zone-opfor { background: #cc0000; }
    .zone-contested {
      background: linear-gradient(90deg, #0066cc 50%, #cc0000 50%);
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }

    .capture-progress {
      width: 100px;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      overflow: hidden;
      margin-top: 3px;
    }

    .capture-bar {
      height: 100%;
      background: white;
      transition: width 0.3s ease;
    }

    .ticket-display {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(10, 10, 14, 0.28);
      backdrop-filter: blur(6px) saturate(1.1);
      -webkit-backdrop-filter: blur(6px) saturate(1.1);
      padding: 8px 16px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 10px;
      display: flex;
      gap: 24px;
      align-items: center;
    }

    .faction-tickets {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .faction-name {
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 5px;
    }

    .ticket-count {
      font-size: 28px;
      font-weight: bold;
    }

    .us-tickets { color: #4488ff; }
    .opfor-tickets { color: #ff4444; }

    .ticket-separator {
      font-size: 24px;
      color: #666;
    }

    .combat-stats {
      position: absolute;
      bottom: 16px;
      right: 16px;
      background: rgba(10, 10, 14, 0.28);
      backdrop-filter: blur(6px) saturate(1.1);
      -webkit-backdrop-filter: blur(6px) saturate(1.1);
      padding: 8px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      font-size: 12px;
    }

    .stat-line {
      margin: 3px 0;
    }

    .zone-distance {
      font-size: 10px;
      color: #aaa;
      margin-left: 5px;
    }

    .game-status {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(10, 10, 14, 0.28);
      backdrop-filter: blur(6px) saturate(1.1);
      -webkit-backdrop-filter: blur(6px) saturate(1.1);
      padding: 8px 12px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      font-size: 14px;
    }

    .phase-setup { border-color: #ffaa00; color: #ffaa00; }
    .phase-combat { border-color: #ff4444; color: #ff4444; }
    .phase-overtime { border-color: #ff0088; color: #ff0088; animation: pulse 0.5s infinite; }
    .phase-ended { border-color: #00ff00; color: #00ff00; }

    .time-remaining {
      font-size: 12px;
      margin-top: 5px;
      opacity: 0.8;
    }

    .bleed-indicator {
      font-size: 10px;
      margin-top: 3px;
      opacity: 0.7;
    }

    .victory-screen {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 40px;
      font-size: 32px;
      border-radius: 10px;
      text-align: center;
      border: 3px solid;
      z-index: 1000;
    }

    .victory-us { border-color: #4488ff; color: #4488ff; }
    .victory-opfor { border-color: #ff4444; color: #ff4444; }
    
    /* Hit markers */
    .hit-marker-container {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 0;
      height: 0;
      pointer-events: none;
      z-index: 120;
    }
    .hit-marker {
      position: absolute;
      width: 18px;
      height: 18px;
      transform: translate(-50%, -50%) rotate(45deg);
      border: 2px solid rgba(255,255,255,0.9);
      opacity: 0.0;
      animation: hitFlash 200ms ease-out forwards;
    }
    .hit-marker.kill { border-color: #ff4444; }
    .hit-marker.headshot { border-color: #ffee55; }
    @keyframes hitFlash {
      0% { opacity: 0; transform: translate(-50%, -50%) rotate(45deg) scale(0.8); }
      50% { opacity: 1; transform: translate(-50%, -50%) rotate(45deg) scale(1.0); }
      100% { opacity: 0; transform: translate(-50%, -50%) rotate(45deg) scale(1.2); }
    }
    
    /* Kill counter */
    .kill-counter {
      position: absolute;
      bottom: 16px;
      left: 16px;
      background: rgba(10, 10, 14, 0.28);
      backdrop-filter: blur(6px) saturate(1.1);
      -webkit-backdrop-filter: blur(6px) saturate(1.1);
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      font-size: 12px;
      color: white;
      min-width: 120px;
      text-align: center;
    }
    .kill-counter .kill-count { color: #ffffff; font-weight: bold; }
    .kill-counter .death-count { color: #aaaaaa; }
    .kill-counter .kd-ratio { color: #88ff88; margin-top: 2px; font-size: 11px; }
  `;

  constructor() {
    // Create HUD container
    this.hudContainer = document.createElement('div');
    this.hudContainer.className = 'hud-container';

    // Create objectives panel
    this.objectivesList = document.createElement('div');
    this.objectivesList.className = 'objectives-panel';
    this.objectivesList.innerHTML = '<div class="objectives-title">Objectives</div>';

    // Create ticket display
    this.ticketDisplay = document.createElement('div');
    this.ticketDisplay.className = 'ticket-display';

    // Create combat stats
    this.combatStats = document.createElement('div');
    this.combatStats.className = 'combat-stats';

    // Create game status
    this.gameStatus = document.createElement('div');
    this.gameStatus.className = 'game-status';

    // Add elements to container
    this.hudContainer.appendChild(this.objectivesList);
    this.hudContainer.appendChild(this.ticketDisplay);
    this.hudContainer.appendChild(this.combatStats);
    this.hudContainer.appendChild(this.gameStatus);
    
    // Hit marker container (center)
    this.hitMarkerContainer = document.createElement('div');
    this.hitMarkerContainer.className = 'hit-marker-container';
    this.hudContainer.appendChild(this.hitMarkerContainer);
    
    // Kill counter panel
    this.killCounter = document.createElement('div');
    this.killCounter.className = 'kill-counter';
    this.killCounter.innerHTML = `
      <div><span class="kill-count">0</span> Kills</div>
      <div><span class="death-count">0</span> Deaths</div>
      <div class="kd-ratio">K/D: 0.00</div>
    `;
    this.hudContainer.appendChild(this.killCounter);

    // Add styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = this.HUD_STYLES;
    document.head.appendChild(styleSheet);
  }

  async init(): Promise<void> {
    console.log('📊 Initializing HUD System...');

    // Add HUD to DOM
    document.body.appendChild(this.hudContainer);

    // Initialize ticket display
    this.updateTicketDisplay(300, 300); // Starting tickets

    console.log('✅ HUD System initialized');
  }

  update(deltaTime: number): void {
    // Update objectives display
    if (this.zoneManager) {
      this.updateObjectivesDisplay();
    }

    // Update combat statistics
    if (this.combatantSystem) {
      this.updateCombatStats();
    }

    // Update game status and tickets
    if (this.ticketSystem) {
      this.updateGameStatus();
      this.updateTicketDisplay(
        this.ticketSystem.getTickets(Faction.US),
        this.ticketSystem.getTickets(Faction.OPFOR)
      );
    }
  }

  private updateObjectivesDisplay(): void {
    if (!this.zoneManager) return;

    const zones = this.zoneManager.getAllZones();
    const capturableZones = zones.filter(z => !z.isHomeBase);

    // Clear current display
    while (this.objectivesList.children.length > 1) {
      this.objectivesList.removeChild(this.objectivesList.lastChild!);
    }

    // Add each zone
    capturableZones.forEach(zone => {
      const zoneElement = this.createZoneElement(zone);
      this.objectivesList.appendChild(zoneElement);
    });
  }

  private createZoneElement(zone: CaptureZone): HTMLDivElement {
    const element = document.createElement('div');
    element.className = 'zone-item';

    // Determine zone class
    let zoneClass = 'zone-neutral';
    let statusText = 'Neutral';

    switch (zone.state) {
      case ZoneState.US_CONTROLLED:
        zoneClass = 'zone-us';
        statusText = 'US';
        break;
      case ZoneState.OPFOR_CONTROLLED:
        zoneClass = 'zone-opfor';
        statusText = 'OPFOR';
        break;
      case ZoneState.CONTESTED:
        zoneClass = 'zone-contested';
        statusText = 'Contested';
        break;
    }

    // Calculate distance to player (approximate)
    const distance = Math.round(zone.position.length());

    element.innerHTML = `
      <div>
        <span class="zone-name">${zone.name}</span>
        <span class="zone-distance">${distance}m</span>
      </div>
      <div class="zone-status">
        <div class="zone-icon ${zoneClass}"></div>
      </div>
    `;

    // Add capture progress bar if contested
    if (zone.state === ZoneState.CONTESTED) {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'capture-progress';
      const progressBar = document.createElement('div');
      progressBar.className = 'capture-bar';
      progressBar.style.width = `${zone.captureProgress}%`;
      progressContainer.appendChild(progressBar);
      element.appendChild(progressContainer);
    }

    return element;
  }

  private updateTicketDisplay(usTickets: number, opforTickets: number): void {
    this.ticketDisplay.innerHTML = `
      <div class="faction-tickets">
        <div class="faction-name">US Forces</div>
        <div class="ticket-count us-tickets">${Math.round(usTickets)}</div>
      </div>
      <div class="ticket-separator">VS</div>
      <div class="faction-tickets">
        <div class="faction-name">OPFOR</div>
        <div class="ticket-count opfor-tickets">${Math.round(opforTickets)}</div>
      </div>
    `;
  }

  private updateCombatStats(): void {
    if (!this.combatantSystem) return;

    const stats = this.combatantSystem.getCombatStats();

    this.combatStats.innerHTML = `
      <div class="stat-line">Allies: ${stats.us}</div>
      <div class="stat-line">Enemies: ${stats.opfor}</div>
      <div class="stat-line">Total: ${stats.total}</div>
    `;
  }

  private updateKillCounter(): void {
    const kd = this.playerDeaths > 0 ? (this.playerKills / this.playerDeaths).toFixed(2) : this.playerKills.toFixed(2);

    this.killCounter.innerHTML = `
      <div><span class="kill-count">${this.playerKills}</span> Kills</div>
      <div><span class="death-count">${this.playerDeaths}</span> Deaths</div>
      <div class="kd-ratio">K/D: ${kd}</div>
    `;
  }

  private updateGameStatus(): void {
    if (!this.ticketSystem) return;

    const gameState = this.ticketSystem.getGameState();
    const bleedRate = this.ticketSystem.getTicketBleedRate();
    const timeRemaining = this.ticketSystem.getMatchTimeRemaining();

    // Update game status class
    this.gameStatus.className = `game-status phase-${gameState.phase.toLowerCase()}`;

    let statusText = '';
    switch (gameState.phase) {
      case 'SETUP':
        statusText = 'PREPARE FOR BATTLE';
        break;
      case 'COMBAT':
        statusText = 'IN COMBAT';
        break;
      case 'OVERTIME':
        statusText = 'OVERTIME!';
        break;
      case 'ENDED':
        statusText = gameState.winner ? `${gameState.winner} VICTORY!` : 'GAME ENDED';
        break;
    }

    let timeText = '';
    if (timeRemaining > 0) {
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = Math.floor(timeRemaining % 60);
      timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    let bleedText = '';
    if (bleedRate.bleedPerSecond > 0) {
      if (bleedRate.usTickets > bleedRate.opforTickets) {
        bleedText = `US bleeding ${bleedRate.usTickets.toFixed(1)}/sec`;
      } else if (bleedRate.opforTickets > bleedRate.usTickets) {
        bleedText = `OPFOR bleeding ${bleedRate.opforTickets.toFixed(1)}/sec`;
      }
    }

    this.gameStatus.innerHTML = `
      <div>${statusText}</div>
      ${timeText ? `<div class="time-remaining">${timeText}</div>` : ''}
      ${bleedText ? `<div class="bleed-indicator">${bleedText}</div>` : ''}
    `;

    // Show victory screen if game ended
    if (gameState.phase === 'ENDED' && !document.querySelector('.victory-screen')) {
      this.showVictoryScreen(gameState.winner!);
    }
  }

  private showVictoryScreen(winner: Faction): void {
    const victoryScreen = document.createElement('div');
    victoryScreen.className = `victory-screen victory-${winner.toLowerCase()}`;

    victoryScreen.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 20px;">${winner} VICTORY!</div>
      <div style="font-size: 18px; margin-bottom: 10px;">Final Scores:</div>
      <div style="font-size: 24px;">
        US: ${Math.round(this.ticketSystem!.getTickets(Faction.US))} |
        OPFOR: ${Math.round(this.ticketSystem!.getTickets(Faction.OPFOR))}
      </div>
      <div style="font-size: 14px; margin-top: 20px; opacity: 0.7;">
        Press F5 to restart
      </div>
    `;

    this.hudContainer.appendChild(victoryScreen);
  }

  // Public API

  showHitMarker(type: 'normal' | 'kill' | 'headshot' = 'normal'): void {
    const marker = document.createElement('div');
    marker.className = `hit-marker ${type}`;

    // Play hit sound effect (optional)
    if (type === 'kill') {
      console.log('💀 Kill confirmed!');
    } else if (type === 'headshot') {
      console.log('🎯 Headshot!');
    }

    this.hitMarkerContainer.appendChild(marker);

    // Remove after animation completes
    setTimeout(() => {
      if (marker.parentNode) {
        marker.parentNode.removeChild(marker);
      }
    }, 300);
  }

  addKill(): void {
    this.playerKills++;
    this.updateKillCounter();
    this.showHitMarker('kill');
  }

  addDeath(): void {
    this.playerDeaths++;
    this.updateKillCounter();
  }

  setCombatantSystem(system: CombatantSystem): void {
    this.combatantSystem = system;
  }

  setZoneManager(manager: ZoneManager): void {
    this.zoneManager = manager;
  }

  setTicketSystem(system: TicketSystem): void {
    this.ticketSystem = system;
  }

  updateTickets(usTickets: number, opforTickets: number): void {
    this.updateTicketDisplay(usTickets, opforTickets);
  }

  showMessage(message: string, duration: number = 3000): void {
    const messageElement = document.createElement('div');
    messageElement.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      font-size: 24px;
      border-radius: 5px;
      text-align: center;
      animation: fadeIn 0.3s ease;
    `;
    messageElement.textContent = message;

    this.hudContainer.appendChild(messageElement);

    setTimeout(() => {
      messageElement.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => {
        this.hudContainer.removeChild(messageElement);
      }, 300);
    }, duration);
  }

  dispose(): void {
    if (this.hudContainer.parentNode) {
      this.hudContainer.parentNode.removeChild(this.hudContainer);
    }

    console.log('🧹 HUD System disposed');
  }
}