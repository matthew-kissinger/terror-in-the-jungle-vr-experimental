# Pix3D - Open World Pixel Art Game Engine

A high-performance 3D pixel art open-world game engine built with Three.js, featuring dynamic chunk loading, GPU-accelerated billboarding, and a tropical jungle environment.

## Features

### Core Engine
- **Dynamic Chunk System**: Infinite world generation with seamless chunk loading/unloading
- **GPU-Accelerated Billboards**: Render 100,000+ vegetation instances efficiently
- **Pixel-Perfect Rendering**: Crisp pixel art aesthetics in 3D space
- **Global Billboard Management**: Centralized system for all billboard sprites

### Game Systems
- **First-Person Controller**: Smooth movement with run, jump, and mouse-look
- **Enemy AI System**: Soldier enemies with squad behavior and multiple states (patrol, alert, firing)
- **Procedural World Generation**: Noise-based terrain with jungle biome
- **Water System**: Animated water planes with realistic shaders
- **Skybox System**: Equirectangular panoramic backgrounds
- **First-Person Weapon**: Overlay weapon system with pixel art sprites

### Technical Features
- **Asset Auto-Discovery**: Drop PNG files in `public/assets/` and they're automatically loaded
- **TypeScript**: Full type safety and modern JavaScript features
- **Vite Build System**: Fast HMR and optimized production builds
- **Modular Architecture**: Clean separation of concerns with GameSystem interface

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
Open http://localhost:5173 in your browser

### Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Controls

- **WASD**: Move around
- **Shift**: Run
- **Space**: Jump
- **Mouse**: Look around (click to enable pointer lock)
- **Escape**: Release pointer lock
- **F1**: Toggle performance stats

## Project Structure

```
pix3d/
├── public/
│   └── assets/           # Game assets (auto-discovered)
│       ├── *.png        # Textures and sprites
│       └── archived/    # Unused assets
├── src/
│   ├── main.ts          # Entry point and game initialization
│   ├── systems/         # Core game systems
│   │   ├── AssetLoader.ts         # Automatic asset discovery
│   │   ├── GlobalBillboardSystem.ts # GPU billboarding
│   │   ├── ImprovedChunkManager.ts  # Dynamic world chunks
│   │   ├── PlayerController.ts      # First-person controls
│   │   ├── EnemySystem.ts          # Enemy AI
│   │   ├── WaterSystem.ts          # Water rendering
│   │   ├── Skybox.ts               # Panoramic backgrounds
│   │   ├── FirstPersonWeapon.ts    # Weapon overlay
│   │   └── ...
│   ├── types/           # TypeScript interfaces
│   ├── utils/           # Utility functions
│   └── materials/       # Custom shaders
├── package.json
└── tsconfig.json
```

## Asset Pipeline

### Adding New Assets
1. Drop PNG files into `public/assets/`
2. AssetLoader automatically categorizes them:
   - Ground textures: `*floor*`, `*ground*`
   - Foliage: `*grass*`, `*tree*`, `*palm*`, `*fern*`, etc.
   - Enemies: `*zombie*`, `*soldier*`, `*enemy*`, etc.
   - Skybox: `*sky*`, `*skybox*`
3. Assets are available immediately on next run

### Texture Compression (Optional)
```bash
npm run compress-textures
```

## Performance

The engine is optimized for rendering large open worlds:
- **100,000+ billboard instances** with minimal draw calls
- **Dynamic LOD system** for distant chunks
- **Frustum culling** for off-screen objects
- **Instanced rendering** for vegetation and enemies
- **Chunk-based occlusion** to limit active entities

### Performance Tips
- Adjust render distance in `ImprovedChunkManager` config
- Modify max instances in `GlobalBillboardSystem` 
- Enable/disable shadows for performance vs quality
- Use texture atlases for similar sprites

## Development

### Adding a New System
1. Implement the `GameSystem` interface:
```typescript
export class MySystem implements GameSystem {
  async init(): Promise<void> { }
  update(deltaTime: number): void { }
  dispose(): void { }
}
```
2. Add to `main.ts` initialization
3. Register in the systems update loop

### Modifying World Generation
Edit `ImprovedChunk.ts` to change:
- Terrain height generation
- Vegetation density and distribution
- Biome characteristics

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed technical documentation.

## License

MIT

## Credits

Built with:
- [Three.js](https://threejs.org/) - 3D graphics library
- [Vite](https://vitejs.dev/) - Build tool
- TypeScript - Type safety