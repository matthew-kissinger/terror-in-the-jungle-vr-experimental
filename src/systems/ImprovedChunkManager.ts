import * as THREE from 'three';
import { GameSystem } from '../types';
import { Chunk } from './Chunk';
import { NoiseGenerator } from '../utils/NoiseGenerator';
import { AssetLoader } from './AssetLoader';
import { GlobalBillboardSystem } from './GlobalBillboardSystem';

export interface ChunkConfig {
  size: number;
  renderDistance: number;
  loadDistance: number;
  lodLevels: number;
}

/**
 * Improved ChunkManager with async loading and performance optimizations
 */
export class ImprovedChunkManager implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private assetLoader: AssetLoader;
  private config: ChunkConfig;
  private noiseGenerator: NoiseGenerator;
  private globalBillboardSystem: GlobalBillboardSystem;
  
  // Chunk storage
  private chunks: Map<string, Chunk> = new Map();
  private loadingChunks: Set<string> = new Set();
  private loadQueue: Array<{x: number, z: number, priority: number}> = [];
  
  // Player tracking
  private playerPosition = new THREE.Vector3();
  private lastChunkPosition = new THREE.Vector2();
  
  // Performance settings
  private updateTimer = 0;
  private readonly UPDATE_INTERVAL = 0.25;  // More frequent updates
  private readonly MAX_CHUNKS_PER_FRAME = 2; // Load 2 chunks per frame for faster loading
  private readonly LOAD_DELAY = 50; // Reduced delay for quicker loading
  private lastLoadTime = 0;
  private isLoading = false;

  constructor(
    scene: THREE.Scene, 
    camera: THREE.PerspectiveCamera,
    assetLoader: AssetLoader,
    globalBillboardSystem: GlobalBillboardSystem,
    config: ChunkConfig = {
      size: 64,
      renderDistance: 8,  // Increased render distance to prevent pop-in
      loadDistance: 10,   // Load more chunks to prevent unloading visible areas
      lodLevels: 4        // More LOD levels for gradual quality reduction
    }
  ) {
    this.scene = scene;
    this.camera = camera;
    this.assetLoader = assetLoader;
    this.globalBillboardSystem = globalBillboardSystem;
    this.config = config;
    this.noiseGenerator = new NoiseGenerator(12345);
  }

  async init(): Promise<void> {
    console.log('🗺️ Improved ChunkManager: Initializing...');
    console.log(`Config: ${this.config.renderDistance}x${this.config.renderDistance} render, ${this.config.size}x${this.config.size} chunk size`);
    
    // Start with larger immediate area for better initial view
    const initialChunks = this.getChunksInRadius(new THREE.Vector3(0, 0, 0), 2);
    
    // Load initial chunks synchronously for immediate playability
    for (const {x, z} of initialChunks) {
      await this.loadChunkImmediate(x, z);
    }
    
    console.log('✅ ImprovedChunkManager: Ready with initial chunks');
    
    // Start async loading process
    this.startAsyncLoading();
  }

  update(deltaTime: number): void {
    this.updateTimer += deltaTime;
    
    if (this.updateTimer >= this.UPDATE_INTERVAL) {
      this.updateTimer = 0;
      
      // Check if player moved to different chunk
      const currentChunkPos = this.worldToChunkCoord(this.playerPosition);
      if (!currentChunkPos.equals(this.lastChunkPosition)) {
        this.updateLoadQueue();
        this.lastChunkPosition.copy(currentChunkPos);
      }
      
      // Process load queue gradually
      this.processLoadQueue();
      
      // Update chunk visibility
      this.updateChunkVisibility();
      
      // Clean up distant chunks
      this.unloadDistantChunks();
    }
  }

  dispose(): void {
    this.chunks.forEach(chunk => chunk.dispose());
    this.chunks.clear();
    this.loadingChunks.clear();
    this.loadQueue = [];
    console.log('🧹 ImprovedChunkManager: Disposed');
  }

  updatePlayerPosition(position: THREE.Vector3): void {
    this.playerPosition.copy(position);
  }

  private startAsyncLoading(): void {
    // Start background loading process
    setInterval(() => {
      if (!this.isLoading && this.loadQueue.length > 0) {
        this.processNextInQueue();
      }
    }, this.LOAD_DELAY);
  }

  private updateLoadQueue(): void {
    // Clear existing queue
    this.loadQueue = [];
    
    const centerChunk = this.worldToChunkCoord(this.playerPosition);
    
    // Build priority queue based on distance
    for (let x = centerChunk.x - this.config.loadDistance; x <= centerChunk.x + this.config.loadDistance; x++) {
      for (let z = centerChunk.y - this.config.loadDistance; z <= centerChunk.y + this.config.loadDistance; z++) {
        const chunkKey = this.getChunkKey(x, z);
        
        if (!this.chunks.has(chunkKey) && !this.loadingChunks.has(chunkKey)) {
          const distance = Math.max(Math.abs(x - centerChunk.x), Math.abs(z - centerChunk.y));
          this.loadQueue.push({ x, z, priority: distance });
        }
      }
    }
    
    // Sort by priority (closer chunks first)
    this.loadQueue.sort((a, b) => a.priority - b.priority);
  }

  private async processLoadQueue(): Promise<void> {
    const now = Date.now();
    if (now - this.lastLoadTime < this.LOAD_DELAY) return;
    
    // Process limited chunks per frame
    let processed = 0;
    while (this.loadQueue.length > 0 && processed < this.MAX_CHUNKS_PER_FRAME) {
      const item = this.loadQueue.shift();
      if (item) {
        this.loadChunkAsync(item.x, item.z);
        processed++;
      }
    }
    
    this.lastLoadTime = now;
  }

  private async processNextInQueue(): Promise<void> {
    if (this.isLoading || this.loadQueue.length === 0) return;
    
    const item = this.loadQueue.shift();
    if (item) {
      this.isLoading = true;
      await this.loadChunkAsync(item.x, item.z);
      this.isLoading = false;
    }
  }

  private async loadChunkImmediate(chunkX: number, chunkZ: number): Promise<void> {
    const chunkKey = this.getChunkKey(chunkX, chunkZ);
    
    if (this.chunks.has(chunkKey)) return;
    
    try {
      const chunk = new Chunk(
        this.scene,
        this.assetLoader,
        chunkX,
        chunkZ,
        this.config.size,
        this.noiseGenerator,
        this.globalBillboardSystem
      );

      await chunk.generate();
      this.chunks.set(chunkKey, chunk);
      console.log(`✅ Loaded initial chunk (${chunkX}, ${chunkZ})`);
    } catch (error) {
      console.error(`❌ Failed to load chunk (${chunkX}, ${chunkZ}):`, error);
    }
  }

  private async loadChunkAsync(chunkX: number, chunkZ: number): Promise<void> {
    const chunkKey = this.getChunkKey(chunkX, chunkZ);
    
    if (this.chunks.has(chunkKey) || this.loadingChunks.has(chunkKey)) {
      return;
    }

    this.loadingChunks.add(chunkKey);

    // Use setTimeout to make it truly async and not block
    setTimeout(async () => {
      try {
        const chunk = new Chunk(
          this.scene,
          this.assetLoader,
          chunkX,
          chunkZ,
          this.config.size,
          this.noiseGenerator,
          this.globalBillboardSystem
        );

        await chunk.generate();
        
        // Only add if still needed (player might have moved away)
        const currentDistance = this.getChunkDistanceFromPlayer(chunkX, chunkZ);
        if (currentDistance <= this.config.loadDistance) {
          this.chunks.set(chunkKey, chunk);
          console.log(`📦 Async loaded chunk (${chunkX}, ${chunkZ})`);
        } else {
          chunk.dispose();
          console.log(`🗑️ Disposed unneeded chunk (${chunkX}, ${chunkZ})`);
        }
      } catch (error) {
        console.error(`❌ Failed to load chunk (${chunkX}, ${chunkZ}):`, error);
      } finally {
        this.loadingChunks.delete(chunkKey);
      }
    }, 0);
  }

  private unloadDistantChunks(): void {
    const chunksToUnload: string[] = [];
    
    this.chunks.forEach((chunk, key) => {
      const [x, z] = key.split(',').map(Number);
      const distance = this.getChunkDistanceFromPlayer(x, z);
      
      // Add buffer to prevent unloading visible chunks
      if (distance > this.config.loadDistance + 2) {
        chunksToUnload.push(key);
      }
    });

    chunksToUnload.forEach(key => {
      const chunk = this.chunks.get(key);
      if (chunk) {
        this.globalBillboardSystem.removeChunkInstances(key);
        chunk.dispose();
        this.chunks.delete(key);
        console.log(`🗑️ Unloaded distant chunk ${key}`);
      }
    });
  }

  private updateChunkVisibility(): void {
    this.chunks.forEach((chunk) => {
      const distance = this.getChunkDistance(chunk.getPosition(), this.playerPosition);
      // Keep chunks visible with a buffer to prevent pop-in
      const isVisible = distance <= this.config.renderDistance + 1;
      const lodLevel = this.calculateLOD(distance);
      
      chunk.setVisible(isVisible);
      chunk.setLODLevel(lodLevel);
    });
  }

  private getChunksInRadius(center: THREE.Vector3, radius: number): Array<{x: number, z: number}> {
    const centerChunk = this.worldToChunkCoord(center);
    const chunks: Array<{x: number, z: number}> = [];
    
    for (let x = centerChunk.x - radius; x <= centerChunk.x + radius; x++) {
      for (let z = centerChunk.y - radius; z <= centerChunk.y + radius; z++) {
        chunks.push({x, z});
      }
    }
    
    return chunks;
  }

  private getChunkDistanceFromPlayer(chunkX: number, chunkZ: number): number {
    const playerChunk = this.worldToChunkCoord(this.playerPosition);
    return Math.max(Math.abs(chunkX - playerChunk.x), Math.abs(chunkZ - playerChunk.y));
  }

  private calculateLOD(distance: number): number {
    // More aggressive LOD for better performance
    if (distance <= 1) return 0;      // Full detail for immediate area
    if (distance <= 2) return 1;      // High detail for close chunks
    if (distance <= 4) return 2;      // Medium detail for mid-range
    return 3;                         // Low detail for far chunks
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

  getQueueSize(): number {
    return this.loadQueue.length;
  }

  getLoadingCount(): number {
    return this.loadingChunks.size;
  }
}