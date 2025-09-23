import * as THREE from 'three';
import { GameSystem } from '../types';
import { AssetLoader } from '../systems/assets/AssetLoader';
import { PlayerController } from '../systems/player/PlayerController';
import { CombatantSystem } from '../systems/combat/CombatantSystem';
import { Skybox } from '../systems/environment/Skybox';
import { ImprovedChunkManager } from '../systems/terrain/ImprovedChunkManager';
import { GlobalBillboardSystem } from '../systems/world/billboard/GlobalBillboardSystem';
import { WaterSystem } from '../systems/environment/WaterSystem';
import { FirstPersonWeapon } from '../systems/player/FirstPersonWeapon';
import { ZoneManager } from '../systems/world/ZoneManager';
import { HUDSystem } from '../ui/hud/HUDSystem';
import { TicketSystem } from '../systems/world/TicketSystem';
import { PlayerHealthSystem } from '../systems/player/PlayerHealthSystem';
import { MinimapSystem } from '../ui/minimap/MinimapSystem';
import { AudioManager } from '../systems/audio/AudioManager';
import { GameModeManager } from '../systems/world/GameModeManager';
import { GameMode } from '../config/gameModes';
import { PlayerRespawnManager } from '../systems/player/PlayerRespawnManager';
import { FullMapSystem } from '../ui/map/FullMapSystem';
import { CompassSystem } from '../ui/compass/CompassSystem';
import { HelipadSystem } from '../systems/helicopter/HelipadSystem';
import { HelicopterModel } from '../systems/helicopter/HelicopterModel';
// VRManager removed - functionality migrated to VRSystem
import { CameraRig } from '../systems/camera/CameraRig';
import { InputManager } from '../systems/input/InputManager';
import { VRSystem } from '../systems/vr/VRSystem';
import { VRHUDSystem } from '../systems/vr/VRHUDSystem';
import { ModernPlayerController } from '../systems/player/ModernPlayerController';

export class SandboxSystemManager {
  private systems: GameSystem[] = [];

  // Game systems
  public assetLoader!: AssetLoader;
  public chunkManager!: ImprovedChunkManager;
  public globalBillboardSystem!: GlobalBillboardSystem;
  public playerController!: PlayerController;
  public combatantSystem!: CombatantSystem;
  public skybox!: Skybox;
  public waterSystem!: WaterSystem;
  public firstPersonWeapon!: FirstPersonWeapon;
  public zoneManager!: ZoneManager;
  public hudSystem!: HUDSystem;
  public ticketSystem!: TicketSystem;
  public playerHealthSystem!: PlayerHealthSystem;
  public minimapSystem!: MinimapSystem;
  public audioManager!: AudioManager;
  public gameModeManager!: GameModeManager;
  public playerRespawnManager!: PlayerRespawnManager;
  public fullMapSystem!: FullMapSystem;
  public compassSystem!: CompassSystem;
  public helipadSystem!: HelipadSystem;
  public helicopterModel!: HelicopterModel;
  // VRManager removed - using VRSystem instead

  // New modern systems
  public cameraRig!: CameraRig;
  public inputManager!: InputManager;
  public vrSystem!: VRSystem;
  public vrHUDSystem?: VRHUDSystem;
  public modernPlayerController!: ModernPlayerController;

  async initializeSystems(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    onProgress: (phase: string, progress: number) => void,
    sandboxRenderer?: any
  ): Promise<void> {
    console.log('🔧 Initializing game systems...');

    // Phase 1: Core systems
    onProgress('core', 0);

    this.assetLoader = new AssetLoader();

    // Initialize modern VR/Desktop systems
    if (sandboxRenderer && sandboxRenderer.renderer) {
      // Create camera rig first
      this.cameraRig = new CameraRig(scene, camera);

      // Create input manager
      this.inputManager = new InputManager(sandboxRenderer.renderer);

      // Create VR system
      this.vrSystem = new VRSystem(scene, sandboxRenderer.renderer, this.cameraRig, this.inputManager);

      // Create VR HUD system
      this.vrHUDSystem = new VRHUDSystem({
        scene,
        camera,
        leftController: this.vrSystem.getLeftController() || undefined,
        rightController: this.vrSystem.getRightController() || undefined
      });

      // Make VR HUD globally accessible for damage/hit indicators
      (window as any).vrHUDSystem = this.vrHUDSystem;

      // VRManager functionality has been migrated to VRSystem
      // VRSystem now handles all VR functionality including:
      // - Controller input states and button detection
      // - Position tracking and movement
      // - Session management and weapon attachment
      // - Head tracking and controller directions
    }

    onProgress('core', 0.5);

    this.globalBillboardSystem = new GlobalBillboardSystem(scene, camera, this.assetLoader);
    this.chunkManager = new ImprovedChunkManager(scene, camera, this.assetLoader, this.globalBillboardSystem);
    onProgress('core', 1);

    // Phase 2: Load textures
    onProgress('textures', 0);
    await this.assetLoader.init();
    onProgress('textures', 1);

    // Phase 3: Load audio
    onProgress('audio', 0);
    this.audioManager = new AudioManager(scene, camera);
    await this.audioManager.init();
    onProgress('audio', 1);

    // Phase 4: Initialize world systems
    onProgress('world', 0);

    // Create both controllers for transition period
    this.playerController = new PlayerController(camera);

    // Create modern player controller if we have the new systems
    if (this.cameraRig && this.inputManager) {
      this.modernPlayerController = new ModernPlayerController(
        scene,
        this.cameraRig,
        this.inputManager,
        this.vrSystem
      );
    }
    this.combatantSystem = new CombatantSystem(scene, camera, this.globalBillboardSystem, this.assetLoader, this.chunkManager);
    this.skybox = new Skybox(scene);
    this.waterSystem = new WaterSystem(scene, this.assetLoader);
    this.firstPersonWeapon = new FirstPersonWeapon(scene, camera, this.assetLoader);
    this.zoneManager = new ZoneManager(scene);
    this.ticketSystem = new TicketSystem();
    this.playerHealthSystem = new PlayerHealthSystem();
    this.playerRespawnManager = new PlayerRespawnManager(scene, camera);
    this.hudSystem = new HUDSystem(camera, this.ticketSystem, this.playerHealthSystem, this.playerRespawnManager);
    this.minimapSystem = new MinimapSystem(camera);
    this.fullMapSystem = new FullMapSystem(camera);
    this.compassSystem = new CompassSystem(camera);
    this.gameModeManager = new GameModeManager();
    this.helipadSystem = new HelipadSystem(scene);
    this.helicopterModel = new HelicopterModel(scene);

    this.connectSystems(scene, camera, sandboxRenderer);

    // Add systems to update list
    this.systems = [
      this.assetLoader,
      this.audioManager,
      this.globalBillboardSystem,
      this.chunkManager,
      this.waterSystem,
      this.playerController,
      this.firstPersonWeapon,
      this.combatantSystem,
      this.zoneManager,
      this.ticketSystem,
      this.playerHealthSystem,
      this.playerRespawnManager,
      this.minimapSystem,
      this.fullMapSystem,
      this.compassSystem,
      this.hudSystem,
      this.helipadSystem,
      this.helicopterModel,
      this.skybox,
      this.gameModeManager
    ];

    // Add new modern systems if they exist
    if (this.inputManager) {
      // InputManager doesn't implement GameSystem, so we'll update it separately
    }
    if (this.vrSystem) {
      this.systems.push(this.vrSystem);
    }
    if (this.modernPlayerController) {
      this.systems.push(this.modernPlayerController);
    }

    // Add VR Manager if it exists (for backward compatibility)
    if (this.vrSystem) {
      this.systems.push(this.vrSystem);
    }

    onProgress('world', 0.5);

    // Initialize all systems
    for (const system of this.systems) {
      await system.init();
    }

    onProgress('world', 1);
  }

  private connectSystems(scene: THREE.Scene, camera: THREE.PerspectiveCamera, sandboxRenderer?: any): void {
    // Connect modern systems
    if (this.modernPlayerController) {
      this.modernPlayerController.setChunkManager(this.chunkManager);
      this.modernPlayerController.setGameModeManager(this.gameModeManager);
      this.cameraRig.setChunkManager(this.chunkManager);
    }

    // Connect camera rig to billboard system for VR support
    if (this.cameraRig && this.globalBillboardSystem) {
      this.globalBillboardSystem.setCameraRig(this.cameraRig);
    }

    // Connect systems with chunk manager
    this.playerController.setChunkManager(this.chunkManager);
    this.playerController.setGameModeManager(this.gameModeManager);
    this.playerController.setHelicopterModel(this.helicopterModel);
    this.playerController.setFirstPersonWeapon(this.firstPersonWeapon);
    this.playerController.setHUDSystem(this.hudSystem);
    if (sandboxRenderer) {
      this.playerController.setSandboxRenderer(sandboxRenderer);
    }
    // Connect VRSystem to PlayerController (replacing VRManager)
    if (this.vrSystem) {
      this.playerController.setVRSystem(this.vrSystem);
      this.vrSystem.setPlayerController(this.playerController);
    }
    // Connect CameraRig to PlayerController for VRSystem sync
    if (this.cameraRig) {
      this.playerController.setCameraRig(this.cameraRig);
    }
    this.combatantSystem.setChunkManager(this.chunkManager);
    this.firstPersonWeapon.setPlayerController(this.playerController);
    this.firstPersonWeapon.setCombatantSystem(this.combatantSystem);
    this.firstPersonWeapon.setHUDSystem(this.hudSystem);
    this.firstPersonWeapon.setZoneManager(this.zoneManager);

    // Connect VRSystem to weapon and systems (replacing VRManager)
    if (this.vrSystem) {
      this.firstPersonWeapon.setVRSystem(this.vrSystem);
      this.vrSystem.setFirstPersonWeapon(this.firstPersonWeapon);
    }

    // VRManager removed - all functionality now in VRSystem
    // Connect VR HUD system to weapon
    if (this.vrHUDSystem) {
      this.firstPersonWeapon.setVRHUDSystem(this.vrHUDSystem);
    }
    this.hudSystem.setCombatantSystem(this.combatantSystem);
    this.hudSystem.setZoneManager(this.zoneManager);
    this.hudSystem.setTicketSystem(this.ticketSystem);
    this.ticketSystem.setZoneManager(this.zoneManager);
    this.combatantSystem.setTicketSystem(this.ticketSystem);
    this.combatantSystem.setPlayerHealthSystem(this.playerHealthSystem);
    this.combatantSystem.setZoneManager(this.zoneManager);
    this.combatantSystem.setGameModeManager(this.gameModeManager);
    this.combatantSystem.setHUDSystem(this.hudSystem);
    this.playerHealthSystem.setZoneManager(this.zoneManager);
    this.playerHealthSystem.setTicketSystem(this.ticketSystem);
    this.playerHealthSystem.setPlayerController(this.playerController);
    this.playerHealthSystem.setFirstPersonWeapon(this.firstPersonWeapon);
    this.playerHealthSystem.setCamera(camera);
    this.playerHealthSystem.setRespawnManager(this.playerRespawnManager);
    this.playerHealthSystem.setHUDSystem(this.hudSystem);
    this.minimapSystem.setZoneManager(this.zoneManager);
    this.minimapSystem.setCombatantSystem(this.combatantSystem);
    this.fullMapSystem.setZoneManager(this.zoneManager);
    this.fullMapSystem.setCombatantSystem(this.combatantSystem);
    this.fullMapSystem.setGameModeManager(this.gameModeManager);
    this.zoneManager.setCombatantSystem(this.combatantSystem);
    this.zoneManager.setCamera(camera);
    this.zoneManager.setChunkManager(this.chunkManager);

    // Connect audio manager
    this.firstPersonWeapon.setAudioManager(this.audioManager);
    this.combatantSystem.setAudioManager(this.audioManager);

    // Connect respawn manager
    this.playerRespawnManager.setPlayerHealthSystem(this.playerHealthSystem);
    this.playerRespawnManager.setZoneManager(this.zoneManager);
    this.playerRespawnManager.setGameModeManager(this.gameModeManager);
    this.playerRespawnManager.setPlayerController(this.playerController);
    this.playerRespawnManager.setFirstPersonWeapon(this.firstPersonWeapon);

    // Connect helipad system
    this.helipadSystem.setTerrainManager(this.chunkManager);
    this.helipadSystem.setVegetationSystem(this.globalBillboardSystem);
    this.helipadSystem.setGameModeManager(this.gameModeManager);

    // Connect helicopter model
    this.helicopterModel.setTerrainManager(this.chunkManager);
    this.helicopterModel.setHelipadSystem(this.helipadSystem);
    this.helicopterModel.setPlayerController(this.playerController);
    this.helicopterModel.setHUDSystem(this.hudSystem);
    this.helicopterModel.setAudioListener(this.audioManager.getListener());


    // Connect game mode manager to systems
    this.gameModeManager.connectSystems(
      this.zoneManager,
      this.combatantSystem,
      this.ticketSystem,
      this.chunkManager,
      this.minimapSystem
    );
  }

  async preGenerateSpawnArea(spawnPos: THREE.Vector3): Promise<void> {
    console.log(`Pre-generating spawn areas for game mode...`);

    if (this.chunkManager && this.gameModeManager) {
      const currentConfig = this.gameModeManager.getCurrentConfig();
      const isOpenFrontier = currentConfig.id === 'open_frontier';

      if (isOpenFrontier) {
        // Open Frontier: Generate chunks for far spawn points
        console.log('🌍 Open Frontier mode - generating extended terrain...');

        // Generate US Main HQ area at -1400
        const usMainHQ = new THREE.Vector3(0, 0, -1400);
        console.log('🇺🇸 Generating US Main HQ chunks at z=-1400...');
        this.chunkManager.updatePlayerPosition(usMainHQ);
        this.chunkManager.update(0.01);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Generate OPFOR Main HQ area at +1400
        const opforMainHQ = new THREE.Vector3(0, 0, 1400);
        console.log('🚩 Generating OPFOR Main HQ chunks at z=+1400...');
        this.chunkManager.updatePlayerPosition(opforMainHQ);
        this.chunkManager.update(0.01);
        await new Promise(resolve => setTimeout(resolve, 200));

        // Generate some intermediate zones
        const middleZone = new THREE.Vector3(0, 0, 0);
        console.log('⚔️ Generating central battlefield chunks...');
        this.chunkManager.updatePlayerPosition(middleZone);
        this.chunkManager.update(0.01);
        await new Promise(resolve => setTimeout(resolve, 100));

      } else {
        // Zone Control: Generate chunks for close spawn points
        console.log('🏁 Zone Control mode - generating standard terrain...');

        // Generate US base chunks
        const usBasePos = new THREE.Vector3(0, 0, -50);
        console.log('🇺🇸 Generating US base chunks...');
        this.chunkManager.updatePlayerPosition(usBasePos);
        this.chunkManager.update(0.01);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Generate OPFOR base chunks
        const opforBasePos = new THREE.Vector3(0, 0, 145);
        console.log('🚩 Generating OPFOR base chunks...');
        this.chunkManager.updatePlayerPosition(opforBasePos);
        this.chunkManager.update(0.01);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Generate middle battlefield chunks
        const centerPos = new THREE.Vector3(0, 0, 50);
        console.log('⚔️ Generating battlefield chunks...');
        this.chunkManager.updatePlayerPosition(centerPos);
        this.chunkManager.update(0.01);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Return to player spawn position and ensure it's loaded
      console.log(`📍 Ensuring spawn area is loaded at: ${spawnPos.x.toFixed(1)}, ${spawnPos.z.toFixed(1)}`);
      this.chunkManager.updatePlayerPosition(spawnPos);
      this.chunkManager.update(0.01);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Initialize zones after chunk generation
      console.log('🚩 Initializing zones after chunk generation...');
      this.zoneManager.initializeZones();
    }
  }

  updateSystems(deltaTime: number): void {
    // Update InputManager separately (doesn't implement GameSystem)
    if (this.inputManager) {
      this.inputManager.update(deltaTime);
    }

    // Update VR HUD System
    if (this.vrHUDSystem && (this.vrSystem?.isVRActive() || this.vrSystem?.isVRActive())) {
      // Gather game state for HUD
      const gameState = {
        health: this.playerHealthSystem?.getHealth() || 100,
        ammo: this.firstPersonWeapon?.getAmmoState()?.currentMagazine || 30,
        maxAmmo: this.firstPersonWeapon?.getAmmoState()?.reserveAmmo || 90,
        playerPosition: this.playerController?.getPosition(),
        playerRotation: this.camera?.rotation,
        zones: this.zoneManager?.getZones()
      };

      this.vrHUDSystem.update(gameState);

      // Handle VR button inputs for HUD
      this.handleVRHUDInput();
    }

    // Update all GameSystem implementations
    for (const system of this.systems) {
      system.update(deltaTime);
    }
  }

  private handleVRHUDInput(): void {
    if (!this.vrHUDSystem || !this.vrSystem) return;

    // Check for button presses to toggle HUD elements
    if (this.vrSystem.isButtonPressed('xButton')) {
      this.vrHUDSystem.handleControllerInput('xButton', 'left');
    }
    if (this.vrSystem.isButtonPressed('yButton')) {
      this.vrHUDSystem.handleControllerInput('yButton', 'left');
    }

    // Handle grip for wrist display
    const inputs = this.vrSystem.getControllerInputs();
    if (inputs.leftGrip) {
      this.vrHUDSystem.handleControllerInput('leftGrip', 'left');
    } else {
      this.vrHUDSystem.handleGripRelease('left');
    }
  }

  getSystems(): GameSystem[] {
    return this.systems;
  }

  dispose(): void {
    for (const system of this.systems) {
      system.dispose();
    }
  }

  setGameMode(mode: GameMode): void {
    this.gameModeManager.setGameMode(mode);
  }
}