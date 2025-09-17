import * as THREE from 'three';
import { ZoneManager, CaptureZone, ZoneState } from '../../systems/world/ZoneManager';
import { Faction } from '../../systems/combat/types';
import { GameModeManager } from '../../systems/world/GameModeManager';

export class RespawnMapView {
  private zoneManager?: ZoneManager;
  private gameModeManager?: GameModeManager;

  // Canvas elements
  private mapCanvas: HTMLCanvasElement;
  private mapContext: CanvasRenderingContext2D;

  // Map settings
  private readonly MAP_SIZE = 600;
  private worldSize = 3200;

  // Selection state
  private selectedZoneId?: string;
  private onZoneSelected?: (zoneId: string, zoneName: string) => void;

  // Spawn zones
  private spawnableZones: CaptureZone[] = [];

  constructor() {
    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = this.MAP_SIZE;
    this.mapCanvas.height = this.MAP_SIZE;
    this.mapContext = this.mapCanvas.getContext('2d')!;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.mapCanvas.addEventListener('click', (e) => {
      const rect = this.mapCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.MAP_SIZE / rect.width);
      const y = (e.clientY - rect.top) * (this.MAP_SIZE / rect.height);
      this.handleMapClick(x, y);
    });

    // Hover effect
    this.mapCanvas.addEventListener('mousemove', (e) => {
      const rect = this.mapCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.MAP_SIZE / rect.width);
      const y = (e.clientY - rect.top) * (this.MAP_SIZE / rect.height);

      const zone = this.getZoneAtPosition(x, y);
      this.mapCanvas.style.cursor = zone && this.isZoneSpawnable(zone) ? 'pointer' : 'default';
    });
  }

  private handleMapClick(canvasX: number, canvasY: number): void {
    const zone = this.getZoneAtPosition(canvasX, canvasY);

    if (zone && this.isZoneSpawnable(zone)) {
      this.selectedZoneId = zone.id;

      if (this.onZoneSelected) {
        this.onZoneSelected(zone.id, zone.name);
      }

      this.render();
    }
  }

  private getZoneAtPosition(canvasX: number, canvasY: number): CaptureZone | undefined {
    if (!this.zoneManager) return undefined;

    const scale = this.MAP_SIZE / this.worldSize;
    const zones = this.zoneManager.getAllZones();

    for (const zone of zones) {
      // Convert world to canvas coordinates (flipped axes for north-up)
      const x = (this.worldSize / 2 - zone.position.x) * scale;
      const y = (this.worldSize / 2 - zone.position.z) * scale;
      const radius = Math.max(zone.radius * scale * 2, 20); // Min clickable area

      const dx = canvasX - x;
      const dy = canvasY - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        return zone;
      }
    }

    return undefined;
  }

  private isZoneSpawnable(zone: CaptureZone): boolean {
    // Can spawn at US home base
    if (zone.isHomeBase && zone.owner === Faction.US) {
      return true;
    }

    // Can spawn at US controlled zones if game mode allows
    const canSpawnAtZones = this.gameModeManager?.canPlayerSpawnAtZones() ?? false;
    if (canSpawnAtZones && !zone.isHomeBase && zone.state === ZoneState.US_CONTROLLED) {
      return true;
    }

    return false;
  }

  updateSpawnableZones(): void {
    if (!this.zoneManager) {
      this.spawnableZones = [];
      return;
    }

    const canSpawnAtZones = this.gameModeManager?.canPlayerSpawnAtZones() ?? false;

    this.spawnableZones = this.zoneManager.getAllZones().filter(zone => {
      if (zone.isHomeBase && zone.owner === Faction.US) return true;
      if (canSpawnAtZones && !zone.isHomeBase && zone.state === ZoneState.US_CONTROLLED) return true;
      return false;
    });
  }

  render(): void {
    const ctx = this.mapContext;
    const size = this.MAP_SIZE;

    // Clear canvas with tactical background
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, size, size);

    // Draw grid
    this.drawGrid(ctx);

    // Draw zones
    if (this.zoneManager) {
      const zones = this.zoneManager.getAllZones();
      zones.forEach(zone => this.drawZone(ctx, zone));
    }

    // Draw selected zone highlight
    if (this.selectedZoneId && this.zoneManager) {
      const zone = this.zoneManager.getAllZones().find(z => z.id === this.selectedZoneId);
      if (zone) {
        this.drawSelectionHighlight(ctx, zone);
      }
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const gridSize = 50;
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.05)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= this.MAP_SIZE; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, this.MAP_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(this.MAP_SIZE, i);
      ctx.stroke();
    }
  }

  private drawZone(ctx: CanvasRenderingContext2D, zone: CaptureZone): void {
    const scale = this.MAP_SIZE / this.worldSize;
    // North-up map with flipped axes
    const x = (this.worldSize / 2 - zone.position.x) * scale;
    const y = (this.worldSize / 2 - zone.position.z) * scale;
    const radius = Math.max(zone.radius * scale * 2, 15);

    const isSpawnable = this.isZoneSpawnable(zone);

    // Zone area
    ctx.fillStyle = this.getZoneColor(zone, 0.3, isSpawnable);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Zone border
    ctx.strokeStyle = this.getZoneColor(zone, 0.8, isSpawnable);
    ctx.lineWidth = isSpawnable ? 3 : 2;
    ctx.stroke();

    // Zone icon
    if (zone.isHomeBase) {
      // HQ square icon
      const iconSize = 12;
      ctx.fillStyle = this.getZoneColor(zone, 1, isSpawnable);
      ctx.fillRect(x - iconSize/2, y - iconSize/2, iconSize, iconSize);

      // HQ text
      ctx.fillStyle = '#000';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HQ', x, y);
    } else {
      // Regular zone dot
      ctx.fillStyle = this.getZoneColor(zone, 0.8, isSpawnable);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Zone name
    ctx.fillStyle = isSpawnable ? '#00ff00' : 'rgba(255, 255, 255, 0.6)';
    ctx.font = isSpawnable ? 'bold 11px monospace' : '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(zone.name, x, y - radius - 5);

    // Spawn indicator for spawnable zones
    if (isSpawnable) {
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('◈', x, y + radius + 2);
    }
  }

  private getZoneColor(zone: CaptureZone, alpha: number, isSpawnable: boolean): string {
    if (!isSpawnable && zone.owner !== Faction.OPFOR) {
      // Dim non-spawnable friendly zones
      return `rgba(100, 100, 100, ${alpha * 0.5})`;
    }

    if (zone.isHomeBase) {
      if (zone.owner === Faction.US) {
        return `rgba(0, 128, 255, ${alpha})`;
      } else {
        return `rgba(255, 0, 0, ${alpha})`;
      }
    }

    switch (zone.state) {
      case ZoneState.US_CONTROLLED:
        return `rgba(0, 255, 0, ${alpha})`;
      case ZoneState.OPFOR_CONTROLLED:
        return `rgba(255, 0, 0, ${alpha})`;
      case ZoneState.CONTESTED:
        return `rgba(255, 255, 0, ${alpha})`;
      default:
        return `rgba(128, 128, 128, ${alpha})`;
    }
  }

  private drawSelectionHighlight(ctx: CanvasRenderingContext2D, zone: CaptureZone): void {
    const scale = this.MAP_SIZE / this.worldSize;
    const x = (this.worldSize / 2 - zone.position.x) * scale;
    const y = (this.worldSize / 2 - zone.position.z) * scale;
    const radius = Math.max(zone.radius * scale * 2, 15) + 10;

    // Animated selection ring
    const time = Date.now() / 1000;
    const pulse = Math.sin(time * 3) * 0.2 + 0.8;

    ctx.strokeStyle = `rgba(0, 255, 0, ${pulse})`;
    ctx.lineWidth = 4;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = time * 10;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  // Public API
  getCanvas(): HTMLCanvasElement {
    return this.mapCanvas;
  }

  setZoneManager(manager: ZoneManager): void {
    this.zoneManager = manager;
    this.updateSpawnableZones();
  }

  setGameModeManager(manager: GameModeManager): void {
    this.gameModeManager = manager;
    if (manager) {
      this.worldSize = manager.getWorldSize();
    }
    this.updateSpawnableZones();
  }

  setZoneSelectedCallback(callback: (zoneId: string, zoneName: string) => void): void {
    this.onZoneSelected = callback;
  }

  clearSelection(): void {
    this.selectedZoneId = undefined;
    this.render();
  }

  getSelectedZoneId(): string | undefined {
    return this.selectedZoneId;
  }
}