import * as THREE from 'three';
import { GameSystem } from '../types';
import { Faction, CombatantSystem } from './CombatantSystem';

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
  private playerPosition = new THREE.Vector3();
  private camera?: THREE.Camera;

  // Zone configuration
  private readonly CAPTURE_RADIUS = 15; // Meters to be "in" the zone
  private readonly CAPTURE_SPEED = 10; // Progress per second with 1 attacker
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

    // Create initial zones
    this.createDefaultZones();

    console.log(`✅ Zone Manager initialized with ${this.zones.size} zones`);
  }

  private createDefaultZones(): void {
    // US Home Base (uncapturable)
    this.createZone({
      id: 'us_base',
      name: 'US Base',
      position: new THREE.Vector3(0, 0, -50),
      owner: Faction.US,
      isHomeBase: true,
      ticketBleedRate: 0
    });

    // OPFOR Home Base (uncapturable)
    this.createZone({
      id: 'opfor_base',
      name: 'OPFOR Base',
      position: new THREE.Vector3(0, 0, 150),
      owner: Faction.OPFOR,
      isHomeBase: true,
      ticketBleedRate: 0
    });

    // Capturable zones
    this.createZone({
      id: 'zone_alpha',
      name: 'Alpha',
      position: new THREE.Vector3(-40, 0, 20),
      owner: null,
      isHomeBase: false,
      ticketBleedRate: 1
    });

    this.createZone({
      id: 'zone_bravo',
      name: 'Bravo',
      position: new THREE.Vector3(0, 0, 50),
      owner: null,
      isHomeBase: false,
      ticketBleedRate: 2 // Center zone more valuable
    });

    this.createZone({
      id: 'zone_charlie',
      name: 'Charlie',
      position: new THREE.Vector3(40, 0, 20),
      owner: null,
      isHomeBase: false,
      ticketBleedRate: 1
    });
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

    // Create visual representation
    this.createZoneVisuals(zone);

    // Initialize occupant tracking
    this.occupants.set(zone.id, { us: 0, opfor: 0 });

    this.zones.set(zone.id, zone);
  }

  private createZoneVisuals(zone: CaptureZone): void {
    // Create capture area ring (flat on ground)
    const ringGeometry = new THREE.RingGeometry(zone.radius - 1, zone.radius, 32);
    const ringMaterial = this.getMaterialForState(zone.state);
    zone.zoneMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    zone.zoneMesh.rotation.x = -Math.PI / 2;
    zone.zoneMesh.position.copy(zone.position);
    zone.zoneMesh.position.y = 0.1; // Slightly above ground
    this.scene.add(zone.zoneMesh);

    // Create flag pole
    const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, zone.height, 8);
    const poleMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 });
    zone.flagPole = new THREE.Mesh(poleGeometry, poleMaterial);
    zone.flagPole.position.copy(zone.position);
    zone.flagPole.position.y = zone.height / 2;
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
    zone.opforFlagMesh.visible = zone.owner === Faction.OPFOR;
    this.scene.add(zone.opforFlagMesh);

    // Initialize flag height based on ownership
    if (zone.owner === Faction.US) {
      zone.currentFlagHeight = zone.height - 2;
      zone.usFlagMesh.position.y = zone.currentFlagHeight;
    } else if (zone.owner === Faction.OPFOR) {
      zone.currentFlagHeight = zone.height - 2;
      zone.opforFlagMesh.position.y = zone.currentFlagHeight;
    } else {
      zone.currentFlagHeight = 2; // Neutral - flags at bottom
      zone.usFlagMesh.position.y = 2;
      zone.opforFlagMesh.position.y = 2;
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
    zone.progressRing.position.y = 0.2;
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
    sprite.position.y = zone.height + 3;
    sprite.scale.set(10, 2.5, 1);
    this.scene.add(sprite);
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

    // Calculate target flag height based on capture progress
    let targetHeight = 2; // Bottom by default
    let showUSFlag = false;
    let showOPFORFlag = false;

    if (zone.owner === Faction.US) {
      // US owns - US flag at top
      targetHeight = zone.height - 2;
      showUSFlag = true;
    } else if (zone.owner === Faction.OPFOR) {
      // OPFOR owns - OPFOR flag at top
      targetHeight = zone.height - 2;
      showOPFORFlag = true;
    } else if (zone.state === ZoneState.CONTESTED) {
      // Being captured - raise flag based on progress
      targetHeight = 2 + ((zone.height - 4) * (zone.captureProgress / 100));

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