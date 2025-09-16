export class HUDElements {
  // Main containers
  public hudContainer: HTMLDivElement;
  public objectivesList: HTMLDivElement;
  public ticketDisplay: HTMLDivElement;
  public combatStats: HTMLDivElement;
  public gameStatus: HTMLDivElement;
  public hitMarkerContainer: HTMLDivElement;
  public killCounter: HTMLDivElement;

  constructor() {
    this.hudContainer = this.createHUDContainer();
    this.objectivesList = this.createObjectivesPanel();
    this.ticketDisplay = this.createTicketDisplay();
    this.combatStats = this.createCombatStats();
    this.gameStatus = this.createGameStatus();
    this.hitMarkerContainer = this.createHitMarkerContainer();
    this.killCounter = this.createKillCounter();

    // Assemble HUD structure
    this.hudContainer.appendChild(this.objectivesList);
    this.hudContainer.appendChild(this.ticketDisplay);
    this.hudContainer.appendChild(this.combatStats);
    this.hudContainer.appendChild(this.gameStatus);
    this.hudContainer.appendChild(this.hitMarkerContainer);
    this.hudContainer.appendChild(this.killCounter);
  }

  private createHUDContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'hud-container';
    return container;
  }

  private createObjectivesPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'objectives-panel';
    panel.innerHTML = '<div class="objectives-title">Objectives</div>';
    return panel;
  }

  private createTicketDisplay(): HTMLDivElement {
    const display = document.createElement('div');
    display.className = 'ticket-display';
    return display;
  }

  private createCombatStats(): HTMLDivElement {
    const stats = document.createElement('div');
    stats.className = 'combat-stats';
    return stats;
  }

  private createGameStatus(): HTMLDivElement {
    const status = document.createElement('div');
    status.className = 'game-status';
    return status;
  }

  private createHitMarkerContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'hit-marker-container';
    return container;
  }

  private createKillCounter(): HTMLDivElement {
    const counter = document.createElement('div');
    counter.className = 'kill-counter';
    counter.innerHTML = `
      <div><span class="kill-count">0</span> Kills</div>
      <div><span class="death-count">0</span> Deaths</div>
      <div class="kd-ratio">K/D: 0.00</div>
    `;
    return counter;
  }

  showHitMarker(type: 'normal' | 'kill' | 'headshot' = 'normal'): void {
    const marker = document.createElement('div');
    marker.className = `hit-marker ${type}`;

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
        if (messageElement.parentNode) {
          this.hudContainer.removeChild(messageElement);
        }
      }, 300);
    }, duration);
  }

  attachToDOM(): void {
    document.body.appendChild(this.hudContainer);
  }

  dispose(): void {
    if (this.hudContainer.parentNode) {
      this.hudContainer.parentNode.removeChild(this.hudContainer);
    }
  }
}