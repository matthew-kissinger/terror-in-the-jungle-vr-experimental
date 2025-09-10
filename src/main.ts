import * as THREE from 'three';
import './style.css';

// Import our game systems
import { AssetLoader } from './systems/AssetLoader';
import { Terrain } from './systems/Terrain';
import { BillboardSystem } from './systems/Billboard';
import { WorldGenerator } from './systems/WorldGenerator';
import { PlayerController } from './systems/PlayerController';
import { EnemyAI } from './systems/EnemyAI';
import { Skybox } from './systems/Skybox';
import { ChunkManager } from './systems/ChunkManager';
import { GlobalBillboardSystem } from './systems/GlobalBillboardSystem';
import { PixelPerfectUtils } from './utils/PixelPerfect';
import { GameSystem } from './types';

class PixelArtSandbox {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private systems: GameSystem[] = [];
  
  // Game systems
  private assetLoader!: AssetLoader;
  private terrain!: Terrain;
  private chunkManager!: ChunkManager;
  private billboardSystem!: BillboardSystem;
  private globalBillboardSystem!: GlobalBillboardSystem;
  private worldGenerator!: WorldGenerator;
  private playerController!: PlayerController;
  private enemyAI!: EnemyAI;
  private skybox!: Skybox;

  // Game state
  private clock = new THREE.Clock();
  private isInitialized = false;

  constructor() {
    console.log('🎮 Initializing Pixel Art Sandbox Engine...');
    console.log('Three.js version:', THREE.REVISION);

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

  private async initializeSystems(): Promise<void> {
    try {
      console.log('🔧 Initializing game systems...');

      // Initialize core systems with global billboard system
      this.assetLoader = new AssetLoader();
      this.globalBillboardSystem = new GlobalBillboardSystem(this.scene, this.camera, this.assetLoader);
      this.chunkManager = new ChunkManager(this.scene, this.camera, this.assetLoader, this.globalBillboardSystem);
      
      // Keep original systems for fallback compatibility
      this.terrain = new Terrain(this.scene);
      this.billboardSystem = new BillboardSystem(this.scene, this.camera);
      this.worldGenerator = new WorldGenerator(this.billboardSystem, this.terrain);
      this.playerController = new PlayerController(this.camera, this.terrain);
      this.enemyAI = new EnemyAI(this.billboardSystem, this.terrain);
      this.skybox = new Skybox(this.scene);
      
      // Connect player controller with chunk manager
      this.playerController.setChunkManager(this.chunkManager);

      // Add systems to update list - NEW ORDER WITH GLOBAL BILLBOARD SYSTEM
      this.systems = [
        this.assetLoader,
        this.globalBillboardSystem,
        this.chunkManager,
        this.playerController,
        this.skybox
      ];

      // Initialize all systems
      for (const system of this.systems) {
        await system.init();
      }

      console.log('🎯 Systems initialized, loading assets...');
      await this.loadGameAssets();

      // Create skybox for the world
      const skyboxTexture = this.assetLoader.getTexture('skybox');
      if (skyboxTexture) {
        this.skybox.createSkybox(skyboxTexture);
        console.log('☁️ Skybox created');
      }

      // Skip old world building - chunks will generate dynamically
      console.log('🌍 World system ready for dynamic chunk loading...');

      this.isInitialized = true;
      console.log('🚀 Pixel Art Sandbox ready!');
      this.showWelcomeMessage();

    } catch (error) {
      console.error('❌ Failed to initialize sandbox:', error);
    }
  }

  private async loadGameAssets(): Promise<void> {
    // Assets are automatically discovered by AssetLoader
    const forestTexture = this.assetLoader.getTexture('forestfloor');
    const grassTexture = this.assetLoader.getTexture('grass');
    const treeTexture = this.assetLoader.getTexture('tree');
    const impTexture = this.assetLoader.getTexture('imp');
    const skyboxTexture = this.assetLoader.getTexture('skybox');

    if (!forestTexture || !grassTexture || !treeTexture || !impTexture || !skyboxTexture) {
      throw new Error('Failed to load required textures');
    }

    console.log('📦 All assets loaded successfully');
  }

  private async buildWorld(): Promise<void> {
    // BACK TO ORIGINAL WORKING WORLD GENERATION
    console.log('🌍 Building world...');
    
    // Create terrain
    const forestTexture = this.assetLoader.getTexture('forestfloor')!;
    this.terrain.createTerrain(forestTexture);

    // Generate world vegetation
    const grassTexture = this.assetLoader.getTexture('grass')!;
    const treeTexture = this.assetLoader.getTexture('tree')!;
    this.worldGenerator.generateWorld(grassTexture, treeTexture);

    // Spawn enemies
    const impTexture = this.assetLoader.getTexture('imp')!;
    const attackerTexture = this.assetLoader.getTexture('attacker')!;
    const enemySpawns = this.worldGenerator.generateEnemySpawns();
    this.enemyAI.initializeEnemies(impTexture, attackerTexture, enemySpawns);

    // Create skybox
    const skyboxTexture = this.assetLoader.getTexture('skybox')!;
    this.skybox.createSkybox(skyboxTexture);

    console.log('🌲 Original world generation complete');
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private togglePerformanceStats(): void {
    const debugInfo = this.globalBillboardSystem.getDebugInfo();
    console.log('📊 Performance Stats:');
    console.log(`FPS: ${Math.round(1 / this.clock.getDelta())}`);
    console.log(`Draw calls: ${this.renderer.info.render.calls}`);
    console.log(`Triangles: ${this.renderer.info.render.triangles}`);
    console.log(`Grass instances: ${debugInfo.grassUsed}/${this.globalBillboardSystem.getInstanceCount('grass')}`);
    console.log(`Tree instances: ${debugInfo.treeUsed}/${this.globalBillboardSystem.getInstanceCount('tree')}`);
    console.log(`Chunks loaded: ${this.chunkManager.getLoadedChunkCount()}`);
    console.log(`Chunks tracked: ${debugInfo.chunksTracked}`);
  }

  private showWelcomeMessage(): void {
    const debugInfo = this.globalBillboardSystem.getDebugInfo();
    console.log(`
🎮 PIXEL ART SANDBOX ENGINE READY!

🌍 World Features:
- ${debugInfo.grassUsed} grass instances allocated
- ${debugInfo.treeUsed} tree instances allocated
- ${debugInfo.chunksTracked} chunks tracked
- Global billboard system with centralized camera tracking
- Dynamic chunk loading system
- Equirectangular skybox

🎯 Controls:
- WASD: Move around
- Shift: Run
- Mouse: Look around (click to enable)
- F1: Performance stats
- Escape: Release mouse lock

🔧 Developer Features:
- Auto-asset discovery from /assets/
- Pixel-perfect rendering
- Global billboard system (100K+ instances)
- Dynamic chunk loading/unloading
- Centralized camera tracking
- Modular architecture

Drop new PNG files in public/assets/ and they'll be auto-discovered!
    `);
  }

  public start(): void {
    this.animate();
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));

    if (!this.isInitialized) return;

    const deltaTime = this.clock.getDelta();

    // Update all systems
    for (const system of this.systems) {
      system.update(deltaTime);
    }

    // Update skybox position to follow camera
    this.skybox.updatePosition(this.camera.position);

    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
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