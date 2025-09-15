import * as THREE from 'three';
import { GameSystem } from '../../types';
import { ZoneManager, CaptureZone, ZoneState } from '../../systems/world/ZoneManager';
import { CombatantSystem } from '../../systems/combat/CombatantSystem';
import { Faction } from '../../systems/combat/types';

export class MinimapSystem implements GameSystem {
  private camera: THREE.Camera;
  private zoneManager?: ZoneManager;
  private combatantSystem?: CombatantSystem;

  // Canvas elements
  private minimapCanvas: HTMLCanvasElement;
  private minimapContext: CanvasRenderingContext2D;

  // Minimap settings
  private readonly MINIMAP_SIZE = 200; // Increased size for better visibility
  private readonly WORLD_SIZE = 300; // World units to display
  private readonly UPDATE_INTERVAL = 100; // ms between updates
  private lastUpdateTime = 0;

  // Player tracking
  private playerPosition = new THREE.Vector3();
  private playerRotation = 0;

  private readonly MINIMAP_STYLES = `
    .minimap-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 200px;
      height: 200px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 14px;
      overflow: hidden;
      background: rgba(10, 10, 14, 0.28);
      backdrop-filter: blur(6px) saturate(1.1);
      -webkit-backdrop-filter: blur(6px) saturate(1.1);
      z-index: 120;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
    }

    .minimap-canvas {
      width: 100%;
      height: 100%;
      image-rendering: pixelated;
      image-rendering: -moz-crisp-edges;
      image-rendering: crisp-edges;
    }

    .minimap-legend {
      position: absolute;
      bottom: 6px;
      left: 6px;
      color: rgba(255, 255, 255, 0.72);
      font-size: 9px;
      font-family: 'Courier New', monospace;
      pointer-events: none;
    }

    .minimap-north {
      position: absolute;
      top: 6px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255, 255, 255, 0.8);
      font-size: 11px;
      font-weight: bold;
      font-family: 'Courier New', monospace;
      pointer-events: none;
    }
  `;

  constructor(camera: THREE.Camera) {
    this.camera = camera;

    // Create minimap container
    const container = document.createElement('div');
    container.className = 'minimap-container';

    // Create canvas
    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.className = 'minimap-canvas';
    this.minimapCanvas.width = this.MINIMAP_SIZE;
    this.minimapCanvas.height = this.MINIMAP_SIZE;
    this.minimapContext = this.minimapCanvas.getContext('2d')!;

    // Add north indicator
    const northIndicator = document.createElement('div');
    northIndicator.className = 'minimap-north';
    northIndicator.textContent = 'N';

    // Add legend
    const legend = document.createElement('div');
    legend.className = 'minimap-legend';
    legend.innerHTML = `
      <div style="display: flex; align-items: center; gap: 3px;">
        <div style="width: 8px; height: 8px; background: #4488ff; border-radius: 50%;"></div>
        <span>US</span>
      </div>
      <div style="display: flex; align-items: center; gap: 3px;">
        <div style="width: 8px; height: 8px; background: #ff4444; border-radius: 50%;"></div>
        <span>OPFOR</span>
      </div>
    `;

    container.appendChild(this.minimapCanvas);
    container.appendChild(northIndicator);
    container.appendChild(legend);

    // Add styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = this.MINIMAP_STYLES;
    document.head.appendChild(styleSheet);

    // Store container reference for disposal
    (this.minimapCanvas as any).containerElement = container;
  }

  async init(): Promise<void> {
    console.log('🗺️ Initializing Minimap System...');

    // Add to DOM
    const container = (this.minimapCanvas as any).containerElement;
    if (container) {
      document.body.appendChild(container);
    }

    console.log('✅ Minimap System initialized');
  }

  update(deltaTime: number): void {
    // Update player position and rotation
    this.playerPosition.copy(this.camera.position);

    // Get camera direction for rotation - properly fixed
    const cameraDir = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDir);
    // Fixed: use positive values for correct orientation
    this.playerRotation = Math.atan2(cameraDir.x, cameraDir.z);

    // Throttle updates
    const now = Date.now();
    if (now - this.lastUpdateTime < this.UPDATE_INTERVAL) return;
    this.lastUpdateTime = now;

    this.renderMinimap();
  }

  private renderMinimap(): void {
    const ctx = this.minimapContext;
    const size = this.MINIMAP_SIZE;
    const halfSize = size / 2;

    // Clear canvas with dark background
    ctx.fillStyle = 'rgba(20, 20, 30, 0.9)';
    ctx.fillRect(0, 0, size, size);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridSize = 20;
    for (let i = 0; i <= size; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    // Draw zones
    if (this.zoneManager) {
      const zones = this.zoneManager.getAllZones();
      zones.forEach(zone => {
        this.drawZone(ctx, zone);
      });
    }

    // Draw combatants
    if (this.combatantSystem) {
      const stats = this.combatantSystem.getCombatStats();
      // Draw a simple indicator of combat presence
      this.drawCombatantIndicators(ctx);
    }

    // Draw player (always in center)
    this.drawPlayer(ctx);

    // Draw view cone
    this.drawViewCone(ctx);
  }

  private drawZone(ctx: CanvasRenderingContext2D, zone: CaptureZone): void {
    // Convert world position to minimap position
    const relativePos = new THREE.Vector3()
      .subVectors(zone.position, this.playerPosition);

    // Rotate relative to player view - fix inverted X
    const cos = Math.cos(this.playerRotation);
    const sin = Math.sin(this.playerRotation);
    // Invert X rotation to fix left/right
    const rotatedX = -(relativePos.x * cos - relativePos.z * sin);
    const rotatedZ = relativePos.x * sin + relativePos.z * cos;

    // Scale to minimap
    const scale = this.MINIMAP_SIZE / this.WORLD_SIZE;
    const x = this.MINIMAP_SIZE / 2 + rotatedX * scale;
    const y = this.MINIMAP_SIZE / 2 - rotatedZ * scale; // Invert Y for screen coordinates

    // Skip if outside minimap bounds
    if (x < -20 || x > this.MINIMAP_SIZE + 20 || y < -20 || y > this.MINIMAP_SIZE + 20) return;

    // Draw zone circle
    const zoneRadius = zone.radius * scale;

    // Zone fill color based on state
    switch (zone.state) {
      case ZoneState.US_CONTROLLED:
        ctx.fillStyle = 'rgba(68, 136, 255, 0.3)';
        ctx.strokeStyle = '#4488ff';
        break;
      case ZoneState.OPFOR_CONTROLLED:
        ctx.fillStyle = 'rgba(255, 68, 68, 0.3)';
        ctx.strokeStyle = '#ff4444';
        break;
      case ZoneState.CONTESTED:
        ctx.fillStyle = 'rgba(255, 255, 68, 0.3)';
        ctx.strokeStyle = '#ffff44';
        break;
      default:
        ctx.fillStyle = 'rgba(128, 128, 128, 0.3)';
        ctx.strokeStyle = '#888888';
    }

    // Draw zone area
    ctx.beginPath();
    ctx.arc(x, y, zoneRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw zone flag/marker
    if (zone.isHomeBase) {
      // Draw home base as square
      ctx.fillStyle = zone.state === ZoneState.US_CONTROLLED ? '#4488ff' : '#ff4444';
      ctx.fillRect(x - 6, y - 6, 12, 12);
    } else {
      // Draw capture point as flag
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 8, y - 4);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }

    // Draw zone name
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(zone.name, x, y + zoneRadius + 12);

    // Draw capture progress if contested
    if (zone.state === ZoneState.CONTESTED) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(x - 15, y + zoneRadius + 15, 30, 3);
      ctx.fillStyle = '#ffff44';
      ctx.fillRect(x - 15, y + zoneRadius + 15, 30 * (zone.captureProgress / 100), 3);
    }
  }

  private drawCombatantIndicators(ctx: CanvasRenderingContext2D): void {
    // Draw combat intensity indicators in quadrants
    const quadrantSize = this.MINIMAP_SIZE / 4;

    // This is simplified - in a real implementation you'd track actual combatant positions
    // For now, just show general combat areas

    // Top-right quadrant (example combat zone)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.arc(this.MINIMAP_SIZE * 0.75, this.MINIMAP_SIZE * 0.25, quadrantSize, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const centerX = this.MINIMAP_SIZE / 2;
    const centerY = this.MINIMAP_SIZE / 2;

    // Player dot
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Player outline
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawViewCone(ctx: CanvasRenderingContext2D): void {
    const centerX = this.MINIMAP_SIZE / 2;
    const centerY = this.MINIMAP_SIZE / 2;

    // Draw view direction line - always points up as player faces forward
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, centerY - 25); // Points up (forward direction)
    ctx.stroke();

    // Add arrow head for clarity
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 25);
    ctx.lineTo(centerX - 5, centerY - 20);
    ctx.lineTo(centerX + 5, centerY - 20);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.fill();

    // Draw FOV cone
    const fovAngle = Math.PI / 4; // 45 degrees each side
    const coneLength = 30;

    ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, coneLength, -Math.PI/2 - fovAngle, -Math.PI/2 + fovAngle);
    ctx.closePath();
    ctx.fill();
  }

  // System connections

  setZoneManager(manager: ZoneManager): void {
    this.zoneManager = manager;
  }

  setCombatantSystem(system: CombatantSystem): void {
    this.combatantSystem = system;
  }

  dispose(): void {
    const container = (this.minimapCanvas as any).containerElement;
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    console.log('🧹 Minimap System disposed');
  }
}