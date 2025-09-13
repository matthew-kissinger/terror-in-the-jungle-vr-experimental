# Pix3D Architecture Documentation

## Overview

Pix3D is a modular 3D pixel art game engine built on Three.js. It uses a component-based architecture with clear separation of concerns, enabling efficient rendering of large open worlds with thousands of dynamic entities.

## Core Architecture Principles

1. **GameSystem Interface**: All major systems implement a common interface for lifecycle management
2. **Centralized Asset Management**: Single source of truth for all game assets
3. **GPU-First Rendering**: Heavy use of instanced meshes and GPU computations
4. **Chunk-Based World**: Dynamic loading/unloading based on player position
5. **Billboard Sprites**: 2D sprites in 3D space that always face the camera

## System Hierarchy

```
main.ts (Entry Point)
├── AssetLoader (Asset Discovery & Management)
├── GlobalBillboardSystem (Centralized Billboard Rendering)
│   └── Uses: AssetLoader
├── ImprovedChunkManager (World Chunking System)
│   ├── Uses: GlobalBillboardSystem, AssetLoader
│   └── Creates: ImprovedChunk instances
├── PlayerController (First-Person Controls)
│   └── Uses: ChunkManager for terrain collision
├── EnemySystem (AI & Enemy Management)
│   └── Uses: GlobalBillboardSystem, ChunkManager
├── WaterSystem (Water Rendering)
│   └── Uses: AssetLoader
├── Skybox (Environment Rendering)
└── FirstPersonWeapon (Weapon Overlay)
    └── Uses: AssetLoader, PlayerController
```

## Key Systems

### AssetLoader (`src/systems/AssetLoader.ts`)
**Purpose**: Automatically discovers and categorizes assets from the filesystem

**Key Methods**:
- `discoverAssets()`: Scans `/assets/` directory for PNG files
- `categorizeAsset()`: Determines asset type based on filename patterns
- `getTexture(name)`: Retrieves loaded textures by name
- `getAssetsByCategory()`: Gets all assets of a specific type

**Asset Categories**:
- `GROUND`: Floor/ground textures
- `FOLIAGE`: Vegetation sprites (trees, grass, plants)
- `ENEMY`: Enemy sprites  
- `SKYBOX`: Environment backgrounds
- `UNKNOWN`: Uncategorized assets

### GlobalBillboardSystem (`src/systems/GlobalBillboardSystem.ts`)
**Purpose**: Manages all billboard sprites globally using GPU instancing

**Key Features**:
- Handles 100,000+ instances efficiently
- Centralized camera tracking
- Per-chunk instance allocation
- Multiple vegetation types (ferns, palms, trees)

**Key Methods**:
- `allocateInstances(type, chunk, count)`: Reserve instances for a chunk
- `updateInstances(type, chunk, instances)`: Update billboard positions
- `freeInstances(type, chunk)`: Release instances when chunk unloads
- `setInstanceVisibility()`: Control rendering per instance

**Instance Types**:
- `fern`: Dense ground cover (80,000 max)
- `elephantEar`: Ground plants (15,000 max)
- `fanPalm`: Mid-level vegetation (10,000 max)
- `coconut`: Water-edge palms (8,000 max)
- `areca`: Common mid-size plants (15,000 max)
- `dipterocarp`: Giant canopy trees (3,000 max)
- `banyan`: Giant twisted trees (3,000 max)

### ImprovedChunkManager (`src/systems/ImprovedChunkManager.ts`)
**Purpose**: Manages dynamic world loading/unloading

**Configuration**:
```typescript
{
  size: 64,           // World units per chunk
  renderDistance: 8,  // Chunks to render
  loadDistance: 10,   // Chunks to keep loaded
  lodLevels: 4        // Level of detail levels
}
```

**Key Methods**:
- `updateLoadQueue()`: Prioritizes chunks to load
- `loadChunk(x, z)`: Asynchronously loads a chunk
- `unloadChunk(key)`: Frees chunk resources
- `getHeightAtPosition()`: Terrain height queries
- `worldToChunkCoord()`: Coordinate conversion

### ImprovedChunk (`src/systems/ImprovedChunk.ts`)
**Purpose**: Individual chunk of the game world

**Components**:
- Terrain mesh with height map
- Vegetation instances (via GlobalBillboardSystem)
- Water planes
- LOD management

**Generation Pipeline**:
1. Generate height map using noise
2. Create terrain geometry
3. Place vegetation based on height/slope
4. Add water at sea level
5. Register with GlobalBillboardSystem

### PlayerController (`src/systems/PlayerController.ts`)
**Purpose**: First-person movement and physics

**Features**:
- WASD movement
- Sprint with Shift
- Jump with Space
- Mouse look (pointer lock)
- Terrain collision
- Gravity and physics

**Key Properties**:
- `speed`: Normal movement speed (12 units/s)
- `runSpeed`: Sprint speed (24 units/s)
- `jumpForce`: Jump strength
- `gravity`: Fall acceleration

### EnemySystem (`src/systems/EnemySystem.ts`)
**Purpose**: Enemy AI and behavior management

**Enemy Types**:
- `soldier`: Military units with squad behavior

**AI States**:
- `walking`: Patrol behavior
- `alert`: Player detected, moving to intercept
- `firing`: In range, attacking player

**Features**:
- Squad formations (leader/follower)
- Dynamic spawning around player
- Line-of-sight detection
- State-based textures

### WaterSystem (`src/systems/WaterSystem.ts`)
**Purpose**: Animated water rendering

**Features**:
- Shader-based animation
- Reflection/refraction effects
- Per-chunk water planes
- Sea level configuration

### FirstPersonWeapon (`src/systems/FirstPersonWeapon.ts`)
**Purpose**: Weapon overlay rendering

**Features**:
- Separate render pass for weapon
- Follows camera movement
- Pixel-perfect sprite rendering
- No depth interference with world

## Data Flow

### Frame Update Cycle
1. **Input Processing**: PlayerController handles keyboard/mouse
2. **Player Update**: Position, physics, chunk position
3. **Chunk Management**: Load/unload chunks based on player
4. **Enemy Updates**: AI decisions, movement, spawning
5. **Billboard Updates**: Face camera, update positions
6. **Rendering**: Main scene, then weapon overlay

### Asset Loading Pipeline
1. **Discovery**: AssetLoader scans `/assets/` on init
2. **Categorization**: Files sorted by naming patterns
3. **Loading**: Three.js textures created with pixel filtering
4. **Distribution**: Systems request textures by name

### Chunk Loading Pipeline
1. **Priority Calculation**: Distance from player
2. **Async Generation**: Height map, terrain, vegetation
3. **Billboard Allocation**: Request instances from GlobalBillboardSystem
4. **Activation**: Add to scene, enable collisions
5. **Cleanup**: Unload distant chunks, free resources

## Performance Optimizations

### Instanced Rendering
- All vegetation uses `THREE.InstancedMesh`
- Single draw call per vegetation type
- GPU-based billboard rotation

### Chunk-Based Culling
- Only process entities in nearby chunks
- Frustum culling per chunk
- LOD system for distant chunks

### Memory Management
- Instance pooling in GlobalBillboardSystem
- Texture atlas consideration
- Chunk recycling

### Update Throttling
- Chunk updates: 250ms intervals
- Enemy spawning: 2s intervals
- Billboard updates: Every frame (camera-dependent)

## File Structure Reference

### Core Systems (`/src/systems/`)
- `AssetLoader.ts`: Asset management
- `GlobalBillboardSystem.ts`: Billboard rendering
- `ImprovedChunkManager.ts`: World chunking
- `ImprovedChunk.ts`: Individual chunks
- `PlayerController.ts`: Player movement
- `EnemySystem.ts`: Enemy AI
- `WaterSystem.ts`: Water rendering
- `Skybox.ts`: Sky rendering
- `FirstPersonWeapon.ts`: Weapon overlay

### Utilities (`/src/utils/`)
- `NoiseGenerator.ts`: Perlin noise for terrain
- `PixelPerfect.ts`: Pixel art rendering setup
- `Math.ts`: Math helper functions

### Types (`/src/types/`)
- `index.ts`: All TypeScript interfaces

### Materials (`/src/materials/`)
- `BillboardShaderMaterial.ts`: GPU billboard shader

## Adding New Features

### New Enemy Type
1. Add textures to `/public/assets/` with naming pattern
2. Update `EnemySystem` with new type enum
3. Add behavior logic in `updateEnemyAI()`
4. Register textures in enemy initialization

### New Vegetation Type
1. Add texture to `/public/assets/`
2. Update `GlobalBillboardSystem` with new instance mesh
3. Add to chunk generation in `ImprovedChunk`
4. Configure max instances and sizing

### New Game System
1. Create class implementing `GameSystem` interface
2. Add initialization in `main.ts`
3. Register in update loop
4. Handle cleanup in `dispose()`

## Common Patterns

### System Communication
- Systems receive references during construction
- Use getter methods for runtime queries
- Events through direct method calls (no event bus)

### Resource Management
- Always implement `dispose()` method
- Clean up Three.js objects explicitly
- Remove from scene before disposing

### Coordinate Systems
- World space: Global 3D coordinates
- Chunk space: Relative to chunk origin
- Screen space: 2D viewport coordinates

## Debugging

### Performance Monitoring
- Press F1 for performance stats
- Check `renderer.info` for draw calls
- Monitor `GlobalBillboardSystem.getDebugInfo()`

### Common Issues
- **Chunks not loading**: Check player position updates
- **Low FPS**: Reduce instance counts or render distance
- **Missing textures**: Verify asset naming patterns
- **Enemies not spawning**: Check spawn radius and max count

## Future Considerations

### Planned Improvements
- Texture atlasing for reduced draw calls
- Occlusion culling for chunks
- Advanced LOD with mesh decimation
- Multiplayer networking layer
- Save/load system

### Scalability
- Current limit: ~200,000 total instances
- Chunk size vs. render distance tradeoff
- Memory usage scales with loaded chunks
- GPU memory primarily from instanced meshes