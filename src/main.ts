import * as THREE from 'three';
import './style.css';

// Import loading screen first
import { LoadingScreen } from './systems/LoadingScreen';

// Import our game systems
import { AssetLoader } from './systems/AssetLoader';
// Legacy systems removed: Terrain, BillboardSystem, WorldGenerator
import { PlayerController } from './systems/PlayerController';
// Legacy systems removed - using unified CombatantSystem
import { CombatantSystem } from './systems/CombatantSystem';
import { Skybox } from './systems/Skybox';
import { ImprovedChunkManager } from './systems/ImprovedChunkManager';
import { GlobalBillboardSystem } from './systems/GlobalBillboardSystem';
import { PixelPerfectUtils } from './utils/PixelPerfect';
import { WaterSystem } from './systems/WaterSystem';
import { FirstPersonWeapon } from './systems/FirstPersonWeapon';
import { ZoneManager } from './systems/ZoneManager';
import { HUDSystem } from './systems/HUDSystem';
import { TicketSystem } from './systems/TicketSystem';
import { PlayerHealthSystem } from './systems/PlayerHealthSystem';
import { MinimapSystem } from './systems/MinimapSystem';
import { AudioManager } from './systems/AudioManager';
import { GameSystem } from './types';

class PixelArtSandbox {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private systems: GameSystem[] = [];
  private loadingScreen: LoadingScreen;

  // Game systems
  private assetLoader!: AssetLoader;
  private chunkManager!: ImprovedChunkManager;
  private globalBillboardSystem!: GlobalBillboardSystem;
  private playerController!: PlayerController;
  // Using unified CombatantSystem for all NPCs
  private combatantSystem!: CombatantSystem;
  private skybox!: Skybox;
  private waterSystem!: WaterSystem;
  private firstPersonWeapon!: FirstPersonWeapon;
  private zoneManager!: ZoneManager;
  private hudSystem!: HUDSystem;
  private ticketSystem!: TicketSystem;
  private playerHealthSystem!: PlayerHealthSystem;
  private minimapSystem!: MinimapSystem;
  private audioManager!: AudioManager;

  // Game state
  private clock = new THREE.Clock();
  private isInitialized = false;
  private gameStarted = false;
  private spawnLoadingDiv?: HTMLDivElement;

  constructor() {
    console.log('🎮 Initializing Pixel Art Sandbox Engine...');
    console.log('Three.js version:', THREE.REVISION);

    // Create loading screen immediately
    this.loadingScreen = new LoadingScreen();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // Disabled for pixel-perfect rendering
      powerPreference: 'high-performance'
    });

    this.setupRenderer();
    this.setupLighting();
    this.setupEventListeners();

    // Setup menu callbacks
    this.setupMenuCallbacks();

    // Start initialization process
    this.initializeSystems();
  }

  private setupRenderer(): void {
    // Configure for pixel-perfect rendering
    PixelPerfectUtils.configureRenderer(this.renderer);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    document.body.appendChild(this.renderer.domElement);

    // Hide renderer initially
    this.renderer.domElement.style.display = 'none';
  }

  private setupLighting(): void {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0x87CEEB, 0.6); // Sky blue ambient
    this.scene.add(ambientLight);

    // Directional light (sun) with shadows
    const directionalLight = new THREE.DirectionalLight(0xFFE5B4, 0.8); // Warm sunlight
    directionalLight.position.set(50, 100, 30);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;

    this.scene.add(directionalLight);

    console.log('✨ Lighting setup complete');
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Performance monitoring
    window.addEventListener('keydown', (event) => {
      if (event.key === 'F1') {
        this.togglePerformanceStats();
      }
    });
  }

  private setupMenuCallbacks(): void {
    // Play button starts the game
    this.loadingScreen.onPlay(() => {
      this.startGame();
    });

    // Settings button (placeholder for now)
    this.loadingScreen.onSettings(() => {
      console.log('Settings menu not yet implemented');
      // TODO: Show settings menu
    });

    // How to play button (placeholder for now)
    this.loadingScreen.onHowToPlay(() => {
      console.log('How to play not yet implemented');
      // TODO: Show how to play screen
    });
  }

  private async initializeSystems(): Promise<void> {
    try {
      console.log('🔧 Initializing game systems...');

      // Phase 1: Core systems (10%)
      this.loadingScreen.updateProgress('core', 0);

      // Initialize core systems with global billboard system
      this.assetLoader = new AssetLoader();

      this.loadingScreen.updateProgress('core', 0.5);

      this.globalBillboardSystem = new GlobalBillboardSystem(this.scene, this.camera, this.assetLoader);
      this.chunkManager = new ImprovedChunkManager(this.scene, this.camera, this.assetLoader, this.globalBillboardSystem);

      this.loadingScreen.updateProgress('core', 1);

      // Phase 2: Load textures (40%)
      this.loadingScreen.updateProgress('textures', 0);

      await this.assetLoader.init();

      this.loadingScreen.updateProgress('textures', 1);

      // Phase 3: Load audio (20%)
      this.loadingScreen.updateProgress('audio', 0);

      this.audioManager = new AudioManager(this.scene, this.camera);
      await this.audioManager.init();

      this.loadingScreen.updateProgress('audio', 1);

      // Phase 4: Initialize world systems (20%)
      this.loadingScreen.updateProgress('world', 0);

      // Keep original systems for fallback compatibility
      this.playerController = new PlayerController(this.camera);
      this.combatantSystem = new CombatantSystem(this.scene, this.camera, this.globalBillboardSystem, this.assetLoader, this.chunkManager);
      this.skybox = new Skybox(this.scene);
      this.waterSystem = new WaterSystem(this.scene, this.assetLoader);
      this.firstPersonWeapon = new FirstPersonWeapon(this.scene, this.camera, this.assetLoader);
      this.zoneManager = new ZoneManager(this.scene);
      this.hudSystem = new HUDSystem();
      this.ticketSystem = new TicketSystem();
      this.playerHealthSystem = new PlayerHealthSystem();
      this.minimapSystem = new MinimapSystem(this.camera);

      // Connect systems with chunk manager
      this.playerController.setChunkManager(this.chunkManager);
      this.combatantSystem.setChunkManager(this.chunkManager);
      this.firstPersonWeapon.setPlayerController(this.playerController);
      this.firstPersonWeapon.setCombatantSystem(this.combatantSystem);
      this.firstPersonWeapon.setHUDSystem(this.hudSystem); // Connect HUD to weapon for hit markers
      this.hudSystem.setCombatantSystem(this.combatantSystem);
      this.hudSystem.setZoneManager(this.zoneManager);
      this.hudSystem.setTicketSystem(this.ticketSystem);
      this.ticketSystem.setZoneManager(this.zoneManager);
      this.combatantSystem.setTicketSystem(this.ticketSystem);
      this.combatantSystem.setPlayerHealthSystem(this.playerHealthSystem);
      this.combatantSystem.setZoneManager(this.zoneManager);
      this.combatantSystem.setHUDSystem(this.hudSystem); // Connect HUD to combatant system for kill tracking
      this.playerHealthSystem.setZoneManager(this.zoneManager);
      this.playerHealthSystem.setTicketSystem(this.ticketSystem);
      this.playerHealthSystem.setPlayerController(this.playerController); // Connect player controller for respawning
      this.playerHealthSystem.setFirstPersonWeapon(this.firstPersonWeapon); // Connect weapon for disabling on death
      this.minimapSystem.setZoneManager(this.zoneManager);
      this.minimapSystem.setCombatantSystem(this.combatantSystem);
      this.zoneManager.setCombatantSystem(this.combatantSystem);
      this.zoneManager.setCamera(this.camera);
      this.zoneManager.setChunkManager(this.chunkManager);

      // Connect audio manager
      this.firstPersonWeapon.setAudioManager(this.audioManager);
      this.combatantSystem.setAudioManager(this.audioManager);

      // Add systems to update list - NEW ORDER WITH GLOBAL BILLBOARD SYSTEM
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
        this.minimapSystem,
        this.hudSystem,
        this.skybox
      ];

      this.loadingScreen.updateProgress('world', 0.5);

      // Initialize all systems
      for (const system of this.systems) {
        await system.init();
      }

      this.loadingScreen.updateProgress('world', 1);

      // Phase 5: Final setup (10%)
      this.loadingScreen.updateProgress('entities', 0);

      console.log('🎯 Systems initialized, loading assets...');
      await this.loadGameAssets();

      // Create skybox for the world
      const skyboxTexture = this.assetLoader.getTexture('skybox');
      if (skyboxTexture) {
        this.skybox.createSkybox(skyboxTexture);
        console.log('☁️ Skybox created');
      }

      // Pre-generate spawn area chunks during loading
      console.log('🌍 Pre-generating spawn area...');
      const spawnPosition = new THREE.Vector3(0, 5, -50); // US Base spawn
      await this.preGenerateSpawnArea(spawnPosition);

      console.log('🌍 World system ready!');

      this.loadingScreen.updateProgress('entities', 1)

      this.isInitialized = true;
      console.log('🚀 Pixel Art Sandbox ready!');

      // Show main menu instead of starting immediately
      this.loadingScreen.showMainMenu();

    } catch (error) {
      console.error('❌ Failed to initialize sandbox:', error);
    }
  }

  private async preGenerateSpawnArea(spawnPos: THREE.Vector3): Promise<void> {
    // Pre-generate chunks for BOTH faction bases
    console.log(`Pre-generating spawn areas for both factions...`);

    if (this.chunkManager) {
      // First, generate US base chunks (where player spawns)
      const usBasePos = new THREE.Vector3(0, 0, -50);
      console.log('🇺🇸 Generating US base chunks...');
      this.chunkManager.updatePlayerPosition(usBasePos);
      this.chunkManager.update(0.01);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Then, generate OPFOR base chunks (moved back from Bravo zone)
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

      // Return to player spawn position
      this.chunkManager.updatePlayerPosition(spawnPos);
      this.chunkManager.update(0.01);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now that ALL chunks are generated, create zones at proper heights
      console.log('🚩 Initializing zones after chunk generation...');
      this.zoneManager.initializeZones();
    }
  }

  private async loadGameAssets(): Promise<void> {
    // Assets are auto-discovered by AssetLoader; ensure critical ones exist but don't hard-fail
    const skyboxTexture = this.assetLoader.getTexture('skybox');
    if (!skyboxTexture) {
      console.warn('Skybox texture missing; proceeding without skybox.');
    }
    console.log('📦 Asset check complete');
  }

  private startGame(): void {
    if (!this.isInitialized || this.gameStarted) return;

    console.log('🎮 Starting game...');
    this.gameStarted = true;

    // Hide menu immediately
    this.loadingScreen.hide();

    // Show loading indicator right away
    this.showSpawnLoadingIndicator();

    // Show renderer
    this.renderer.domElement.style.display = 'block';

    // Chunks are ALREADY generated from preGenerateSpawnArea during init!
    // Just need to hide loading indicator after a brief moment
    const startTime = performance.now();

    setTimeout(() => {
      console.log(`Game ready in ${performance.now() - startTime}ms`);

      // Hide loading indicator
      this.hideSpawnLoadingIndicator();

            // Enable controls immediately
            setTimeout(() => {
        // Enable weapon input
        if (this.firstPersonWeapon && typeof (this.firstPersonWeapon as any).setGameStarted === 'function') {
          (this.firstPersonWeapon as any).setGameStarted(true);
        }

        // Enable player controller and mouse lock
        if (this.playerController && typeof (this.playerController as any).setGameStarted === 'function') {
          (this.playerController as any).setGameStarted(true);
        }

        // Show instructions to click for mouse lock
        console.log('🖱️ Click anywhere to enable mouse look!');

        // Start ambient audio
        if (this.audioManager) {
          this.audioManager.startAmbient();
        }

        // Enable AI combat immediately for instant action
        if (this.combatantSystem && typeof this.combatantSystem.enableCombat === 'function') {
          this.combatantSystem.enableCombat();
          console.log('⚔️ Combat AI activated!');
        }
            }, 200);
    }, 300); // Brief delay to show loading indicator

    // Show crosshair
    const crosshair = document.createElement('div');
    crosshair.style.position = 'fixed';
    crosshair.style.left = '50%';
    crosshair.style.top = '50%';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.width = '4px';
    crosshair.style.height = '4px';
    crosshair.style.background = '#ff3333';
    crosshair.style.borderRadius = '50%';
    crosshair.style.pointerEvents = 'none';
    crosshair.style.zIndex = '10';
    document.body.appendChild(crosshair);

    this.showWelcomeMessage();
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private togglePerformanceStats(): void {
    if (!this.gameStarted) return;

    const debugInfo = this.globalBillboardSystem.getDebugInfo();
    console.log('📊 Performance Stats:');
    console.log(`FPS: ${Math.round(1 / this.clock.getDelta())}`);
    console.log(`Draw calls: ${this.renderer.info.render.calls}`);
    console.log(`Triangles: ${this.renderer.info.render.triangles}`);
    console.log(`Grass instances: ${debugInfo.grassUsed}/${this.globalBillboardSystem.getInstanceCount('grass')}`);
    console.log(`Tree instances: ${debugInfo.treeUsed}/${this.globalBillboardSystem.getInstanceCount('tree')}`);
    const stats = this.combatantSystem.getCombatStats();
    console.log(`Combatants - US: ${stats.us}, OPFOR: ${stats.opfor}`);
    console.log(`Chunks loaded: ${this.chunkManager.getLoadedChunkCount()}, Queue: ${this.chunkManager.getQueueSize()}, Loading: ${this.chunkManager.getLoadingCount()}`);
    console.log(`Chunks tracked: ${debugInfo.chunksTracked}`);
  }

  private showWelcomeMessage(): void {
    const debugInfo = this.globalBillboardSystem.getDebugInfo();
    console.log(`
🎮 TERROR IN THE JUNGLE - GAME STARTED!

🌍 World Features:
- ${debugInfo.grassUsed} grass instances allocated
- ${debugInfo.treeUsed} tree instances allocated
- ${this.chunkManager ? this.chunkManager.getLoadedChunkCount() : 0} chunks loaded
- ${this.combatantSystem ? `US: ${this.combatantSystem.getCombatStats().us}, OPFOR: ${this.combatantSystem.getCombatStats().opfor}` : '0'} combatants in battle

🎯 Controls:
- WASD: Move around
- Shift: Run
- Mouse: Look around (click to enable)
- Left Click: Fire
- Right Click: Aim Down Sights
- F1: Performance stats
- Escape: Release mouse lock

Have fun!
    `);
  }

  public start(): void {
    this.animate();
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));

    if (!this.isInitialized || !this.gameStarted) return;

    const deltaTime = this.clock.getDelta();

    // Update all systems
    for (const system of this.systems) {
      system.update(deltaTime);
    }

    // Update skybox position to follow camera
    this.skybox.updatePosition(this.camera.position);

    // Render the main scene
    this.renderer.render(this.scene, this.camera);

    // Render weapon overlay on top
    if (this.firstPersonWeapon) {
      this.firstPersonWeapon.renderWeapon(this.renderer);
    }
  }

  private showSpawnLoadingIndicator(): void {
    // Create loading indicator overlay
    this.spawnLoadingDiv = document.createElement('div');
    this.spawnLoadingDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10003;
      transition: opacity 0.5s ease-out;
    `;

    this.spawnLoadingDiv.innerHTML = `
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .loading-ring {
          width: 60px;
          height: 60px;
          border: 3px solid rgba(74, 124, 78, 0.2);
          border-top: 3px solid #4a7c4e;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .loading-text {
          color: #8fbc8f;
          font-family: 'Courier New', monospace;
          font-size: 18px;
          margin-top: 20px;
          animation: pulse 2s ease-in-out infinite;
        }
        .loading-tip {
          color: #708070;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          margin-top: 10px;
          max-width: 400px;
          text-align: center;
        }
      </style>
      <div class="loading-ring"></div>
      <div class="loading-text">DEPLOYING TO BATTLEFIELD</div>
      <div class="loading-tip">Generating terrain and preparing combat zone...</div>
    `;

    document.body.appendChild(this.spawnLoadingDiv);
  }

  private hideSpawnLoadingIndicator(): void {
    if (this.spawnLoadingDiv) {
      // Fade out
      this.spawnLoadingDiv.style.opacity = '0';
      setTimeout(() => {
        if (this.spawnLoadingDiv && this.spawnLoadingDiv.parentElement) {
          this.spawnLoadingDiv.parentElement.removeChild(this.spawnLoadingDiv);
          this.spawnLoadingDiv = undefined;
        }
      }, 500);
    }
  }

  public dispose(): void {
    // Clean up loading screen
    this.loadingScreen.dispose();

    // Clean up spawn loading indicator if present
    if (this.spawnLoadingDiv && this.spawnLoadingDiv.parentElement) {
      this.spawnLoadingDiv.parentElement.removeChild(this.spawnLoadingDiv);
    }

    // Clean up all systems
    for (const system of this.systems) {
      system.dispose();
    }

    // Clean up Three.js resources
    this.renderer.dispose();
    document.body.removeChild(this.renderer.domElement);

    console.log('🧹 Sandbox disposed');
  }
}

// Initialize and start the sandbox
const sandbox = new PixelArtSandbox();
sandbox.start();

// Global cleanup handler
window.addEventListener('beforeunload', () => {
  sandbox.dispose();
});

// Hot reload support for development
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sandbox.dispose();
  });
}