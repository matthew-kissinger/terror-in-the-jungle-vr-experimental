import * as THREE from 'three';
import { GameSystem, BillboardInstance } from '../types';
import { GlobalBillboardSystem } from './GlobalBillboardSystem';
import { AssetLoader } from './AssetLoader';
import { ImprovedChunkManager } from './ImprovedChunkManager';
import { WeaponSpec, GunplayCore } from './GunplayCore';
import { TracerPool } from './TracerPool';
import { MuzzleFlashPool } from './MuzzleFlashPool';
import { ImpactEffectsPool } from './ImpactEffectsPool';
import { TicketSystem } from './TicketSystem';
import { PlayerHealthSystem } from './PlayerHealthSystem';
import { ZoneManager } from './ZoneManager';
import { AudioManager } from './AudioManager';

// Faction enum
export enum Faction {
  US = 'US',
  OPFOR = 'OPFOR'
}

// AI Skill profiles for different soldier types
export interface AISkillProfile {
  reactionDelayMs: number;      // Time to react to threats (200-600ms)
  aimJitterAmplitude: number;   // Aim wobble in degrees (0.5-3.0)
  burstLength: number;          // Rounds per burst (2-5)
  burstPauseMs: number;         // Pause between bursts (400-1200ms)
  leadingErrorFactor: number;   // Target leading accuracy (0.6-1.0, 1.0 = perfect)
  suppressionResistance: number; // How well they handle being shot at (0.0-1.0)
  visualRange: number;          // Detection range in meters
  fieldOfView: number;          // FOV in degrees
}

// Soldier states
export enum CombatantState {
  IDLE = 'idle',
  PATROLLING = 'patrolling',
  ALERT = 'alert',
  ENGAGING = 'engaging',
  SUPPRESSING = 'suppressing',
  ADVANCING = 'advancing',
  RETREATING = 'retreating',
  DEAD = 'dead'
}

// Individual combatant data
export interface Combatant {
  id: string;
  faction: Faction;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  visualRotation: number; // Smoothed rotation for rendering
  rotationVelocity: number; // For smooth rotation transitions
  scale: THREE.Vector3;

  // Combat properties
  health: number;
  maxHealth: number;
  state: CombatantState;
  previousState?: CombatantState;

  // Weapon and shooting
  weaponSpec: WeaponSpec;
  gunCore: GunplayCore;
  skillProfile: AISkillProfile;
  lastShotTime: number;
  currentBurst: number;
  burstCooldown: number;

  // AI behavior
  target?: Combatant | null;
  lastKnownTargetPos?: THREE.Vector3;
  reactionTimer: number;
  suppressionLevel: number;
  alertTimer: number;

  // Squad mechanics
  squadId?: string;
  squadRole?: 'leader' | 'follower';

  // Movement
  wanderAngle: number;
  timeToDirectionChange: number;
  destinationPoint?: THREE.Vector3;

  // Visuals
  currentTexture?: THREE.Texture;
  billboardIndex?: number;

  // Performance optimization
  lastUpdateTime: number;
  updatePriority: number;
  lodLevel: 'high' | 'medium' | 'low' | 'culled';

  // Special flags
  isPlayerProxy?: boolean;
}

// Squad data structure
interface Squad {
  id: string;
  faction: Faction;
  members: string[]; // Combatant IDs
  leaderId?: string;
  objective?: THREE.Vector3;
  formation: 'line' | 'wedge' | 'column';
}

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

  // Effects pools
  private tracerPool: TracerPool;
  private muzzleFlashPool: MuzzleFlashPool;
  private impactEffectsPool: ImpactEffectsPool;

  // Combatant management
  private combatants: Map<string, Combatant> = new Map();
  private squads: Map<string, Squad> = new Map();
  private nextCombatantId = 0;
  private nextSquadId = 0;

  // Faction-specific meshes (instanced rendering)
  private factionMeshes: Map<string, THREE.InstancedMesh> = new Map();
  private soldierTextures: Map<string, THREE.Texture> = new Map();

  // Player tracking
  private playerPosition = new THREE.Vector3();
  private playerFaction = Faction.US; // Player is always US

  // Spawn management
  private readonly MAX_COMBATANTS = 60;
  private readonly SPAWN_RADIUS = 80;
  private readonly MIN_SPAWN_DISTANCE = 30;
  private readonly DESPAWN_DISTANCE = 150;
  private lastSpawnCheck = 0;
  private readonly SPAWN_CHECK_INTERVAL = 3000;
  private readonly PROGRESSIVE_SPAWN_DELAY = 1000; // ms between progressive spawns
  private progressiveSpawnTimer = 0;
  private progressiveSpawnQueue: Array<{faction: Faction, position: THREE.Vector3, size: number}> = [];

  // Combat parameters
  private readonly FRIENDLY_FIRE_ENABLED = false;
  private readonly MAX_ENGAGEMENT_RANGE = 150;
  private readonly SUPPRESSION_RADIUS = 10;

  // Performance
  private updateQueue: Combatant[] = [];
  private lastFrameTime = 0;
  private readonly TARGET_FRAME_TIME = 16.67; // 60fps target

  // Player targeting proxy (for AI to use enemy-sized hitboxes)
  private playerProxyId: string = 'player_proxy';
  private combatEnabled = false; // Start with combat disabled

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
  }

  async init(): Promise<void> {
    console.log('🎖️ Initializing Combatant System (US vs OPFOR)...');

    // Create billboard meshes for each faction and state
    await this.createFactionBillboards();

    // Spawn initial forces - they'll handle terrain collision automatically
    this.spawnInitialForces();

    console.log('✅ Combatant System initialized');
  }

  private async createFactionBillboards(): Promise<void> {
    // Load US soldier textures
    const usWalking = this.assetLoader.getTexture('ASoldierWalking');
    const usAlert = this.assetLoader.getTexture('ASoldierAlert');
    const usFiring = this.assetLoader.getTexture('ASoldierFiring');

    // Load OPFOR soldier textures
    const opforWalking = this.assetLoader.getTexture('EnemySoldierWalking');
    const opforAlert = this.assetLoader.getTexture('EnemySoldierAlert');
    const opforFiring = this.assetLoader.getTexture('EnemySoldierFiring');
    const opforBack = this.assetLoader.getTexture('EnemySoldierBack');

    // Store textures
    if (usWalking) this.soldierTextures.set('US_walking', usWalking);
    if (usAlert) this.soldierTextures.set('US_alert', usAlert);
    if (usFiring) this.soldierTextures.set('US_firing', usFiring);
    if (opforWalking) this.soldierTextures.set('OPFOR_walking', opforWalking);
    if (opforAlert) this.soldierTextures.set('OPFOR_alert', opforAlert);
    if (opforFiring) this.soldierTextures.set('OPFOR_firing', opforFiring);
    if (opforBack) this.soldierTextures.set('OPFOR_back', opforBack);

    // Create instanced meshes for each faction-state combination
    const soldierGeometry = new THREE.PlaneGeometry(5, 7);

    // Helper to create mesh for faction-state
    const createFactionMesh = (texture: THREE.Texture, key: string, maxInstances: number = 30) => {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: true
      });

      const mesh = new THREE.InstancedMesh(soldierGeometry, material, maxInstances);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.renderOrder = 1;
      this.scene.add(mesh);
      this.factionMeshes.set(key, mesh);
    };

    // Create meshes for each faction-state combination
    if (usWalking) createFactionMesh(usWalking, 'US_walking');
    if (usAlert) createFactionMesh(usAlert, 'US_alert');
    if (usFiring) createFactionMesh(usFiring, 'US_firing');
    if (opforWalking) createFactionMesh(opforWalking, 'OPFOR_walking');
    if (opforAlert) createFactionMesh(opforAlert, 'OPFOR_alert');
    if (opforFiring) createFactionMesh(opforFiring, 'OPFOR_firing');
    if (opforBack) createFactionMesh(opforBack, 'OPFOR_back');

    console.log('🎖️ Created faction-specific soldier meshes');
  }

  private spawnInitialForces(): void {
    // Spawn forces at their actual bases for tactical gameplay
    console.log('🎖️ Deploying forces at faction bases...');

    // US forces spawn at US base (where player spawns)
    const usBasePos = new THREE.Vector3(0, 0, -50);
    this.spawnSquad(Faction.US, usBasePos, 4); // Initial squad at base

    // OPFOR forces spawn at OPFOR base (moved back from Bravo zone)
    const opforBasePos = new THREE.Vector3(0, 0, 145);
    this.spawnSquad(Faction.OPFOR, opforBasePos, 4); // Initial squad at base

    // Queue reinforcements to spawn at bases over time
    this.progressiveSpawnQueue = [
      { faction: Faction.US, position: new THREE.Vector3(-15, 0, -50), size: 3 },
      { faction: Faction.OPFOR, position: new THREE.Vector3(-15, 0, 145), size: 3 },
      { faction: Faction.US, position: new THREE.Vector3(15, 0, -50), size: 3 },
      { faction: Faction.OPFOR, position: new THREE.Vector3(15, 0, 145), size: 3 },
      { faction: Faction.US, position: new THREE.Vector3(0, 0, -40), size: 2 },
      { faction: Faction.OPFOR, position: new THREE.Vector3(0, 0, 155), size: 2 }
    ];

    console.log(`🎖️ Initial forces deployed at bases: ${this.combatants.size} combatants`);
    console.log(`📋 ${this.progressiveSpawnQueue.length} reinforcement squads queued`);
    console.log('⚔️ Tactical objective: Capture and hold zones!');
    console.log('🏃‍♂️ Movement speeds: Zone-seeking 4 units/s, Combat 3 units/s, Squad formation 2-3 units/s');
  }

  private spawnSquad(faction: Faction, centerPos: THREE.Vector3, size: number): void {
    const squadId = `squad_${faction}_${this.nextSquadId++}`;
    const squad: Squad = {
      id: squadId,
      faction,
      members: [],
      formation: 'wedge'
    };

    for (let i = 0; i < size; i++) {
      // Better formation spread - wedge or line formation
      let offset: THREE.Vector3;
      if (i === 0) {
        // Leader at front/center
        offset = new THREE.Vector3(0, 0, 0);
      } else {
        // Followers in formation behind/beside leader
        const row = Math.floor((i - 1) / 3); // 3 per row
        const col = (i - 1) % 3 - 1; // -1, 0, 1
        offset = new THREE.Vector3(
          col * 4, // 4 meters apart horizontally
          0,
          -row * 4 // 4 meters behind each row
        );
        // Add small random variation to avoid perfect grid
        offset.x += (Math.random() - 0.5) * 1.5;
        offset.z += (Math.random() - 0.5) * 1.5;
      }
      const position = centerPos.clone().add(offset);
      position.y = this.getTerrainHeight(position.x, position.z) + 3;

      const role = i === 0 ? 'leader' : 'follower';
      const combatant = this.spawnCombatant(faction, position, { squadId, squadRole: role });

      if (combatant) {
        squad.members.push(combatant.id);
        if (role === 'leader') {
          squad.leaderId = combatant.id;
        }
      }
    }

    this.squads.set(squadId, squad);
    console.log(`🎖️ Deployed ${faction} squad ${squadId} with ${size} soldiers`);
  }

  private spawnCombatant(
    faction: Faction,
    position: THREE.Vector3,
    squadData?: { squadId?: string; squadRole?: 'leader' | 'follower' }
  ): Combatant {
    const id = `combatant_${this.nextCombatantId++}`;

    // Create weapon spec based on faction
    const weaponSpec = this.createWeaponSpec(faction);
    const gunCore = new GunplayCore(weaponSpec);

    // Create skill profile based on role
    const skillProfile = this.createSkillProfile(
      faction,
      squadData?.squadRole || 'follower'
    );

    const initialRotation = Math.random() * Math.PI * 2;
    const combatant: Combatant = {
      id,
      faction,
      position: position.clone(),
      velocity: new THREE.Vector3(),
      rotation: initialRotation,
      visualRotation: initialRotation, // Start with same rotation to avoid initial jump
      rotationVelocity: 0,
      scale: new THREE.Vector3(1, 1, 1),

      health: 100,
      maxHealth: 100,
      state: CombatantState.PATROLLING,

      weaponSpec,
      gunCore,
      skillProfile,
      lastShotTime: 0,
      currentBurst: 0,
      burstCooldown: 0,

      reactionTimer: 0,
      suppressionLevel: 0,
      alertTimer: 0,

      wanderAngle: Math.random() * Math.PI * 2,
      timeToDirectionChange: Math.random() * 3,

      lastUpdateTime: 0,
      updatePriority: 0,
      lodLevel: 'high',

      ...squadData
    };

    // Set initial texture based on state
    this.updateCombatantTexture(combatant);

    this.combatants.set(id, combatant);
    return combatant;
  }

  private createWeaponSpec(faction: Faction): WeaponSpec {
    // US uses M16-style rifle, OPFOR uses AK-style
    if (faction === Faction.US) {
      return {
        name: 'M16A4',
        rpm: 750,
        adsTime: 0.18,
        baseSpreadDeg: 0.6,
        bloomPerShotDeg: 0.2,
        recoilPerShotDeg: 0.55,
        recoilHorizontalDeg: 0.3,
        damageNear: 26,
        damageFar: 18,
        falloffStart: 25,
        falloffEnd: 65,
        headshotMultiplier: 1.7,
        penetrationPower: 1
      };
    } else {
      return {
        name: 'AK-74',
        rpm: 600,
        adsTime: 0.20,
        baseSpreadDeg: 0.8,
        bloomPerShotDeg: 0.3,
        recoilPerShotDeg: 0.75,
        recoilHorizontalDeg: 0.4,
        damageNear: 38,
        damageFar: 26,
        falloffStart: 20,
        falloffEnd: 55,
        headshotMultiplier: 1.6,
        penetrationPower: 1.2
      };
    }
  }

  private createSkillProfile(faction: Faction, role: 'leader' | 'follower'): AISkillProfile {
    // Faction-specific profiles for better balance
    let baseProfile: AISkillProfile;

    if (faction === Faction.OPFOR) {
      // OPFOR gets better combat skills to balance US weapon advantages
      baseProfile = {
        reactionDelayMs: role === 'leader' ? 300 : 450, // Faster reactions than US
        aimJitterAmplitude: role === 'leader' ? 0.8 : 1.2, // Better aim
        burstLength: role === 'leader' ? 5 : 4, // Longer bursts
        burstPauseMs: role === 'leader' ? 500 : 700, // Shorter pauses
        leadingErrorFactor: role === 'leader' ? 0.9 : 0.8, // Better leading
        suppressionResistance: role === 'leader' ? 0.8 : 0.6, // More resilient
        visualRange: 130, // Better spotting range
        fieldOfView: 130
      };
    } else {
      // US forces (slightly worse skills to balance weapon advantages)
      baseProfile = {
        reactionDelayMs: role === 'leader' ? 350 : 500,
        aimJitterAmplitude: role === 'leader' ? 1.0 : 1.4,
        burstLength: role === 'leader' ? 4 : 3,
        burstPauseMs: role === 'leader' ? 600 : 800,
        leadingErrorFactor: role === 'leader' ? 0.85 : 0.75,
        suppressionResistance: role === 'leader' ? 0.7 : 0.5,
        visualRange: 120,
        fieldOfView: 120
      };
    }

    // Add some randomization for variety
    baseProfile.reactionDelayMs += (Math.random() - 0.5) * 100;
    baseProfile.aimJitterAmplitude += (Math.random() - 0.5) * 0.3;

    return baseProfile;
  }

  update(deltaTime: number): void {
    // Update player position
    this.camera.getWorldPosition(this.playerPosition);

    // Allow basic movement and visuals even if combat not enabled
    // This prevents NPCs from getting stuck at spawn
    if (!this.combatEnabled) {
      // Still update positions and billboards for visual consistency
      this.updateCombatants(deltaTime);
      this.updateBillboards();
      // Skip combat-specific updates
      return;
    }

    // Ensure player proxy exists and tracks player position
    this.ensurePlayerProxy();

    // Progressive spawning from queue
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

    // Update combatants based on priority
    this.updateCombatants(deltaTime);

    // Update billboard rotations
    this.updateBillboards();

    // Update effect pools
    this.tracerPool.update();
    this.muzzleFlashPool.update();
    this.impactEffectsPool.update(deltaTime);
  }

  private ensurePlayerProxy(): void {
    let proxy = this.combatants.get(this.playerProxyId);
    if (!proxy) {
      proxy = {
        id: this.playerProxyId,
        faction: Faction.US,
        position: this.playerPosition.clone(),
        velocity: new THREE.Vector3(),
        rotation: 0,
        visualRotation: 0,
        rotationVelocity: 0,
        scale: new THREE.Vector3(1, 1, 1),
        health: 100,
        maxHealth: 100,
        state: CombatantState.ENGAGING,
        weaponSpec: this.createWeaponSpec(Faction.US),
        gunCore: new GunplayCore(this.createWeaponSpec(Faction.US)),
        skillProfile: this.createSkillProfile(Faction.US, 'leader'),
        lastShotTime: 0,
        currentBurst: 0,
        burstCooldown: 0,
        reactionTimer: 0,
        suppressionLevel: 0,
        alertTimer: 0,
        wanderAngle: 0,
        timeToDirectionChange: 0,
        lastUpdateTime: 0,
        updatePriority: 0,
        lodLevel: 'high',
        isPlayerProxy: true
      };
      this.combatants.set(this.playerProxyId, proxy);
    } else {
      proxy.position.copy(this.playerPosition);
      proxy.state = CombatantState.ENGAGING;
    }
  }

  private updateCombatants(deltaTime: number): void {
    // Sort combatants by distance to player for LOD
    const sortedCombatants = Array.from(this.combatants.values()).sort((a, b) => {
      const distA = a.position.distanceTo(this.playerPosition);
      const distB = b.position.distanceTo(this.playerPosition);
      return distA - distB;
    });

    const now = Date.now();

    // Update each combatant based on LOD
    sortedCombatants.forEach(combatant => {
      const distance = combatant.position.distanceTo(this.playerPosition);

      // Determine LOD level - much higher ranges to ensure fair AI processing
      if (distance < 150) {
        combatant.lodLevel = 'high';
        this.updateCombatantFull(combatant, deltaTime);
      } else if (distance < 300) {
        combatant.lodLevel = 'medium';
        // Update at same frequency for fairness
        if (now - combatant.lastUpdateTime > 50) { // 20fps
          this.updateCombatantMedium(combatant, deltaTime);
          combatant.lastUpdateTime = now;
        }
      } else if (distance < 500) {
        combatant.lodLevel = 'low';
        // Still decent update rate
        if (now - combatant.lastUpdateTime > 100) { // 10fps
          this.updateCombatantBasic(combatant, deltaTime);
          combatant.lastUpdateTime = now;
        }
      }
    });
  }

  private updateCombatantFull(combatant: Combatant, deltaTime: number): void {
    // Full AI update for nearby combatants
    this.updateCombatantAI(combatant, deltaTime);
    this.updateCombatantMovement(combatant, deltaTime);
    this.updateCombatantCombat(combatant, deltaTime);
    this.updateCombatantTexture(combatant);
    this.updateCombatantRotation(combatant, deltaTime);
  }

  private updateCombatantMedium(combatant: Combatant, deltaTime: number): void {
    // Reduced update for medium distance
    this.updateCombatantAI(combatant, deltaTime);
    this.updateCombatantMovement(combatant, deltaTime);
    // Allow combat at reduced frequency for medium LOD so AI can shoot the player
    this.updateCombatantCombat(combatant, deltaTime);
    this.updateCombatantRotation(combatant, deltaTime);
  }

  private updateCombatantBasic(combatant: Combatant, deltaTime: number): void {
    // Minimal update for distant combatants
    this.updateCombatantMovement(combatant, deltaTime);
    this.updateCombatantRotation(combatant, deltaTime);
  }

  private updateCombatantAI(combatant: Combatant, deltaTime: number): void {
    // State machine for AI behavior
    switch (combatant.state) {
      case CombatantState.PATROLLING:
        this.handlePatrolling(combatant, deltaTime);
        break;
      case CombatantState.ALERT:
        this.handleAlert(combatant, deltaTime);
        break;
      case CombatantState.ENGAGING:
        this.handleEngaging(combatant, deltaTime);
        break;
      case CombatantState.SUPPRESSING:
        this.handleSuppressing(combatant, deltaTime);
        break;
    }
  }

  private handlePatrolling(combatant: Combatant, deltaTime: number): void {
    // Look for enemies
    const enemy = this.findNearestEnemy(combatant);
    if (enemy) {
      // Face the potential target to enable FOV/LOS checks
      const targetPos = enemy.id === 'PLAYER' ? this.playerPosition : enemy.position;
      const toTarget = new THREE.Vector3().subVectors(targetPos, combatant.position).normalize();
      combatant.rotation = Math.atan2(toTarget.z, toTarget.x);

      if (this.canSeeTarget(combatant, enemy)) {
        // Transition to alert
        combatant.state = CombatantState.ALERT;
        combatant.target = enemy;
        combatant.reactionTimer = combatant.skillProfile.reactionDelayMs / 1000;
        combatant.alertTimer = 1.5;
        console.log(`🎯 ${combatant.faction} soldier spotted enemy!`);
      }
    }

    // Patrol movement handled in movement update
  }

  private handleAlert(combatant: Combatant, deltaTime: number): void {
    combatant.alertTimer -= deltaTime;
    combatant.reactionTimer -= deltaTime;

    if (combatant.reactionTimer <= 0 && combatant.target) {
      // Face the target while alert
      const targetPos = combatant.target.id === 'PLAYER' ? this.playerPosition : combatant.target.position;
      const toTarget = new THREE.Vector3().subVectors(targetPos, combatant.position).normalize();
      combatant.rotation = Math.atan2(toTarget.z, toTarget.x);

      // Check if still have LOS
      if (this.canSeeTarget(combatant, combatant.target)) {
        // Start engaging
        combatant.state = CombatantState.ENGAGING;
        combatant.currentBurst = 0;
        console.log(`🔫 ${combatant.faction} soldier engaging!`);
      } else {
        // Lost sight, go back to patrolling
        combatant.state = CombatantState.PATROLLING;
        combatant.target = null;
      }
    }
  }

  private handleEngaging(combatant: Combatant, deltaTime: number): void {
    if (!combatant.target || combatant.target.state === CombatantState.DEAD) {
      combatant.state = CombatantState.PATROLLING;
      combatant.target = null;
      return;
    }

    // Face target and check LOS
    const targetPos = combatant.target.id === 'PLAYER' ? this.playerPosition : combatant.target.position;
    const toTargetDir = new THREE.Vector3().subVectors(targetPos, combatant.position).normalize();
    combatant.rotation = Math.atan2(toTargetDir.z, toTargetDir.x);

    // Check if can still see target
    if (!this.canSeeTarget(combatant, combatant.target)) {
      // Lost sight, suppress last known position
      combatant.lastKnownTargetPos = combatant.target.position.clone();
      combatant.state = CombatantState.SUPPRESSING;
      return;
    }

    // Update last known position
    combatant.lastKnownTargetPos = combatant.target.position.clone();
  }

  private handleSuppressing(combatant: Combatant, deltaTime: number): void {
    // Fire at last known position for a bit
    combatant.alertTimer -= deltaTime;

    if (combatant.alertTimer <= 0) {
      // Stop suppressing, look for new targets
      combatant.state = CombatantState.PATROLLING;
      combatant.target = null;
      combatant.lastKnownTargetPos = undefined;
    }
  }

  private updateCombatantCombat(combatant: Combatant, deltaTime: number): void {
    // Handle weapon cooldowns
    combatant.gunCore.cooldown(deltaTime);
    combatant.burstCooldown -= deltaTime;

    // Try to fire if engaged
    if (combatant.state === CombatantState.ENGAGING && combatant.target) {
      this.tryFireWeapon(combatant);
    } else if (combatant.state === CombatantState.SUPPRESSING && combatant.lastKnownTargetPos) {
      this.trySuppressiveFire(combatant);
    }
  }

  private tryFireWeapon(combatant: Combatant): void {
    if (!combatant.gunCore.canFire() || combatant.burstCooldown > 0) return;

    // Check burst control
    if (combatant.currentBurst >= combatant.skillProfile.burstLength) {
      // Reset burst
      combatant.currentBurst = 0;
      combatant.burstCooldown = combatant.skillProfile.burstPauseMs / 1000;
      return;
    }

    // Fire shot
    combatant.gunCore.registerShot();
    combatant.currentBurst++;
    combatant.lastShotTime = performance.now();

    // Calculate shot with skill modifiers
    const shotRay = this.calculateAIShot(combatant);

    // Check if shooting at player
    let hit: any = null;
    if (combatant.target && combatant.target.id === 'PLAYER') {
      // Check if shot hits player
      const playerHit = this.checkPlayerHit(shotRay);
      if (playerHit.hit) {
        const damage = combatant.gunCore.computeDamage(
          combatant.position.distanceTo(this.playerPosition),
          playerHit.headshot
        );
        console.log(`⚠️ Player hit by ${combatant.faction} for ${damage} damage!${playerHit.headshot ? ' (HEADSHOT!)' : ''}`);

        // Apply damage to player
        if (this.playerHealthSystem) {
          console.log(`💉 Applying ${damage} damage to player...`);
          const playerDied = this.playerHealthSystem.takeDamage(
            damage,
            combatant.position,
            this.playerPosition
          );
          if (playerDied) {
            console.log(`💀 Player eliminated by ${combatant.faction}!`);
          }
        } else {
          console.warn('⚠️ PlayerHealthSystem not connected!');
        }

        hit = {
          point: playerHit.point,
          distance: combatant.position.distanceTo(this.playerPosition),
          headshot: playerHit.headshot
        };
      } else {
        console.log(`❌ Shot at player missed`);
      }
    } else {
      // Normal combatant vs combatant shooting
      hit = this.raycastCombatants(shotRay, combatant.faction);
    }

    // Always spawn visual effects for nearby combat
    const distance = combatant.position.distanceTo(this.playerPosition);
    if (distance < 200) {  // Show effects within 200m for better visibility
      // Determine hit point
      const hitPoint = hit ? hit.point : new THREE.Vector3()
        .copy(shotRay.origin)
        .addScaledVector(shotRay.direction, 80 + Math.random() * 40);

      // Spawn tracer
      this.tracerPool.spawn(shotRay.origin.clone().add(new THREE.Vector3(0, 1.5, 0)), hitPoint, 0.3);

      // Spawn muzzle flash
      // Spawn muzzle flash slightly in front of combatant for better visibility
      const muzzlePos = combatant.position.clone();
      muzzlePos.y += 1.5;
      // Move muzzle flash forward in shot direction
      muzzlePos.add(shotRay.direction.clone().multiplyScalar(2));
      this.muzzleFlashPool.spawn(muzzlePos, shotRay.direction, 1.2); // Increased size

      // Play positional gunshot sound
      if (this.audioManager) {
        this.audioManager.playGunshotAt(combatant.position);
      }

      // Spawn impact if hit
      if (hit) {
        this.impactEffectsPool.spawn(hit.point, shotRay.direction.clone().negate());

        // Apply damage with visual feedback
        const damage = combatant.gunCore.computeDamage(hit.distance, hit.headshot);
        this.applyDamage(hit.combatant, damage, combatant);

        // Log hits for debugging
        if (hit.headshot) {
          console.log(`🎯 Headshot! ${combatant.faction} -> ${hit.combatant.faction}`);
        }
      }
    } else if (hit) {
      // Still apply damage even if too far for effects
      const damage = combatant.gunCore.computeDamage(hit.distance, hit.headshot);
      this.applyDamage(hit.combatant, damage, combatant);
    }
  }

  private trySuppressiveFire(combatant: Combatant): void {
    // Similar to regular fire but aimed at last known position
    if (!combatant.gunCore.canFire() || combatant.burstCooldown > 0) return;
    if (!combatant.lastKnownTargetPos) return;

    // Fire with reduced accuracy
    combatant.gunCore.registerShot();
    combatant.currentBurst++;

    // Check burst control
    if (combatant.currentBurst >= combatant.skillProfile.burstLength) {
      combatant.currentBurst = 0;
      combatant.burstCooldown = combatant.skillProfile.burstPauseMs / 1000;
    }

    // Add more spread for suppressive fire
    const spread = combatant.skillProfile.aimJitterAmplitude * 2;
    const shotRay = this.calculateSuppressiveShot(combatant, spread);

    // Visual effects for suppressive fire (always show if close enough)
    const distance = combatant.position.distanceTo(this.playerPosition);
    if (distance < 200) {  // Increased range for better visibility
      const endPoint = new THREE.Vector3()
        .copy(shotRay.origin)
        .addScaledVector(shotRay.direction, 60 + Math.random() * 40);

      // Spawn tracer
      const muzzlePos = combatant.position.clone();
      muzzlePos.y += 1.5;
      this.tracerPool.spawn(muzzlePos, endPoint, 0.3);

      // Spawn muzzle flash in front of combatant
      const muzzleFlashPos = muzzlePos.clone();
      muzzleFlashPos.add(shotRay.direction.clone().multiplyScalar(2));
      this.muzzleFlashPool.spawn(muzzleFlashPos, shotRay.direction, 1.2);

      // Play positional gunshot sound for suppressive fire
      if (this.audioManager) {
        this.audioManager.playGunshotAt(combatant.position);
      }

      // Random impact effects for suppression (area denial)
      if (Math.random() < 0.3) {
        this.impactEffectsPool.spawn(endPoint, shotRay.direction.clone().negate());
      }
    }
  }

  private calculateAIShot(combatant: Combatant): THREE.Ray {
    if (!combatant.target) {
      // Shouldn't happen but failsafe
      const forward = new THREE.Vector3(
        Math.cos(combatant.rotation),
        0,
        Math.sin(combatant.rotation)
      );
      return new THREE.Ray(combatant.position.clone(), forward);
    }

    // Special handling for player target (aim for chest level)
    const targetPos = combatant.target.id === 'PLAYER'
      ? this.playerPosition.clone().add(new THREE.Vector3(0, -0.6, 0))
      : combatant.target.position;

    // Calculate base aim direction
    const toTarget = new THREE.Vector3()
      .subVectors(targetPos, combatant.position);

    // Add target leading (imperfect) - skip for player as we don't track velocity yet
    if (combatant.target.id !== 'PLAYER' && combatant.target.velocity.length() > 0.1) {
      const timeToTarget = toTarget.length() / 800; // Assume bullet velocity
      const leadAmount = combatant.skillProfile.leadingErrorFactor;
      toTarget.addScaledVector(combatant.target.velocity, timeToTarget * leadAmount);
    }

    toTarget.normalize();

    // Add aim jitter
    const jitter = combatant.skillProfile.aimJitterAmplitude;
    const jitterRad = THREE.MathUtils.degToRad(jitter);

    // Create perpendicular vectors for jitter
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(toTarget, up).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, toTarget).normalize();

    // Apply jitter
    const jitterX = (Math.random() - 0.5) * jitterRad;
    const jitterY = (Math.random() - 0.5) * jitterRad;

    const finalDirection = toTarget.clone()
      .addScaledVector(right, Math.sin(jitterX))
      .addScaledVector(realUp, Math.sin(jitterY))
      .normalize();

    // Create ray from combatant position
    const origin = combatant.position.clone();
    origin.y += 1.5; // Approximate chest height

    return new THREE.Ray(origin, finalDirection);
  }

  private calculateSuppressiveShot(combatant: Combatant, spread: number): THREE.Ray {
    if (!combatant.lastKnownTargetPos) {
      // Fallback
      const forward = new THREE.Vector3(
        Math.cos(combatant.rotation),
        0,
        Math.sin(combatant.rotation)
      );
      return new THREE.Ray(combatant.position.clone(), forward);
    }

    // Aim at last known position with high spread
    const toTarget = new THREE.Vector3()
      .subVectors(combatant.lastKnownTargetPos, combatant.position)
      .normalize();

    // Add random spread
    const spreadRad = THREE.MathUtils.degToRad(spread);
    const theta = Math.random() * Math.PI * 2;
    const r = Math.random() * spreadRad;

    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(toTarget, up).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, toTarget).normalize();

    const finalDirection = toTarget.clone()
      .addScaledVector(right, Math.cos(theta) * r)
      .addScaledVector(realUp, Math.sin(theta) * r)
      .normalize();

    const origin = combatant.position.clone();
    origin.y += 1.5;

    return new THREE.Ray(origin, finalDirection);
  }

  // Method removed - effects are now handled inline in tryFireWeapon for better consistency

  private updateCombatantMovement(combatant: Combatant, deltaTime: number): void {
    // Movement based on state
    if (combatant.state === CombatantState.PATROLLING) {
      this.updatePatrolMovement(combatant, deltaTime);
    } else if (combatant.state === CombatantState.ENGAGING) {
      this.updateCombatMovement(combatant, deltaTime);
    }

    // Apply velocity
    combatant.position.add(combatant.velocity.clone().multiplyScalar(deltaTime));

    // Keep on terrain
    const terrainHeight = this.getTerrainHeight(combatant.position.x, combatant.position.z);
    combatant.position.y = terrainHeight + 3;
  }

  private updatePatrolMovement(combatant: Combatant, deltaTime: number): void {
    // Squad movement
    if (combatant.squadId && combatant.squadRole === 'follower') {
      const squad = this.squads.get(combatant.squadId);
      if (squad && squad.leaderId) {
        const leader = this.combatants.get(squad.leaderId);
        if (leader && leader.id !== combatant.id) {
          const toLeader = new THREE.Vector3()
            .subVectors(leader.position, combatant.position);

          if (toLeader.length() > 6) {
            toLeader.normalize();
            combatant.velocity.set(
              toLeader.x * 3,
              0,
              toLeader.z * 3
            );
            // Update rotation to face movement direction
            combatant.rotation = Math.atan2(toLeader.z, toLeader.x);
            return;
          }
        }
      }
    }

    // Leaders: head toward nearest capturable zone when available
    if (combatant.squadRole === 'leader' && this.zoneManager) {
      const targetZone = this.zoneManager.getNearestCapturableZone(combatant.position, combatant.faction);
      if (targetZone) {
        const toZone = new THREE.Vector3().subVectors(targetZone.position, combatant.position);
        const dist = toZone.length();
        toZone.normalize();
        const speed = dist > 5 ? 4 : 0;
        combatant.velocity.set(toZone.x * speed, 0, toZone.z * speed);
        if (speed > 0.1) combatant.rotation = Math.atan2(toZone.z, toZone.x);
        return;
      }
    }

    // Fallback: If no zone to capture, advance toward enemy territory
    if (combatant.squadRole === 'leader') {
      // Move toward enemy base as fallback objective
      const enemyBasePos = combatant.faction === Faction.US ?
        new THREE.Vector3(0, 0, 145) : // OPFOR base
        new THREE.Vector3(0, 0, -50); // US base

      const toEnemyBase = new THREE.Vector3()
        .subVectors(enemyBasePos, combatant.position)
        .normalize();

      combatant.velocity.set(
        toEnemyBase.x * 3,
        0,
        toEnemyBase.z * 3
      );
      combatant.rotation = Math.atan2(toEnemyBase.z, toEnemyBase.x);
    } else {
      // Followers: limited wander near leader
      combatant.timeToDirectionChange -= deltaTime;
      if (combatant.timeToDirectionChange <= 0) {
        combatant.wanderAngle = Math.random() * Math.PI * 2;
        combatant.timeToDirectionChange = 2 + Math.random() * 2;
      }

      combatant.velocity.set(
        Math.cos(combatant.wanderAngle) * 2,
        0,
        Math.sin(combatant.wanderAngle) * 2
      );
    }
    // Update rotation to match movement direction
    if (combatant.velocity.length() > 0.1) {
      combatant.rotation = Math.atan2(combatant.velocity.z, combatant.velocity.x);
    }
  }

  private updateCombatMovement(combatant: Combatant, deltaTime: number): void {
    if (!combatant.target) return;

    // Strafe and maintain distance
    const toTarget = new THREE.Vector3()
      .subVectors(combatant.target.position, combatant.position);
    const distance = toTarget.length();
    toTarget.normalize();

    // Ideal engagement distance
    const idealDistance = 30;

    if (distance > idealDistance + 10) {
      // Move closer
      combatant.velocity.copy(toTarget).multiplyScalar(3);
    } else if (distance < idealDistance - 10) {
      // Back up
      combatant.velocity.copy(toTarget).multiplyScalar(-2);
    } else {
      // Strafe
      const strafeAngle = Math.sin(Date.now() * 0.001) * 0.5;
      const strafeDir = new THREE.Vector3(-toTarget.z, 0, toTarget.x);
      combatant.velocity.copy(strafeDir).multiplyScalar(strafeAngle * 2);
    }
  }

  private updateCombatantTexture(combatant: Combatant): void {
    // Determine texture based on state
    let textureKey = `${combatant.faction}_`;

    switch (combatant.state) {
      case CombatantState.ENGAGING:
      case CombatantState.SUPPRESSING:
        textureKey += 'firing';
        break;
      case CombatantState.ALERT:
        textureKey += 'alert';
        break;
      default:
        textureKey += 'walking';
        break;
    }

    combatant.currentTexture = this.soldierTextures.get(textureKey);
  }

  private updateCombatantRotation(combatant: Combatant, deltaTime: number): void {
    // Smooth rotation interpolation
    let targetRotation = combatant.rotation;

    // Calculate shortest rotation path
    let rotationDiff = targetRotation - combatant.visualRotation;

    // Normalize to -PI to PI range
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

    // Apply smooth interpolation with velocity for natural movement
    const rotationAccel = rotationDiff * 15; // Spring constant
    const rotationDamping = combatant.rotationVelocity * 10; // Damping

    combatant.rotationVelocity += (rotationAccel - rotationDamping) * deltaTime;
    combatant.visualRotation += combatant.rotationVelocity * deltaTime;

    // Normalize visual rotation
    while (combatant.visualRotation > Math.PI * 2) combatant.visualRotation -= Math.PI * 2;
    while (combatant.visualRotation < 0) combatant.visualRotation += Math.PI * 2;
  }

  private updateBillboards(): void {
    // Reset all mesh counts
    this.factionMeshes.forEach(mesh => mesh.count = 0);

    // Group combatants by faction and state
    const combatantGroups = new Map<string, Combatant[]>();

    this.combatants.forEach(combatant => {
      if (combatant.state === CombatantState.DEAD) return;
      if (combatant.isPlayerProxy) return;

      // Check if player is behind this enemy combatant
      let isShowingBack = false;
      if (combatant.faction === Faction.OPFOR) {
        // Calculate if player is behind enemy
        const enemyForward = new THREE.Vector3(
          Math.cos(combatant.visualRotation),
          0,
          Math.sin(combatant.visualRotation)
        );
        const toPlayer = new THREE.Vector3()
          .subVectors(this.playerPosition, combatant.position)
          .normalize();

        // Dot product < 0 means player is behind enemy (more than 90 degrees from forward)
        const behindDot = enemyForward.dot(toPlayer);

        // Show back texture if:
        // 1. Player is behind enemy (dot < -0.2 for some tolerance)
        // 2. Enemy is not actively targeting the player
        isShowingBack = behindDot < -0.2 &&
                       (!combatant.target || combatant.target.id !== 'PLAYER');
      }

      let stateKey = 'walking';
      if (isShowingBack) {
        stateKey = 'back';
      } else if (combatant.state === CombatantState.ENGAGING || combatant.state === CombatantState.SUPPRESSING) {
        stateKey = 'firing';
      } else if (combatant.state === CombatantState.ALERT) {
        stateKey = 'alert';
      }

      const key = `${combatant.faction}_${stateKey}`;
      if (!combatantGroups.has(key)) {
        combatantGroups.set(key, []);
      }
      combatantGroups.get(key)!.push(combatant);
    });

    // Update each mesh
    const matrix = new THREE.Matrix4();
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z);

    // Calculate camera right and forward vectors
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
    const cameraForward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();

    combatantGroups.forEach((combatants, key) => {
      const mesh = this.factionMeshes.get(key);
      if (!mesh) return;

      combatants.forEach((combatant, index) => {
        // Check if this is a back-facing texture
        const isBackTexture = key.includes('_back');

        // Get combatant's facing direction (using smoothed visual rotation)
        const combatantForward = new THREE.Vector3(
          Math.cos(combatant.visualRotation),
          0,
          Math.sin(combatant.visualRotation)
        );

        // Calculate relative position of combatant to camera
        const toCombatant = new THREE.Vector3()
          .subVectors(combatant.position, this.playerPosition)
          .normalize();

        // Determine which side of the combatant we're viewing
        const viewAngle = toCombatant.dot(cameraRight);

        let finalRotation: number;
        let scaleX = combatant.scale.x;

        if (isBackTexture) {
          // Back texture: more camera-facing for clear view, minimal rotation influence
          // Use 80% camera facing to show the back clearly
          finalRotation = cameraAngle * 0.8 + combatant.visualRotation * 0.2;

          // Don't flip back textures - they should always show correctly
          scaleX = Math.abs(scaleX);
        } else if (combatant.faction === Faction.OPFOR) {
          // ENEMIES: Always billboard (face camera) for classic enemy behavior
          finalRotation = cameraAngle;
          scaleX = Math.abs(scaleX); // No flipping for enemies
        } else {
          // ALLIES (US): Use directional sprites with world-facing rotation
          // Calculate how much the combatant is facing perpendicular to camera
          const facingDot = Math.abs(combatantForward.dot(cameraForward));

          // Blend between camera-facing and world-facing based on angle
          // More world-facing when combatant is perpendicular to camera view
          const billboardBlend = 0.3 + facingDot * 0.4; // 30-70% billboard facing

          // Interpolate between camera angle and combatant rotation
          finalRotation = cameraAngle * billboardBlend + combatant.visualRotation * (1 - billboardBlend);

          // Calculate if we should flip based on viewing angle and facing direction
          const combatantDotRight = combatantForward.dot(cameraRight);

          // Complex logic for natural-looking sprite flipping:
          // - If combatant is to our right and facing away from us, don't flip
          // - If combatant is to our right and facing toward us, flip
          // - If combatant is to our left and facing away from us, flip
          // - If combatant is to our left and facing toward us, don't flip
          const shouldFlip = (viewAngle > 0 && combatantDotRight < 0) ||
                            (viewAngle < 0 && combatantDotRight > 0);

          scaleX = shouldFlip ? -Math.abs(scaleX) : Math.abs(scaleX);
        }

        // Build transformation matrix
        matrix.makeRotationY(finalRotation);
        matrix.setPosition(combatant.position);

        const scaleMatrix = new THREE.Matrix4().makeScale(
          scaleX,
          combatant.scale.y,
          combatant.scale.z
        );
        matrix.multiply(scaleMatrix);

        mesh.setMatrixAt(index, matrix);
        combatant.billboardIndex = index;
      });

      mesh.count = combatants.length;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  private findNearestEnemy(combatant: Combatant): Combatant | null {
    let nearest: Combatant | null = null;
    let minDistance = combatant.skillProfile.visualRange;
    let targetIsPlayer = false;

    // Prefer player if OPFOR and within range
    if (combatant.faction === Faction.OPFOR) {
      const playerDistance = combatant.position.distanceTo(this.playerPosition);
      if (playerDistance < combatant.skillProfile.visualRange) {
        return {
          id: 'PLAYER',
          faction: Faction.US,
          position: this.playerPosition.clone(),
          velocity: new THREE.Vector3(),
          state: CombatantState.ENGAGING,
          health: 100,
          maxHealth: 100
        } as Combatant;
      }
    }

    // Check other combatants
    this.combatants.forEach(other => {
      // Skip same faction (no friendly fire)
      if (other.faction === combatant.faction) return;
      if (other.state === CombatantState.DEAD) return;

      const distance = combatant.position.distanceTo(other.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = other;
        targetIsPlayer = false;
      }
    });

    // IMPORTANT: Check player if combatant is OPFOR
    if (combatant.faction === Faction.OPFOR) {
      const playerDistance = combatant.position.distanceTo(this.playerPosition);
      if (playerDistance < minDistance && playerDistance < combatant.skillProfile.visualRange) {
        // Create a pseudo-combatant representing the player for targeting
        // We'll handle this specially in the shooting logic
        targetIsPlayer = true;
        console.log(`🎯 OPFOR targeting player at distance ${playerDistance.toFixed(1)}m`);

        // Return a special marker combatant for the player
        return {
          id: 'PLAYER',
          faction: Faction.US,
          position: this.playerPosition.clone(),
          velocity: new THREE.Vector3(), // TODO: Get from PlayerController
          state: CombatantState.ENGAGING,
          health: 100,
          maxHealth: 100
        } as Combatant;
      }
    }

    return nearest;
  }

  private canSeeTarget(combatant: Combatant, target: Combatant): boolean {
    // Handle player target specially
    const targetPos = target.id === 'PLAYER' ? this.playerPosition : target.position;

    // Simple LOS check - will be enhanced with BVH
    const distance = combatant.position.distanceTo(targetPos);

    if (distance > combatant.skillProfile.visualRange) return false;

    // Check FOV
    const toTarget = new THREE.Vector3()
      .subVectors(targetPos, combatant.position)
      .normalize();

    const forward = new THREE.Vector3(
      Math.cos(combatant.rotation),
      0,
      Math.sin(combatant.rotation)
    );

    const angle = Math.acos(forward.dot(toTarget));
    const halfFov = THREE.MathUtils.degToRad(combatant.skillProfile.fieldOfView / 2);

    if (angle > halfFov) return false;

    // TODO: Add BVH terrain occlusion check

    return true;
  }

  private raycastCombatants(
    ray: THREE.Ray,
    shooterFaction: Faction
  ): { combatant: Combatant; distance: number; point: THREE.Vector3; headshot: boolean } | null {
    let closest: { combatant: Combatant; distance: number; point: THREE.Vector3; headshot: boolean } | null = null;
    const tmp = new THREE.Vector3();

    this.combatants.forEach(combatant => {
      // Skip same faction unless friendly fire is on
      if (!this.FRIENDLY_FIRE_ENABLED && combatant.faction === shooterFaction) return;
      if (combatant.state === CombatantState.DEAD) return;

      // Multiple hitbox zones for more accurate detection
      // Adjust based on soldier state (different poses in sprites)
      let hitZones: Array<{ offset: THREE.Vector3; radius: number; isHead: boolean }>;

      // Different hitboxes for different states
      if (combatant.state === CombatantState.ENGAGING || combatant.state === CombatantState.SUPPRESSING) {
        // Firing state - soldier is aiming, slightly crouched
        hitZones = [
          // Head (smaller target when aiming)
          { offset: new THREE.Vector3(0, 2.5, 0), radius: 0.3, isHead: true },
          // Upper torso (leaning forward)
          { offset: new THREE.Vector3(0.2, 1.4, 0), radius: 0.65, isHead: false },
          // Lower torso (crouched)
          { offset: new THREE.Vector3(0, 0.4, 0), radius: 0.5, isHead: false },
          // Legs (bent, smaller profile)
          { offset: new THREE.Vector3(-0.2, -0.6, 0), radius: 0.35, isHead: false },
          { offset: new THREE.Vector3(0.2, -0.6, 0), radius: 0.35, isHead: false }
        ];
      } else if (combatant.state === CombatantState.ALERT) {
        // Alert state - ready position, weapon raised
        hitZones = [
          // Head (normal height)
          { offset: new THREE.Vector3(0, 2.7, 0), radius: 0.35, isHead: true },
          // Upper torso (ready stance)
          { offset: new THREE.Vector3(0, 1.5, 0), radius: 0.65, isHead: false },
          // Lower torso
          { offset: new THREE.Vector3(0, 0.5, 0), radius: 0.55, isHead: false },
          // Legs (ready stance, slightly spread)
          { offset: new THREE.Vector3(-0.35, -0.8, 0), radius: 0.4, isHead: false },
          { offset: new THREE.Vector3(0.35, -0.8, 0), radius: 0.4, isHead: false }
        ];
      } else {
        // Walking/Patrolling state - upright, normal profile
        hitZones = [
          // Head (full height)
          { offset: new THREE.Vector3(0, 2.8, 0), radius: 0.35, isHead: true },
          // Upper torso (walking posture)
          { offset: new THREE.Vector3(0, 1.5, 0), radius: 0.6, isHead: false },
          // Lower torso
          { offset: new THREE.Vector3(0, 0.5, 0), radius: 0.55, isHead: false },
          // Legs (walking, alternating position - average)
          { offset: new THREE.Vector3(-0.3, -0.8, 0), radius: 0.4, isHead: false },
          { offset: new THREE.Vector3(0.3, -0.8, 0), radius: 0.4, isHead: false }
        ];
      }

      // Check each hit zone
      for (const zone of hitZones) {
        const zoneCenter = combatant.position.clone().add(zone.offset);
        const toCenter = tmp.subVectors(zoneCenter, ray.origin);
        const t = toCenter.dot(ray.direction);

        if (t < 0 || t > this.MAX_ENGAGEMENT_RANGE) continue;

        const closestPoint = new THREE.Vector3()
          .copy(ray.origin)
          .addScaledVector(ray.direction, t);

        const distSq = closestPoint.distanceToSquared(zoneCenter);

        // Check if ray hits this zone
        if (distSq <= zone.radius * zone.radius) {
          const distance = t;

          // Only update if this is closer than previous hit
          if (!closest || distance < closest.distance) {
            // More accurate hit point on the actual sphere surface
            const hitDir = closestPoint.clone().sub(zoneCenter).normalize();
            const actualHitPoint = zoneCenter.clone().add(hitDir.multiplyScalar(zone.radius));

            closest = {
              combatant,
              distance,
              point: actualHitPoint,
              headshot: zone.isHead
            };

            // Don't check other zones for this combatant since we found a hit
            break;
          }
        }
      }
    });

    return closest;
  }

  private applyDamage(target: Combatant, damage: number, attacker?: Combatant): void {
    // If the target is the invisible player proxy, route damage to the real player
    if ((target as any).isPlayerProxy) {
      if (this.playerHealthSystem) {
        const killed = this.playerHealthSystem.takeDamage(damage, attacker?.position, this.playerPosition);
        if (killed && (this as any).hudSystem) {
          (this as any).hudSystem.addDeath();
        }
      }
      return;
    }

    target.health -= damage;

    // Add suppression effect
    target.suppressionLevel = Math.min(1.0, target.suppressionLevel + 0.3);

    if (target.health <= 0) {
      target.state = CombatantState.DEAD;
      console.log(`💀 ${target.faction} soldier eliminated${attacker ? ` by ${attacker.faction}` : ''}`);

      // Play death sound at combatant position
      if (this.audioManager) {
        const isAlly = target.faction === Faction.US;
        this.audioManager.playDeathSound(target.position, isAlly);
      }

      // Notify ticket system of casualty
      if (this.ticketSystem) {
        this.ticketSystem.onCombatantDeath(target.faction);
      }

      // Remove from squad
      if (target.squadId) {
        const squad = this.squads.get(target.squadId);
        if (squad) {
          const index = squad.members.indexOf(target.id);
          if (index > -1) {
            squad.members.splice(index, 1);
          }
        }
      }

      // Schedule for removal
      setTimeout(() => this.removeCombatant(target.id), 5000);
    }
  }

  private removeCombatant(id: string): void {
    this.combatants.delete(id);
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

    // Try to maintain balance
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
    // Prefer spawning near faction-owned zones if available
    if (this.zoneManager) {
      const owned = this.zoneManager.getZonesByOwner(faction);
      const base = owned.find(z => z.id === (faction === Faction.US ? 'us_base' : 'opfor_base'));
      const anchor = (base ?? owned.find(z => !z.isHomeBase))?.position;
      if (anchor) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 15 + Math.random() * 35;
        const x = anchor.x + Math.cos(angle) * radius;
        const z = anchor.z + Math.sin(angle) * radius;
        const y = this.getTerrainHeight(x, z) + 3;
        return new THREE.Vector3(x, y, z);
      }
    }

    // Fallback relative to player
    let angle: number;
    let distance: number;
    if (faction === Faction.US) {
      angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.5;
      distance = 20 + Math.random() * 20;
    } else {
      angle = (Math.random() - 0.5) * Math.PI;
      distance = 80 + Math.random() * 60;
    }

    const cameraDir = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDir);
    const cameraAngle = Math.atan2(cameraDir.x, cameraDir.z);
    const finalAngle = cameraAngle + angle;
    const x = this.playerPosition.x + Math.cos(finalAngle) * distance;
    const z = this.playerPosition.z + Math.sin(finalAngle) * distance;
    const y = this.getTerrainHeight(x, z) + 3;
    const spawnPos = new THREE.Vector3(x, y, z);
    // Nudge if too close to others
    this.combatants.forEach(c => {
      if (c.position.distanceTo(spawnPos) < 10) {
        spawnPos.x += 10;
        spawnPos.z += 10;
      }
    });
    return spawnPos;
  }

  private getTerrainHeight(x: number, z: number): number {
    if (this.chunkManager) {
      const height = this.chunkManager.getHeightAt(x, z);
      // If chunk isn't loaded, use a reasonable default height
      // This prevents NPCs from sinking when terrain isn't loaded
      if (height === 0 && (Math.abs(x) > 50 || Math.abs(z) > 50)) {
        // Assume flat terrain at y=5 for unloaded chunks
        return 5;
      }
      return height;
    }
    return 5; // Default terrain height
  }

  // Public API for player interactions

  /**
   * Handle player shooting - check if hit any combatants
   */
  handlePlayerShot(ray: THREE.Ray, damageCalculator: (distance: number, isHeadshot: boolean) => number): { hit: boolean; point: THREE.Vector3; killed?: boolean; headshot?: boolean } {
    const hit = this.raycastCombatants(ray, this.playerFaction);

    if (hit) {
      const damage = damageCalculator(hit.distance, hit.headshot);
      const targetHealth = hit.combatant.health;
      this.applyDamage(hit.combatant, damage);

      // Check if this shot killed the target
      const killed = targetHealth > 0 && hit.combatant.health <= 0;

      // Notify HUD system if we have one and got a kill
      if (killed && (this as any).hudSystem) {
        (this as any).hudSystem.addKill();
      }

      return { hit: true, point: hit.point, killed, headshot: hit.headshot };
    }

    // No hit
    const endPoint = new THREE.Vector3()
      .copy(ray.origin)
      .addScaledVector(ray.direction, this.MAX_ENGAGEMENT_RANGE);
    return { hit: false, point: endPoint };
  }

  /**
   * Check if AI shot hits the player (for future player damage system)
   * Player hitbox is simpler since it's first-person
   */
  checkPlayerHit(ray: THREE.Ray): { hit: boolean; point: THREE.Vector3; headshot: boolean } {
    // Player hitbox zones (relative to camera position)
    const playerHitZones = [
      // Match enemy engaging-sized multi-sphere hitbox, relative to camera (head level)
      { offset: new THREE.Vector3(0, 0.0, 0), radius: 0.35, isHead: true },
      { offset: new THREE.Vector3(0.2, -1.1, 0), radius: 0.65, isHead: false },
      { offset: new THREE.Vector3(0, -2.1, 0), radius: 0.55, isHead: false },
      { offset: new THREE.Vector3(-0.2, -3.1, 0), radius: 0.35, isHead: false },
      { offset: new THREE.Vector3(0.2, -3.1, 0), radius: 0.35, isHead: false }
    ];

    const tmp = new THREE.Vector3();

    for (const zone of playerHitZones) {
      const zoneCenter = this.playerPosition.clone().add(zone.offset);
      const toCenter = tmp.subVectors(zoneCenter, ray.origin);
      const t = toCenter.dot(ray.direction);

      if (t < 0 || t > this.MAX_ENGAGEMENT_RANGE) continue;

      const closestPoint = new THREE.Vector3()
        .copy(ray.origin)
        .addScaledVector(ray.direction, t);

      const distSq = closestPoint.distanceToSquared(zoneCenter);

      if (distSq <= zone.radius * zone.radius) {
        const hitDir = closestPoint.clone().sub(zoneCenter).normalize();
        const actualHitPoint = zoneCenter.clone().add(hitDir.multiplyScalar(zone.radius));

        return {
          hit: true,
          point: actualHitPoint,
          headshot: zone.isHead
        };
      }
    }

    return { hit: false, point: new THREE.Vector3(), headshot: false };
  }

  /**
   * Get combat statistics for UI
   */
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

  setChunkManager(chunkManager: ImprovedChunkManager): void {
    this.chunkManager = chunkManager;
  }

  setTicketSystem(ticketSystem: TicketSystem): void {
    this.ticketSystem = ticketSystem;
  }

  setPlayerHealthSystem(playerHealthSystem: PlayerHealthSystem): void {
    this.playerHealthSystem = playerHealthSystem;
  }

  setZoneManager(zoneManager: ZoneManager): void {
    this.zoneManager = zoneManager;
  }

  setHUDSystem(hudSystem: any): void {
    (this as any).hudSystem = hudSystem;
  }

  setAudioManager(audioManager: AudioManager): void {
    this.audioManager = audioManager;
  }

  // Enable combat (called after game start delay)
  enableCombat(): void {
    this.combatEnabled = true;
    console.log('⚔️ Combat AI activated');
  }

  dispose(): void {
    // Clean up meshes
    this.factionMeshes.forEach(mesh => {
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
      this.scene.remove(mesh);
    });

    // Clean up pools
    this.tracerPool.dispose();
    this.muzzleFlashPool.dispose();
    this.impactEffectsPool.dispose();

    // Clear maps
    this.factionMeshes.clear();
    this.soldierTextures.clear();
    this.combatants.clear();
    this.squads.clear();

    console.log('🧹 Combatant System disposed');
  }
}