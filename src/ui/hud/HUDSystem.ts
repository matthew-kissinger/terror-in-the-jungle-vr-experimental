import { GameSystem } from '../../types';
import { CombatantSystem } from '../../systems/combat/CombatantSystem';
import { Faction } from '../../systems/combat/types';
import { ZoneManager } from '../../systems/world/ZoneManager';
import { TicketSystem } from '../../systems/world/TicketSystem';
import { HUDStyles } from './HUDStyles';
import { HUDElements } from './HUDElements';
import { HUDUpdater } from './HUDUpdater';

export class HUDSystem implements GameSystem {
  private combatantSystem?: CombatantSystem;
  private zoneManager?: ZoneManager;
  private ticketSystem?: TicketSystem;

  private styles: HUDStyles;
  private elements: HUDElements;
  private updater: HUDUpdater;

  constructor(camera?: any, ticketSystem?: any, playerHealthSystem?: any, playerRespawnManager?: any) {
    this.styles = HUDStyles.getInstance();
    this.elements = new HUDElements();
    this.updater = new HUDUpdater(this.elements);
    // Parameters are optional for backward compatibility
  }

  async init(): Promise<void> {
    console.log('📊 Initializing HUD System...');

    // Inject styles
    this.styles.inject();

    // Add HUD to DOM
    this.elements.attachToDOM();

    // Initialize ticket display
    this.updater.updateTicketDisplay(300, 300);

    console.log('✅ HUD System initialized');
  }

  update(deltaTime: number): void {
    // Update objectives display
    if (this.zoneManager) {
      this.updater.updateObjectivesDisplay(this.zoneManager);
    }

    // Update combat statistics
    if (this.combatantSystem) {
      this.updater.updateCombatStats(this.combatantSystem);
    }

    // Update game status and tickets
    if (this.ticketSystem) {
      this.updater.updateGameStatus(this.ticketSystem);
      this.updater.updateTicketDisplay(
        this.ticketSystem.getTickets(Faction.US),
        this.ticketSystem.getTickets(Faction.OPFOR)
      );
    }
  }

  dispose(): void {
    this.elements.dispose();
    this.styles.dispose();
    console.log('🧹 HUD System disposed');
  }

  // Public API

  showHitMarker(type: 'normal' | 'kill' | 'headshot' = 'normal'): void {
    this.elements.showHitMarker(type);
  }

  addKill(): void {
    this.updater.addKill();
  }

  addDeath(): void {
    this.updater.addDeath();
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
    this.updater.updateTicketDisplay(usTickets, opforTickets);
  }

  showMessage(message: string, duration: number = 3000): void {
    this.elements.showMessage(message, duration);
  }

  updateAmmoDisplay(magazine: number, reserve: number): void {
    this.elements.updateAmmoDisplay(magazine, reserve);
  }
}