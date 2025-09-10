import * as THREE from 'three';
import { GameSystem } from '../types';
import { Chunk } from './Chunk';
import { NoiseGenerator } from '../utils/NoiseGenerator';
import { AssetLoader } from './AssetLoader';

export interface ChunkConfig {
  size: number;           // Size of each chunk (64x64 units)
  renderDistance: number; // How many chunks to render around player
  loadDistance: number;   // How many chunks to keep loaded
  lodLevels: number;      // Number of LOD levels (3-4 typical)
}

export class ChunkManager implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private assetLoader: AssetLoader;
  private config: ChunkConfig;
  private noiseGenerator: NoiseGenerator;
  
  // Chunk storage
  private chunks: Map<string, Chunk> = new Map();
  private loadingChunks: Set<string> = new Set();
  
  // Player tracking
  private playerPosition = new THREE.Vector3();
  private lastChunkPosition = new THREE.Vector2();
  
  // Performance tracking
  private updateTimer = 0;
  private readonly UPDATE_INTERVAL = 0.5; // Update every 500ms

  constructor(
    scene: THREE.Scene, 
    camera: THREE.PerspectiveCamera,
    assetLoader: AssetLoader,
    config: ChunkConfig = {
      size: 64,
      renderDistance: 3,  // 3x3 = 9 chunks visible (much better performance)
      loadDistance: 5,    // 5x5 = 25 chunks loaded (reduced memory usage)
      lodLevels: 2
    }
  ) {
    this.scene = scene;
    this.camera = camera;
    this.assetLoader = assetLoader;
    this.config = config;
    this.noiseGenerator = new NoiseGenerator(12345); // Fixed seed for consistency
  }

  async init(): Promise<void> {
    console.log('🗺️ ChunkManager: Initializing open world system...');
    console.log(`Config: ${this.config.renderDistance}x${this.config.renderDistance} render distance, ${this.config.size}x${this.config.size} chunk size`);
    
    // Debug: Check if textures are available
    console.log('🎨 Available textures:', {
      forestfloor: !!this.assetLoader.getTexture('forestfloor'),
      grass: !!this.assetLoader.getTexture('grass'),
      tree: !!this.assetLoader.getTexture('tree'),
      imp: !!this.assetLoader.getTexture('imp')
    });
    
    // Initialize with chunks around origin
    await this.updateChunksAroundPosition(new THREE.Vector3(0, 0, 0));
    
    console.log('✅ ChunkManager: Open world system ready');
  }

  update(deltaTime: number): void {
    this.updateTimer += deltaTime;
    
    if (this.updateTimer >= this.UPDATE_INTERVAL) {
      this.updateTimer = 0;
      
      // Get current player chunk position
      const currentChunkPos = this.worldToChunkCoord(this.playerPosition);
      
      // Only update if player moved to a different chunk
      if (!currentChunkPos.equals(this.lastChunkPosition)) {
        this.updateChunksAroundPosition(this.playerPosition);
        this.lastChunkPosition.copy(currentChunkPos);
      }
      
      // Update existing chunks (LOD, visibility, etc.)
      this.updateExistingChunks();
    }
  }

  dispose(): void {
    // Dispose all chunks
    this.chunks.forEach(chunk => chunk.dispose());
    this.chunks.clear();
    this.loadingChunks.clear();
    
    console.log('🧹 ChunkManager: Disposed');
  }

  updatePlayerPosition(position: THREE.Vector3): void {
    this.playerPosition.copy(position);
  }

  private async updateChunksAroundPosition(worldPos: THREE.Vector3): Promise<void> {
    const centerChunk = this.worldToChunkCoord(worldPos);
    const chunksToLoad: THREE.Vector2[] = [];
    const chunksToUnload: string[] = [];

    // Determine which chunks should be loaded
    for (let x = centerChunk.x - this.config.loadDistance; x <= centerChunk.x + this.config.loadDistance; x++) {
      for (let z = centerChunk.y - this.config.loadDistance; z <= centerChunk.y + this.config.loadDistance; z++) {
        const chunkKey = this.getChunkKey(x, z);
        const distance = Math.max(Math.abs(x - centerChunk.x), Math.abs(z - centerChunk.y));
        
        if (distance <= this.config.loadDistance && !this.chunks.has(chunkKey) && !this.loadingChunks.has(chunkKey)) {
          chunksToLoad.push(new THREE.Vector2(x, z));
        }
      }
    }

    // Determine which chunks should be unloaded
    this.chunks.forEach((chunk, key) => {
      const [x, z] = key.split(',').map(Number);
      const distance = Math.max(Math.abs(x - centerChunk.x), Math.abs(z - centerChunk.y));
      
      if (distance > this.config.loadDistance) {
        chunksToUnload.push(key);
      }
    });

    // Load new chunks
    const loadPromises = chunksToLoad.map(pos => this.loadChunk(pos.x, pos.y));
    await Promise.all(loadPromises);

    // Unload distant chunks
    chunksToUnload.forEach(key => this.unloadChunk(key));

    console.log(`📊 Chunks: ${this.chunks.size} loaded, center: (${centerChunk.x}, ${centerChunk.y}), player at: (${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)}, ${worldPos.z.toFixed(1)})`);
  }

  private async loadChunk(chunkX: number, chunkZ: number): Promise<void> {
    const chunkKey = this.getChunkKey(chunkX, chunkZ);
    
    if (this.chunks.has(chunkKey) || this.loadingChunks.has(chunkKey)) {
      return;
    }

    this.loadingChunks.add(chunkKey);

    try {
      const chunk = new Chunk(
        this.scene,
        this.assetLoader,
        chunkX,
        chunkZ,
        this.config.size,
        this.noiseGenerator
      );

      await chunk.generate();
      this.chunks.set(chunkKey, chunk);
      
      console.log(`✅ Loaded chunk (${chunkX}, ${chunkZ})`);
    } catch (error) {
      console.error(`❌ Failed to load chunk (${chunkX}, ${chunkZ}):`, error);
    } finally {
      this.loadingChunks.delete(chunkKey);
    }
  }

  private unloadChunk(chunkKey: string): void {
    const chunk = this.chunks.get(chunkKey);
    if (chunk) {
      chunk.dispose();
      this.chunks.delete(chunkKey);
      console.log(`🗑️ Unloaded chunk ${chunkKey}`);
    }
  }

  private updateExistingChunks(): void {
    this.chunks.forEach((chunk) => {
      const distance = this.getChunkDistance(chunk.getPosition(), this.playerPosition);
      const lodLevel = this.calculateLOD(distance);
      
      // Update chunk visibility and LOD
      chunk.setVisible(distance <= this.config.renderDistance);
      chunk.setLODLevel(lodLevel);
      
      // Update billboards to face camera
      if (distance <= this.config.renderDistance) {
        chunk.updateBillboards(this.playerPosition);
      }
    });
  }

  private calculateLOD(distance: number): number {
    const normalizedDistance = distance / this.config.renderDistance;
    const lodLevel = Math.floor(normalizedDistance * this.config.lodLevels);
    return Math.min(lodLevel, this.config.lodLevels - 1);
  }

  private getChunkDistance(chunkWorldPos: THREE.Vector3, playerPos: THREE.Vector3): number {
    return Math.max(
      Math.abs(chunkWorldPos.x - playerPos.x) / this.config.size,
      Math.abs(chunkWorldPos.z - playerPos.z) / this.config.size
    );
  }

  private worldToChunkCoord(worldPos: THREE.Vector3): THREE.Vector2 {
    return new THREE.Vector2(
      Math.floor(worldPos.x / this.config.size),
      Math.floor(worldPos.z / this.config.size)
    );
  }

  private getChunkKey(chunkX: number, chunkZ: number): string {
    return `${chunkX},${chunkZ}`;
  }

  // Public accessors
  getLoadedChunkCount(): number {
    return this.chunks.size;
  }

  getChunkAt(worldPos: THREE.Vector3): Chunk | undefined {
    const chunkCoord = this.worldToChunkCoord(worldPos);
    const key = this.getChunkKey(chunkCoord.x, chunkCoord.y);
    return this.chunks.get(key);
  }

  getHeightAt(x: number, z: number): number {
    const chunk = this.getChunkAt(new THREE.Vector3(x, 0, z));
    return chunk ? chunk.getHeightAt(x, z) : 0;
  }
}