export class HUDElements {
  // Main containers
  public hudContainer: HTMLDivElement;
  public objectivesList: HTMLDivElement;
  public ticketDisplay: HTMLDivElement;
  public combatStats: HTMLDivElement;
  public gameStatus: HTMLDivElement;
  public hitMarkerContainer: HTMLDivElement;
  public killCounter: HTMLDivElement;
  public ammoDisplay: HTMLDivElement;
  public respawnButton: HTMLButtonElement;

  constructor() {
    this.hudContainer = this.createHUDContainer();
    this.objectivesList = this.createObjectivesPanel();
    this.ticketDisplay = this.createTicketDisplay();
    this.combatStats = this.createCombatStats();
    this.gameStatus = this.createGameStatus();
    this.hitMarkerContainer = this.createHitMarkerContainer();
    this.killCounter = this.createKillCounter();
    this.ammoDisplay = this.createAmmoDisplay();
    this.respawnButton = this.createRespawnButton();

    // Assemble HUD structure
    this.hudContainer.appendChild(this.objectivesList);
    this.hudContainer.appendChild(this.ticketDisplay);
    this.hudContainer.appendChild(this.combatStats);
    this.hudContainer.appendChild(this.gameStatus);
    this.hudContainer.appendChild(this.hitMarkerContainer);
    this.hudContainer.appendChild(this.killCounter);
    this.hudContainer.appendChild(this.ammoDisplay);
    // Removed respawn button from HUD
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

  private createAmmoDisplay(): HTMLDivElement {
    const display = document.createElement('div');
    display.className = 'ammo-display';
    display.innerHTML = `
      <div class="ammo-counter">
        <span class="ammo-magazine">30</span>
        <span class="ammo-separator">/</span>
        <span class="ammo-reserve">90</span>
      </div>
      <div class="ammo-status"></div>
    `;
    return display;
  }

  updateAmmoDisplay(magazine: number, reserve: number): void {
    const magElement = this.ammoDisplay.querySelector('.ammo-magazine') as HTMLElement;
    const resElement = this.ammoDisplay.querySelector('.ammo-reserve') as HTMLElement;
    const statusElement = this.ammoDisplay.querySelector('.ammo-status') as HTMLElement;

    if (magElement) magElement.textContent = magazine.toString();
    if (resElement) resElement.textContent = reserve.toString();

    // Show status messages
    if (magazine === 0 && reserve > 0) {
      statusElement.textContent = 'Press R to reload';
      statusElement.style.color = '#ff6b6b';
      magElement.style.color = '#ff6b6b';
    } else if (magazine <= 10 && magazine > 0) {
      statusElement.textContent = 'Low ammo';
      statusElement.style.color = '#ffd93d';
      magElement.style.color = '#ffd93d';
    } else if (magazine === 0 && reserve === 0) {
      statusElement.textContent = 'No ammo!';
      statusElement.style.color = '#ff0000';
      magElement.style.color = '#ff0000';
    } else {
      statusElement.textContent = '';
      magElement.style.color = 'white';
    }
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

  private createRespawnButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'respawn-button';
    button.innerHTML = '🔄 RESPAWN<br><span style="font-size: 10px;">Press K</span>';
    button.style.cssText = `
      position: fixed;
      bottom: 120px;
      right: 20px;
      padding: 12px 20px;
      background: rgba(255, 0, 0, 0.1);
      border: 2px solid rgba(255, 0, 0, 0.5);
      color: #ff6b6b;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.3s;
      z-index: 100;
      text-align: center;
      backdrop-filter: blur(5px);
    `;

    button.onmouseover = () => {
      button.style.background = 'rgba(255, 0, 0, 0.2)';
      button.style.borderColor = 'rgba(255, 0, 0, 0.8)';
      button.style.transform = 'scale(1.05)';
    };

    button.onmouseout = () => {
      button.style.background = 'rgba(255, 0, 0, 0.1)';
      button.style.borderColor = 'rgba(255, 0, 0, 0.5)';
      button.style.transform = 'scale(1)';
    };

    return button;
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