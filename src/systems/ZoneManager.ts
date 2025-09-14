import * as THREE from 'three';
import { GameSystem } from '../types';
import { Faction, CombatantSystem } from './CombatantSystem';
import { ImprovedChunkManager } from './ImprovedChunkManager';

export enum ZoneState {
  NEUTRAL = 'neutral',
  US_CONTROLLED = 'us_controlled',
  OPFOR_CONTROLLED = 'opfor_controlled',
  CONTESTED = 'contested'
}

export interface CaptureZone {
  id: string;
  name: string;
  position: THREE.Vector3;
  radius: number;
  height: number; // Visual height of the flag/marker

  // Ownership
  owner: Faction | null;
  state: ZoneState;
  captureProgress: number; // 0-100, progress toward capture
  captureSpeed: number; // Rate of capture per second

  // Visual elements
  flagMesh?: THREE.Mesh;
  usFlagMesh?: THREE.Mesh;
  opforFlagMesh?: THREE.Mesh;
  flagPole?: THREE.Mesh;
  zoneMesh?: THREE.Mesh;
  progressRing?: THREE.Mesh;
  labelSprite?: THREE.Sprite;

  // Flag animation state
  currentFlagHeight: number;

  // Strategic value
  isHomeBase: boolean; // Can't be captured (spawn point)
  ticketBleedRate: number; // How much it contributes to ticket drain
}

export class ZoneManager implements GameSystem {
  private scene: THREE.Scene;
  private zones: Map<string, CaptureZone> = new Map();
  private combatantSystem?: CombatantSystem;
  private chunkManager?: ImprovedChunkManager;
  private playerPosition = new THREE.Vector3();
  private camera?: THREE.Camera;

  // Zone configuration
  private readonly CAPTURE_RADIUS = 15; // Meters to be "in" the zone
  private readonly CAPTURE_SPEED = 1; // Progress per second with 1 attacker (very slow capture)
  private readonly CONTEST_THRESHOLD = 0.3; // Ratio needed to contest

  // Visual materials
  private neutralMaterial: THREE.MeshBasicMaterial;
  private usMaterial: THREE.MeshBasicMaterial;
  private opforMaterial: THREE.MeshBasicMaterial;
  private contestedMaterial: THREE.MeshBasicMaterial;

  // Zone tracking
  private occupants: Map<string, { us: number; opfor: number }> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create materials for zone visualization
    this.neutralMaterial = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.3
    });

    this.usMaterial = new THREE.MeshBasicMaterial({
      color: 0x0066cc,  // Blue for US
      transparent: true,
      opacity: 0.3
    });

    this.opforMaterial = new THREE.MeshBasicMaterial({
      color: 0xcc0000,  // Red for OPFOR
      transparent: true,
      opacity: 0.3
    });

    this.contestedMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,  // Orange for contested
      transparent: true,
      opacity: 0.3
    });
  }

  async init(): Promise<void> {
    console.log('🚩 Initializing Zone Manager...');

    // Don't create zones yet - wait for chunk manager to be set
    console.log('⏳ Zone Manager initialized, waiting for ChunkManager connection...');
  }

  private createDefaultZones(): void {
    // Find suitable positions with good terrain
    const usBasePos = this.findSuitableZonePosition(new THREE.Vector3(0, 0, -50), 30);
    const opforBasePos = this.findSuitableZonePosition(new THREE.Vector3(0, 0, 145), 30);

    // US Home Base (uncapturable)
    this.createZone({
      id: 'us_base',
      name: 'US Base',
      position: usBasePos,
      owner: Faction.US,
      isHomeBase: true,
      ticketBleedRate: 0
    });

    // OPFOR Home Base (uncapturable)
    this.createZone({
      id: 'opfor_base',
      name: 'OPFOR Base',
      position: opforBasePos,
      owner: Faction.OPFOR,
      isHomeBase: true,
      ticketBleedRate: 0
    });

    // Capturable zones - increased spacing and find flat terrain
    const alphaPos = this.findSuitableZonePosition(new THREE.Vector3(-120, 0, 50), 40);
    this.createZone({
      id: 'zone_alpha',
      name: 'Alpha',
      position: alphaPos,
      owner: null,
      isHomeBase: false,
      ticketBleedRate: 1
    });

    const bravoPos = this.findSuitableZonePosition(new THREE.Vector3(0, 0, 50), 40);
    this.createZone({
      id: 'zone_bravo',
      name: 'Bravo',
      position: bravoPos,
      owner: null,
      isHomeBase: false,
      ticketBleedRate: 2 // Center zone more valuable
    });

    const charliePos = this.findSuitableZonePosition(new THREE.Vector3(120, 0, 50), 40);
    this.createZone({
      id: 'zone_charlie',
      name: 'Charlie',
      position: charliePos,
      owner: null,
      isHomeBase: false,
      ticketBleedRate: 1
    });
  }

  /**
   * Find a suitable position for a zone near the desired location
   * Searches for relatively flat terrain
   */
  private findSuitableZonePosition(desiredPos: THREE.Vector3, searchRadius: number): THREE.Vector3 {
    if (!this.chunkManager) {
      console.error('❌ ChunkManager not available for terrain height query!');
      // This should not happen anymore
      return new THREE.Vector3(desiredPos.x, 0, desiredPos.z);
    }

    let bestPos = desiredPos.clone();
    let bestSlope = Infinity;
    const samples = 12; // Number of positions to test

    // Test the desired position first
    const centerHeight = this.chunkManager.getHeightAt(desiredPos.x, desiredPos.z);
    const centerSlope = this.calculateTerrainSlope(desiredPos.x, desiredPos.z);
    bestPos.y = centerHeight;
    bestSlope = centerSlope;

    // Search in a spiral pattern for flatter terrain
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      const distance = searchRadius * (0.5 + Math.random() * 0.5);
      const testX = desiredPos.x + Math.cos(angle) * distance;
      const testZ = desiredPos.z + Math.sin(angle) * distance;

      const height = this.chunkManager.getHeightAt(testX, testZ);
      const slope = this.calculateTerrainSlope(testX, testZ);

      // Prefer flatter terrain (lower slope)
      if (slope < bestSlope && height > -2) { // Avoid water (height > -2)
        bestSlope = slope;
        bestPos = new THREE.Vector3(testX, height, testZ);
      }
    }

    console.log(`🚩 Zone placed at (${bestPos.x.toFixed(1)}, ${bestPos.y.toFixed(1)}, ${bestPos.z.toFixed(1)}) with slope ${bestSlope.toFixed(2)}`);

    // Additional debug check for Alpha zone
    if (Math.abs(bestPos.x + 120) < 10) { // This is likely Alpha zone
      console.warn(`⚠️ Alpha zone terrain check: desired=(${desiredPos.x}, ${desiredPos.z}), final=(${bestPos.x}, ${bestPos.y}, ${bestPos.z})`);
      // If height is very negative or very high, try to find a better spot
      if (bestPos.y < -5 || bestPos.y > 50) {
        console.warn(`⚠️ Alpha zone height ${bestPos.y} seems problematic, adjusting...`);
        // Try positions closer to center
        for (let attempt = 0; attempt < 5; attempt++) {
          const testX = -80 + attempt * 10; // Move closer to center
          const testZ = 30 + attempt * 10;
          const testHeight = this.chunkManager.getHeightAt(testX, testZ);
          if (testHeight > -2 && testHeight < 30) {
            bestPos = new THREE.Vector3(testX, testHeight, testZ);
            console.log(`🔧 Alpha zone relocated to (${testX}, ${testHeight.toFixed(1)}, ${testZ})`);
            break;
          }
        }
      }
    }

    return bestPos;
  }

  /**
   * Calculate terrain slope at a position by sampling nearby heights
   */
  private calculateTerrainSlope(x: number, z: number): number {
    if (!this.chunkManager) return 0;

    const sampleDistance = 5; // Sample 5 units away
    const centerHeight = this.chunkManager.getHeightAt(x, z);

    // Sample heights in 4 directions
    const northHeight = this.chunkManager.getHeightAt(x, z + sampleDistance);
    const southHeight = this.chunkManager.getHeightAt(x, z - sampleDistance);
    const eastHeight = this.chunkManager.getHeightAt(x + sampleDistance, z);
    const westHeight = this.chunkManager.getHeightAt(x - sampleDistance, z);

    // Calculate maximum height difference (slope)
    const maxDiff = Math.max(
      Math.abs(northHeight - centerHeight),
      Math.abs(southHeight - centerHeight),
      Math.abs(eastHeight - centerHeight),
      Math.abs(westHeight - centerHeight)
    );

    return maxDiff / sampleDistance; // Return slope as rise/run
  }

  private createZone(config: {
    id: string;
    name: string;
    position: THREE.Vector3;
    owner: Faction | null;
    isHomeBase: boolean;
    ticketBleedRate: number;
  }): void {
    const zone: CaptureZone = {
      id: config.id,
      name: config.name,
      position: config.position.clone(),
      radius: this.CAPTURE_RADIUS,
      height: 20,
      owner: config.owner,
      state: config.owner ?
        (config.owner === Faction.US ? ZoneState.US_CONTROLLED : ZoneState.OPFOR_CONTROLLED) :
        ZoneState.NEUTRAL,
      captureProgress: config.owner ? 100 : 0,
      captureSpeed: this.CAPTURE_SPEED,
      isHomeBase: config.isHomeBase,
      ticketBleedRate: config.ticketBleedRate,
      currentFlagHeight: 0
    };

    // Log zone creation for debugging
    console.log(`📍 Creating zone "${zone.name}" at position (${zone.position.x.toFixed(1)}, ${zone.position.y.toFixed(1)}, ${zone.position.z.toFixed(1)})`);

    // Create visual representation
    this.createZoneVisuals(zone);

    // Initialize occupant tracking
    this.occupants.set(zone.id, { us: 0, opfor: 0 });

    this.zones.set(zone.id, zone);
  }

  private createZoneVisuals(zone: CaptureZone): void {
    // Get terrain height at zone position
    const terrainHeight = zone.position.y;

    // Create capture area ring (flat on ground)
    const ringGeometry = new THREE.RingGeometry(zone.radius - 1, zone.radius, 32);
    const ringMaterial = this.getMaterialForState(zone.state);
    zone.zoneMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    zone.zoneMesh.rotation.x = -Math.PI / 2;
    zone.zoneMesh.position.copy(zone.position);
    zone.zoneMesh.position.y = terrainHeight + 0.1; // Slightly above terrain
    this.scene.add(zone.zoneMesh);

    // Create flag pole
    const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, zone.height, 8);
    const poleMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 });
    zone.flagPole = new THREE.Mesh(poleGeometry, poleMaterial);
    zone.flagPole.position.copy(zone.position);
    zone.flagPole.position.y = terrainHeight + zone.height / 2;
    this.scene.add(zone.flagPole);

    // Create both flags (US and OPFOR) - only one visible at a time
    const flagGeometry = new THREE.PlaneGeometry(5, 3);

    // US Flag (blue)
    const usFlagMaterial = new THREE.MeshBasicMaterial({
      color: 0x0066cc,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    zone.usFlagMesh = new THREE.Mesh(flagGeometry, usFlagMaterial);
    zone.usFlagMesh.position.copy(zone.position);
    zone.usFlagMesh.position.x += 2.5;
    zone.usFlagMesh.position.y = terrainHeight; // Start at terrain level
    zone.usFlagMesh.visible = zone.owner === Faction.US;
    this.scene.add(zone.usFlagMesh);

    // OPFOR Flag (red)
    const opforFlagMaterial = new THREE.MeshBasicMaterial({
      color: 0xcc0000,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    zone.opforFlagMesh = new THREE.Mesh(flagGeometry, opforFlagMaterial);
    zone.opforFlagMesh.position.copy(zone.position);
    zone.opforFlagMesh.position.x += 2.5;
    zone.opforFlagMesh.position.y = terrainHeight; // Start at terrain level
    zone.opforFlagMesh.visible = zone.owner === Faction.OPFOR;
    this.scene.add(zone.opforFlagMesh);

    // Initialize flag height based on ownership (relative to terrain)
    const terrainY = zone.position.y;
    if (zone.owner === Faction.US) {
      zone.currentFlagHeight = terrainY + zone.height - 2;
      zone.usFlagMesh.position.y = zone.currentFlagHeight;
    } else if (zone.owner === Faction.OPFOR) {
      zone.currentFlagHeight = terrainY + zone.height - 2;
      zone.opforFlagMesh.position.y = zone.currentFlagHeight;
    } else {
      zone.currentFlagHeight = terrainY + 2; // Neutral - flags at bottom
      zone.usFlagMesh.position.y = terrainY + 2;
      zone.opforFlagMesh.position.y = terrainY + 2;
    }

    // Create progress ring (will be updated during capture)
    const progressGeometry = new THREE.RingGeometry(zone.radius + 0.5, zone.radius + 1, 32, 1, 0, 0);
    const progressMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    zone.progressRing = new THREE.Mesh(progressGeometry, progressMaterial);
    zone.progressRing.rotation.x = -Math.PI / 2;
    zone.progressRing.position.copy(zone.position);
    zone.progressRing.position.y = terrainHeight + 0.2; // Above terrain
    zone.progressRing.visible = false; // Hidden until capture starts
    this.scene.add(zone.progressRing);

    // Add zone name text (billboard style)
    this.createZoneLabel(zone);
  }

  private createZoneLabel(zone: CaptureZone): void {
    // Create a simple sprite for zone name
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;

    // Draw text
    context.fillStyle = 'white';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.fillText(zone.name.toUpperCase(), 128, 48);

    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(zone.position);
    sprite.position.y = zone.position.y + zone.height + 3; // Above pole on terrain
    sprite.scale.set(10, 2.5, 1);
    this.scene.add(sprite);

    // Store reference for updating
    zone.labelSprite = sprite;
  }

  private getMaterialForState(state: ZoneState): THREE.MeshBasicMaterial {
    switch (state) {
      case ZoneState.US_CONTROLLED:
        return this.usMaterial;
      case ZoneState.OPFOR_CONTROLLED:
        return this.opforMaterial;
      case ZoneState.CONTESTED:
        return this.contestedMaterial;
      default:
        return this.neutralMaterial;
    }
  }

  private updateZonePositions(): void {
    if (!this.chunkManager) return;

    this.zones.forEach(zone => {
      // Get current terrain height at zone position
      const terrainHeight = this.chunkManager ? this.chunkManager.getHeightAt(zone.position.x, zone.position.z) : 0;

      // Update zone position Y to match terrain
      zone.position.y = terrainHeight;

      // Update all visual elements to match new height
      if (zone.zoneMesh) {
        zone.zoneMesh.position.y = terrainHeight + 0.1; // Slightly above terrain
      }

      if (zone.flagPole) {
        zone.flagPole.position.y = terrainHeight + zone.height / 2;
      }

      if (zone.progressRing) {
        zone.progressRing.position.y = terrainHeight + 0.2;
      }

      if (zone.labelSprite) {
        zone.labelSprite.position.x = zone.position.x;
        zone.labelSprite.position.y = terrainHeight + zone.height + 3;
        zone.labelSprite.position.z = zone.position.z;
      }

      // Update flag base positions (they animate from here)
      const flagBaseY = terrainHeight + 2;
      const flagTopY = terrainHeight + zone.height - 2;

      // Recalculate current flag height relative to new terrain
      if (zone.owner === Faction.US || zone.owner === Faction.OPFOR) {
        zone.currentFlagHeight = flagTopY;
      } else if (zone.state === ZoneState.CONTESTED) {
        // Maintain capture progress height relative to new terrain
        const progress = zone.captureProgress / 100;
        zone.currentFlagHeight = flagBaseY + ((flagTopY - flagBaseY) * progress);
      } else {
        zone.currentFlagHeight = flagBaseY;
      }
    });
  }

  private updateZoneOccupants(): void {
    // Clear occupant counts
    this.zones.forEach(zone => {
      this.occupants.set(zone.id, { us: 0, opfor: 0 });
    });

    // Check player position
    this.zones.forEach(zone => {
      const distance = this.playerPosition.distanceTo(zone.position);
      if (distance <= zone.radius) {
        const occupants = this.occupants.get(zone.id)!;
        occupants.us += 1; // Player is always US
        console.log(`Player in zone ${zone.name}`);
      }
    });

    // Check combatant positions
    if (this.combatantSystem) {
      const combatants = this.combatantSystem.getAllCombatants();
      combatants.forEach(combatant => {
        // Skip dead combatants
        if (combatant.state === 'dead') return;

        this.zones.forEach(zone => {
          const distance = combatant.position.distanceTo(zone.position);
          if (distance <= zone.radius) {
            const occupants = this.occupants.get(zone.id)!;
            if (combatant.faction === Faction.US) {
              occupants.us += 1;
            } else if (combatant.faction === Faction.OPFOR) {
              occupants.opfor += 1;
            }
          }
        });
      });
    }
  }

  update(deltaTime: number): void {
    // Update player position
    if (this.camera) {
      this.playerPosition.copy(this.camera.position);
    }

    // Update zone positions to match terrain height
    this.updateZonePositions();

    // First update who's in each zone
    this.updateZoneOccupants();

    // Update each zone based on occupants
    this.zones.forEach(zone => {
      if (zone.isHomeBase) return; // Skip home bases

      const occupants = this.occupants.get(zone.id);
      if (!occupants) return;

      // Determine capture state
      const { us, opfor } = occupants;
      const total = us + opfor;

      if (total === 0) {
        // No one in zone, no change
        zone.state = this.getStateForOwner(zone.owner);
        this.updateZoneVisuals(zone);
        return;
      }

      // Calculate capture dynamics
      const usRatio = us / total;
      const opforRatio = opfor / total;

      // Determine if zone is contested
      if (usRatio > this.CONTEST_THRESHOLD && opforRatio > this.CONTEST_THRESHOLD) {
        zone.state = ZoneState.CONTESTED;
        // No progress change when contested
      } else if (usRatio > opforRatio) {
        // US capturing
        if (zone.owner !== Faction.US) {
          zone.captureProgress += zone.captureSpeed * deltaTime * us;
          zone.state = ZoneState.CONTESTED;

          if (zone.captureProgress >= 100) {
            zone.captureProgress = 100;
            zone.owner = Faction.US;
            zone.state = ZoneState.US_CONTROLLED;
            console.log(`🚩 Zone ${zone.name} captured by US!`);
          }
        } else {
          zone.state = ZoneState.US_CONTROLLED;
        }
      } else if (opforRatio > usRatio) {
        // OPFOR capturing
        if (zone.owner !== Faction.OPFOR) {
          zone.captureProgress += zone.captureSpeed * deltaTime * opfor;
          zone.state = ZoneState.CONTESTED;

          if (zone.captureProgress >= 100) {
            zone.captureProgress = 100;
            zone.owner = Faction.OPFOR;
            zone.state = ZoneState.OPFOR_CONTROLLED;
            console.log(`🚩 Zone ${zone.name} captured by OPFOR!`);
          }
        } else {
          zone.state = ZoneState.OPFOR_CONTROLLED;
        }
      }

      // Neutralize progress if switching sides
      if (zone.owner === Faction.US && opforRatio > usRatio) {
        zone.captureProgress -= zone.captureSpeed * deltaTime * opfor;
        if (zone.captureProgress <= 0) {
          zone.captureProgress = 0;
          zone.owner = null;
          zone.state = ZoneState.NEUTRAL;
        }
      } else if (zone.owner === Faction.OPFOR && usRatio > opforRatio) {
        zone.captureProgress -= zone.captureSpeed * deltaTime * us;
        if (zone.captureProgress <= 0) {
          zone.captureProgress = 0;
          zone.owner = null;
          zone.state = ZoneState.NEUTRAL;
        }
      }

      this.updateZoneVisuals(zone);
    });

    // Animate flags
    this.animateFlags(deltaTime);
  }

  private getStateForOwner(owner: Faction | null): ZoneState {
    if (!owner) return ZoneState.NEUTRAL;
    return owner === Faction.US ? ZoneState.US_CONTROLLED : ZoneState.OPFOR_CONTROLLED;
  }

  private updateZoneVisuals(zone: CaptureZone): void {
    if (!zone.zoneMesh) return;

    // Update zone ring color
    (zone.zoneMesh.material as THREE.MeshBasicMaterial).copy(this.getMaterialForState(zone.state));

    // Calculate target flag height based on capture progress (relative to terrain)
    const terrainHeight = zone.position.y;
    let targetHeight = terrainHeight + 2; // Bottom by default
    let showUSFlag = false;
    let showOPFORFlag = false;

    if (zone.owner === Faction.US) {
      // US owns - US flag at top
      targetHeight = terrainHeight + zone.height - 2;
      showUSFlag = true;
    } else if (zone.owner === Faction.OPFOR) {
      // OPFOR owns - OPFOR flag at top
      targetHeight = terrainHeight + zone.height - 2;
      showOPFORFlag = true;
    } else if (zone.state === ZoneState.CONTESTED) {
      // Being captured - raise flag based on progress
      targetHeight = terrainHeight + 2 + ((zone.height - 4) * (zone.captureProgress / 100));

      // Show the capturing faction's flag
      // We need to determine who's capturing based on occupants
      const occupants = this.occupants.get(zone.id);
      if (occupants) {
        if (occupants.us > occupants.opfor) {
          showUSFlag = true;
        } else if (occupants.opfor > occupants.us) {
          showOPFORFlag = true;
        }
      }
    }

    // Smoothly animate flag height
    const lerpSpeed = 0.05;
    zone.currentFlagHeight = THREE.MathUtils.lerp(zone.currentFlagHeight, targetHeight, lerpSpeed);

    // Update flag visibility and positions
    if (zone.usFlagMesh) {
      zone.usFlagMesh.visible = showUSFlag;
      if (showUSFlag) {
        zone.usFlagMesh.position.y = zone.currentFlagHeight;
      }
    }

    if (zone.opforFlagMesh) {
      zone.opforFlagMesh.visible = showOPFORFlag;
      if (showOPFORFlag) {
        zone.opforFlagMesh.position.y = zone.currentFlagHeight;
      }
    }

    // Update progress ring
    if (zone.progressRing) {
      if (zone.state === ZoneState.CONTESTED) {
        zone.progressRing.visible = true;
        // Update progress ring geometry to show capture progress
        const angle = (zone.captureProgress / 100) * Math.PI * 2;
        zone.progressRing.geometry.dispose();
        zone.progressRing.geometry = new THREE.RingGeometry(
          zone.radius + 0.5,
          zone.radius + 1,
          32,
          1,
          0,
          angle
        );
      } else {
        zone.progressRing.visible = false;
      }
    }
  }

  private animateFlags(deltaTime: number): void {
    // Simple flag waving animation
    const time = Date.now() * 0.001;
    this.zones.forEach(zone => {
      const waveAmount = Math.sin(time + zone.position.x) * 0.2;

      if (zone.usFlagMesh && zone.usFlagMesh.visible) {
        zone.usFlagMesh.rotation.y = waveAmount;
      }

      if (zone.opforFlagMesh && zone.opforFlagMesh.visible) {
        zone.opforFlagMesh.rotation.y = waveAmount;
      }
    });
  }

  // Public API for other systems

  /**
   * Update occupant count for a zone
   */
  updateOccupants(zoneId: string, usCount: number, opforCount: number): void {
    const occupants = this.occupants.get(zoneId);
    if (occupants) {
      occupants.us = usCount;
      occupants.opfor = opforCount;
    }
  }

  /**
   * Check if a position is within a zone
   */
  getZoneAtPosition(position: THREE.Vector3): CaptureZone | null {
    for (const zone of this.zones.values()) {
      const distance = position.distanceTo(zone.position);
      if (distance <= zone.radius) {
        return zone;
      }
    }
    return null;
  }

  /**
   * Get all zones
   */
  getAllZones(): CaptureZone[] {
    return Array.from(this.zones.values());
  }

  setCombatantSystem(system: CombatantSystem): void {
    this.combatantSystem = system;
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  setChunkManager(chunkManager: ImprovedChunkManager): void {
    this.chunkManager = chunkManager;
    console.log('🔗 ChunkManager connected to ZoneManager');
    // Don't create zones yet - wait for explicit initialization
  }

  /**
   * Initialize zones after chunks are loaded
   */
  initializeZones(): void {
    if (this.zones.size === 0 && this.chunkManager) {
      console.log('🚩 Creating zones with terrain mapping...');
      this.createDefaultZones();
      console.log(`✅ Zones created with terrain mapping: ${this.zones.size} zones`);
    }
  }

  /**
   * Get zones by owner
   */
  getZonesByOwner(faction: Faction): CaptureZone[] {
    return Array.from(this.zones.values()).filter(z => z.owner === faction);
  }

  /**
   * Calculate total ticket bleed rate based on zone control
   */
  getTicketBleedRate(): { us: number; opfor: number } {
    let usBleed = 0;
    let opforBleed = 0;

    const capturedZones = Array.from(this.zones.values()).filter(z => !z.isHomeBase && z.owner !== null);
    const usZones = capturedZones.filter(z => z.owner === Faction.US).length;
    const opforZones = capturedZones.filter(z => z.owner === Faction.OPFOR).length;

    // Majority holder causes ticket bleed for opponent
    if (usZones > opforZones) {
      opforBleed = (usZones - opforZones) * 0.5; // 0.5 tickets per second per zone advantage
    } else if (opforZones > usZones) {
      usBleed = (opforZones - usZones) * 0.5;
    }

    return { us: usBleed, opfor: opforBleed };
  }

  /**
   * Get nearest capturable zone to a position
   */
  getNearestCapturableZone(position: THREE.Vector3, faction?: Faction): CaptureZone | null {
    let nearest: CaptureZone | null = null;
    let minDistance = Infinity;

    this.zones.forEach(zone => {
      if (zone.isHomeBase) return;
      if (faction && zone.owner === faction) return; // Skip if already owned by faction

      const distance = position.distanceTo(zone.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = zone;
      }
    });

    return nearest;
  }

  dispose(): void {
    // Clean up visuals
    this.zones.forEach(zone => {
      if (zone.zoneMesh) {
        zone.zoneMesh.geometry.dispose();
        this.scene.remove(zone.zoneMesh);
      }
      if (zone.flagMesh) {
        zone.flagMesh.geometry.dispose();
        this.scene.remove(zone.flagMesh);
      }
      if (zone.progressRing) {
        zone.progressRing.geometry.dispose();
        this.scene.remove(zone.progressRing);
      }
    });

    // Dispose materials
    this.neutralMaterial.dispose();
    this.usMaterial.dispose();
    this.opforMaterial.dispose();
    this.contestedMaterial.dispose();

    this.zones.clear();
    this.occupants.clear();

    console.log('🧹 Zone Manager disposed');
  }
}