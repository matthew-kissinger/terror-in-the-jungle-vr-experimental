import * as THREE from 'three';
import { GameSystem } from '../../types';
import { GlobalBillboardSystem } from '../world/billboard/GlobalBillboardSystem';
import { AssetLoader } from '../assets/AssetLoader';
import { ImprovedChunkManager } from '../terrain/ImprovedChunkManager';
import { Combatant, CombatantState, Faction } from './types';
import { TracerPool } from '../effects/TracerPool';
import { MuzzleFlashPool } from '../effects/MuzzleFlashPool';
import { ImpactEffectsPool } from '../effects/ImpactEffectsPool';
import { TicketSystem } from '../world/TicketSystem';
import { PlayerHealthSystem } from '../player/PlayerHealthSystem';
import { ZoneManager } from '../world/ZoneManager';
import { AudioManager } from '../audio/AudioManager';

// Refactored modules
import { CombatantFactory } from './CombatantFactory';
import { CombatantAI } from './CombatantAI';
import { CombatantCombat } from './CombatantCombat';
import { CombatantMovement } from './CombatantMovement';
import { CombatantRenderer } from './CombatantRenderer';
import { SquadManager } from './SquadManager';

export class CombatantSystem implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private globalBillboardSystem: GlobalBillboardSystem;
  private assetLoader: AssetLoader;
  private chunkManager?: ImprovedChunkManager;
  private ticketSystem?: TicketSystem;
  private playerHealthSystem?: PlayerHealthSystem;
  private zoneManager?: ZoneManager;
  private audioManager?: AudioManager;

  // Refactored modules
  private combatantFactory: CombatantFactory;
  private combatantAI: CombatantAI;
  private combatantCombat: CombatantCombat;
  private combatantMovement: CombatantMovement;
  private combatantRenderer: CombatantRenderer;
  private squadManager: SquadManager;

  // Effects pools
  private tracerPool: TracerPool;
  private muzzleFlashPool: MuzzleFlashPool;
  private impactEffectsPool: ImpactEffectsPool;

  // Combatant management
  private combatants: Map<string, Combatant> = new Map();

  // Player tracking
  private playerPosition = new THREE.Vector3();
  private playerFaction = Faction.US;

  // Spawn management
  private readonly MAX_COMBATANTS = 60;
  private readonly DESPAWN_DISTANCE = 150;
  private lastSpawnCheck = 0;
  private readonly SPAWN_CHECK_INTERVAL = 3000;
  private readonly PROGRESSIVE_SPAWN_DELAY = 1000;
  private progressiveSpawnTimer = 0;
  private progressiveSpawnQueue: Array<{faction: Faction, position: THREE.Vector3, size: number}> = [];

  // Player proxy
  private playerProxyId: string = 'player_proxy';
  private combatEnabled = false;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    globalBillboardSystem: GlobalBillboardSystem,
    assetLoader: AssetLoader,
    chunkManager?: ImprovedChunkManager
  ) {
    this.scene = scene;
    this.camera = camera;
    this.globalBillboardSystem = globalBillboardSystem;
    this.assetLoader = assetLoader;
    this.chunkManager = chunkManager;

    // Initialize effect pools
    this.tracerPool = new TracerPool(this.scene, 256);
    this.muzzleFlashPool = new MuzzleFlashPool(this.scene, 128);
    this.impactEffectsPool = new ImpactEffectsPool(this.scene, 128);

    // Initialize modules
    this.combatantFactory = new CombatantFactory();
    this.combatantAI = new CombatantAI();
    this.combatantCombat = new CombatantCombat(
      scene,
      this.tracerPool,
      this.muzzleFlashPool,
      this.impactEffectsPool
    );
    this.combatantMovement = new CombatantMovement(chunkManager, undefined);
    this.combatantRenderer = new CombatantRenderer(scene, camera, assetLoader);
    this.squadManager = new SquadManager(this.combatantFactory, chunkManager);
  }

  async init(): Promise<void> {
    console.log('🎖️ Initializing Combatant System (US vs OPFOR)...');

    // Create billboard meshes for each faction and state
    await this.combatantRenderer.createFactionBillboards();

    // Spawn initial forces
    this.spawnInitialForces();

    console.log('✅ Combatant System initialized');
  }

  private spawnInitialForces(): void {
    console.log('🎖️ Deploying forces at faction bases...');

    // US forces spawn at US base
    const usBasePos = new THREE.Vector3(0, 0, -50);
    this.spawnSquad(Faction.US, usBasePos, 4);

    // OPFOR forces spawn at OPFOR base
    const opforBasePos = new THREE.Vector3(0, 0, 145);
    this.spawnSquad(Faction.OPFOR, opforBasePos, 4);

    // Queue reinforcements
    this.progressiveSpawnQueue = [
      { faction: Faction.US, position: new THREE.Vector3(-15, 0, -50), size: 3 },
      { faction: Faction.OPFOR, position: new THREE.Vector3(-15, 0, 145), size: 3 },
      { faction: Faction.US, position: new THREE.Vector3(15, 0, -50), size: 3 },
      { faction: Faction.OPFOR, position: new THREE.Vector3(15, 0, 145), size: 3 },
      { faction: Faction.US, position: new THREE.Vector3(0, 0, -40), size: 2 },
      { faction: Faction.OPFOR, position: new THREE.Vector3(0, 0, 155), size: 2 }
    ];

    console.log(`🎖️ Initial forces deployed: ${this.combatants.size} combatants`);
    console.log(`📋 ${this.progressiveSpawnQueue.length} reinforcement squads queued`);
  }

  private spawnSquad(faction: Faction, centerPos: THREE.Vector3, size: number): void {
    const { squad, members } = this.squadManager.createSquad(faction, centerPos, size);

    // Add all squad members to our combatants map
    members.forEach(combatant => {
      this.combatants.set(combatant.id, combatant);
    });
  }

  update(deltaTime: number): void {
    // Update player position
    this.camera.getWorldPosition(this.playerPosition);

    if (!this.combatEnabled) {
      // Still update positions and billboards for visual consistency
      this.updateCombatants(deltaTime);
      this.combatantRenderer.updateBillboards(this.combatants, this.playerPosition);
      return;
    }

    // Ensure player proxy exists
    this.ensurePlayerProxy();

    // Progressive spawning
    if (this.progressiveSpawnQueue.length > 0) {
      this.progressiveSpawnTimer += deltaTime * 1000;
      if (this.progressiveSpawnTimer >= this.PROGRESSIVE_SPAWN_DELAY) {
        this.progressiveSpawnTimer = 0;
        const spawn = this.progressiveSpawnQueue.shift()!;
        this.spawnSquad(spawn.faction, spawn.position, spawn.size);
        console.log(`🎖️ Reinforcements: ${spawn.faction} squad of ${spawn.size} deployed`);
      }
    }

    // Check for spawning/despawning
    const now = Date.now();
    if (now - this.lastSpawnCheck > this.SPAWN_CHECK_INTERVAL) {
      this.manageSpawning();
      this.lastSpawnCheck = now;
    }

    // Update combatants
    this.updateCombatants(deltaTime);

    // Update billboard rotations
    this.combatantRenderer.updateBillboards(this.combatants, this.playerPosition);

    // Update effect pools
    this.tracerPool.update();
    this.muzzleFlashPool.update();
    this.impactEffectsPool.update(deltaTime);
  }

  private ensurePlayerProxy(): void {
    let proxy = this.combatants.get(this.playerProxyId);
    if (!proxy) {
      proxy = this.combatantFactory.createPlayerProxy(this.playerPosition);
      this.combatants.set(this.playerProxyId, proxy);
    } else {
      proxy.position.copy(this.playerPosition);
      proxy.state = CombatantState.ENGAGING;
    }
  }

  private updateCombatants(deltaTime: number): void {
    // Sort combatants by distance for LOD
    const sortedCombatants = Array.from(this.combatants.values()).sort((a, b) => {
      const distA = a.position.distanceTo(this.playerPosition);
      const distB = b.position.distanceTo(this.playerPosition);
      return distA - distB;
    });

    const now = Date.now();

    sortedCombatants.forEach(combatant => {
      const distance = combatant.position.distanceTo(this.playerPosition);

      // Determine LOD level
      if (distance < 150) {
        combatant.lodLevel = 'high';
        this.updateCombatantFull(combatant, deltaTime);
      } else if (distance < 300) {
        combatant.lodLevel = 'medium';
        if (now - combatant.lastUpdateTime > 50) {
          this.updateCombatantMedium(combatant, deltaTime);
          combatant.lastUpdateTime = now;
        }
      } else if (distance < 500) {
        combatant.lodLevel = 'low';
        if (now - combatant.lastUpdateTime > 100) {
          this.updateCombatantBasic(combatant, deltaTime);
          combatant.lastUpdateTime = now;
        }
      }
    });
  }

  private updateCombatantFull(combatant: Combatant, deltaTime: number): void {
    this.combatantAI.updateAI(combatant, deltaTime, this.playerPosition, this.combatants);
    this.combatantMovement.updateMovement(
      combatant,
      deltaTime,
      this.squadManager.getAllSquads(),
      this.combatants
    );
    this.combatantCombat.updateCombat(
      combatant,
      deltaTime,
      this.playerPosition,
      this.combatants,
      this.squadManager.getAllSquads()
    );
    this.combatantRenderer.updateCombatantTexture(combatant);
    this.combatantMovement.updateRotation(combatant, deltaTime);
  }

  private updateCombatantMedium(combatant: Combatant, deltaTime: number): void {
    this.combatantAI.updateAI(combatant, deltaTime, this.playerPosition, this.combatants);
    this.combatantMovement.updateMovement(
      combatant,
      deltaTime,
      this.squadManager.getAllSquads(),
      this.combatants
    );
    this.combatantCombat.updateCombat(
      combatant,
      deltaTime,
      this.playerPosition,
      this.combatants,
      this.squadManager.getAllSquads()
    );
    this.combatantMovement.updateRotation(combatant, deltaTime);
  }

  private updateCombatantBasic(combatant: Combatant, deltaTime: number): void {
    this.combatantMovement.updateMovement(
      combatant,
      deltaTime,
      this.squadManager.getAllSquads(),
      this.combatants
    );
    this.combatantMovement.updateRotation(combatant, deltaTime);
  }

  private manageSpawning(): void {
    // Remove distant combatants
    const toRemove: string[] = [];
    this.combatants.forEach((combatant, id) => {
      const distance = combatant.position.distanceTo(this.playerPosition);
      if (distance > this.DESPAWN_DISTANCE) {
        toRemove.push(id);
      }
    });

    toRemove.forEach(id => this.removeCombatant(id));

    // Spawn new squads if needed
    const usCombatants = Array.from(this.combatants.values())
      .filter(c => c.faction === Faction.US).length;
    const opforCombatants = Array.from(this.combatants.values())
      .filter(c => c.faction === Faction.OPFOR).length;

    if (usCombatants < 10 && this.combatants.size < this.MAX_COMBATANTS) {
      const spawnPos = this.getSpawnPosition(Faction.US);
      this.spawnSquad(Faction.US, spawnPos, 4);
    }

    if (opforCombatants < 15 && this.combatants.size < this.MAX_COMBATANTS) {
      const spawnPos = this.getSpawnPosition(Faction.OPFOR);
      this.spawnSquad(Faction.OPFOR, spawnPos, 4);
    }
  }

  private getSpawnPosition(faction: Faction): THREE.Vector3 {
    // Prefer spawning near faction-owned zones
    if (this.zoneManager) {
      const owned = this.zoneManager.getZonesByOwner(faction);
      const base = owned.find(z => z.id === (faction === Faction.US ? 'us_base' : 'opfor_base'));
      const anchor = (base ?? owned.find(z => !z.isHomeBase))?.position;
      if (anchor) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 15 + Math.random() * 35;
        return new THREE.Vector3(
          anchor.x + Math.cos(angle) * radius,
          0,
          anchor.z + Math.sin(angle) * radius
        );
      }
    }

    // Fallback relative to player
    const angle = faction === Faction.US
      ? Math.PI + (Math.random() - 0.5) * Math.PI * 0.5
      : (Math.random() - 0.5) * Math.PI;
    const distance = faction === Faction.US
      ? 20 + Math.random() * 20
      : 80 + Math.random() * 60;

    const cameraDir = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDir);
    const cameraAngle = Math.atan2(cameraDir.x, cameraDir.z);
    const finalAngle = cameraAngle + angle;

    return new THREE.Vector3(
      this.playerPosition.x + Math.cos(finalAngle) * distance,
      0,
      this.playerPosition.z + Math.sin(finalAngle) * distance
    );
  }

  private removeCombatant(id: string): void {
    const combatant = this.combatants.get(id);
    if (combatant && combatant.squadId) {
      this.squadManager.removeSquadMember(combatant.squadId, id);
    }
    this.combatants.delete(id);
  }

  // Public API
  handlePlayerShot(
    ray: THREE.Ray,
    damageCalculator: (distance: number, isHeadshot: boolean) => number
  ): { hit: boolean; point: THREE.Vector3; killed?: boolean; headshot?: boolean } {
    return this.combatantCombat.handlePlayerShot(ray, damageCalculator, this.combatants);
  }

  checkPlayerHit(ray: THREE.Ray): { hit: boolean; point: THREE.Vector3; headshot: boolean } {
    // Delegate to combat module
    return this.combatantCombat.checkPlayerHit(ray, this.playerPosition);
  }

  getCombatStats(): { us: number; opfor: number; total: number } {
    let us = 0;
    let opfor = 0;

    this.combatants.forEach(combatant => {
      if (combatant.state === CombatantState.DEAD) return;
      if (combatant.faction === Faction.US) {
        us++;
      } else {
        opfor++;
      }
    });

    return { us, opfor, total: us + opfor };
  }

  getAllCombatants(): Combatant[] {
    return Array.from(this.combatants.values());
  }

  // Setters for external systems
  setChunkManager(chunkManager: ImprovedChunkManager): void {
    this.chunkManager = chunkManager;
    this.combatantMovement.setChunkManager(chunkManager);
    this.squadManager.setChunkManager(chunkManager);
  }

  setTicketSystem(ticketSystem: TicketSystem): void {
    this.ticketSystem = ticketSystem;
    this.combatantCombat.setTicketSystem(ticketSystem);
  }

  setPlayerHealthSystem(playerHealthSystem: PlayerHealthSystem): void {
    this.playerHealthSystem = playerHealthSystem;
    this.combatantCombat.setPlayerHealthSystem(playerHealthSystem);
  }

  setZoneManager(zoneManager: ZoneManager): void {
    this.zoneManager = zoneManager;
    this.combatantMovement.setZoneManager(zoneManager);
  }

  setHUDSystem(hudSystem: any): void {
    this.combatantCombat.setHUDSystem(hudSystem);
  }

  setAudioManager(audioManager: AudioManager): void {
    this.audioManager = audioManager;
    this.combatantCombat.setAudioManager(audioManager);
  }

  enableCombat(): void {
    this.combatEnabled = true;
    console.log('⚔️ Combat AI activated');
  }

  dispose(): void {
    // Clean up modules
    this.combatantRenderer.dispose();
    this.squadManager.dispose();

    // Clean up pools
    this.tracerPool.dispose();
    this.muzzleFlashPool.dispose();
    this.impactEffectsPool.dispose();

    // Clear combatants
    this.combatants.clear();

    console.log('🧹 Combatant System disposed');
  }
}