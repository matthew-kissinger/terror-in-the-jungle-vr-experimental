# Pix3D Upgrade Log

## Step 0 — Deep Analysis

### System Map
- Core loop: `src/main.ts` constructs systems and updates them each frame via `systems: GameSystem[]`.
- `GameSystem` interface (`src/types/index.ts`): `init()`, `update(dt)`, `dispose()`.
- Systems instantiated and order in `main.ts`:
  1. `AssetLoader`
  2. `GlobalBillboardSystem`
  3. `ImprovedChunkManager`
  4. `WaterSystem`
  5. `PlayerController`
  6. `FirstPersonWeapon`
  7. `EnemySystem`
  8. `Skybox`
- Other legacy/aux:
  - `BillboardSystem` (legacy, GPU billboard shader path still available)
  - `ChunkManager` (earlier version of chunking)
  - `WorldGenerator` (legacy static gen)
  - `Terrain`, `Skybox`, `WaterSystem`

### Update/Dispose Map & Dependencies
- Updates are called from `main.ts` each frame in the order above.
- Dispose fan-out from `PixelArtSandbox.dispose()` iterates all systems then disposes renderer.
- Notable update() responsibilities:
  - `AssetLoader`: no-op per-frame.
  - `GlobalBillboardSystem`: updates billboard rotations only when camera moved beyond threshold; manages global instanced meshes and per-chunk allocations.
  - `ImprovedChunkManager`: interval-driven (250ms) queue-based async loading, visibility/LOD, unload buffer; calls `GlobalBillboardSystem.removeChunkInstances` on unload.
  - `PlayerController`: movement, gravity, pointer lock, informs chunk manager of player position.
  - `FirstPersonWeapon`: overlay sprite idle bob/swing; separate ortho scene; renders after main scene.
  - `EnemySystem`: spawns squads, per-enemy FSM (walking → alert → firing), simple LOS sampling, billboard facing, per-state instanced meshes.
  - `WaterSystem`, `Skybox`, `Terrain`, `WorldGenerator`: lightweight or static.
- Dispose highlights:
  - `GlobalBillboardSystem`: disposes instanced meshes and clears allocation tracking.
  - `ImprovedChunkManager`/`ChunkManager`: dispose chunks; `ImprovedChunk`/`Chunk` dispose geometry/materials and remove instances.
  - `EnemySystem`: disposes per-state instanced meshes/materials.
  - `FirstPersonWeapon`: disposes sprite geometry/material and removes listeners.

### Asset Handling
- `AssetLoader` auto-discovers a fixed list of known assets (PNG/JPG) under `/assets/` and categorizes into `GROUND`, `FOLIAGE`, `ENEMY`, `SKYBOX`, `UNKNOWN`.
- Textures loaded via `THREE.TextureLoader` with pixel-perfect defaults; `PixelPerfectUtils.configureTexture` ensures `NearestFilter`, `RepeatWrapping`, `flipY`, no mipmaps.
- Accessors: `getTexture(name)`, `getAssetsByCategory(category)`, `getAllAssets()`.
- Naming: logical names are filename without extension; e.g., `CoconutPalm` maps to `/assets/CoconutPalm.png`.

### Enemy Logic
- Type: only `soldier` currently. Data per enemy includes position/vel/scale, detection radii, pack info, state.
- States: `walking`, `alert` (prep), `firing`. State textures: `SoliderWalking`, `SoldierAlert`, `SoliderFiring`.
- Spawning: squads of 3–5 via `spawnSoldierSquad`; initial squads placed near origin; periodic spawn check every 2s; despawn distance 120.
- Movement:
  - Walking: leader wanders; followers maintain formation or wander near leader.
  - Alert: moves toward player, 1.5s delay before firing.
  - Firing: strafe + slow advance; transitions based on LOS and range.
- LOS: naive step sampling along ray every 5 units vs. `getTerrainHeight`; O(steps) per enemy per frame when evaluated.
- Rendering: three `InstancedMesh` objects (one per state), updated each frame with matrices facing camera; `frustumCulled=false`.
- Scaling risks:
  - Per-enemy LOS sampling; cost grows with enemies and distance.
  - Per-enemy matrix updates each frame; three meshes but index rebuild every update.
  - No shot simulation yet; no pooled effects; fixed `MAX_ENEMIES=60`.

### Rendering & Perf Notes
- Global vegetation:
  - Single global `InstancedMesh` per vegetation type with very high caps (e.g., ferns 80k, palms 10–15k, canopy 3k, legacy grass 10k, trees 5k).
  - Per-chunk allocations tracked and matrices written when chunks add/remove instances.
  - Rotations updated on camera movement threshold (0.1 world units) and distance-culling (skip >500–800 units).
  - Frustum culling disabled on meshes to avoid popping; relies on distance checks and chunking.
- Chunking:
  - `ImprovedChunkManager` uses priority queue + time-sliced loading (≤2 per frame, 50ms interval), unload buffer, and LOD tiers.
- Player overlay:
  - Separate ortho scene rendered after main; minimal cost.

### Risks & Opportunities
- Risks:
  - Global billboard caps are very high; memory use and instance matrix updates can spike; no hard budgeting.
  - Enemy LOS per frame is naive O(N·steps); will not scale to hundreds.
  - Enemy state render path rebuilds instance matrices each frame; potential CPU hotspot with large counts.
  - Frustum culling disabled on vegetation; relies on distance checks only.
  - `ImprovedChunkManager` uses `setInterval` and `setTimeout` for async loading; coarse timing and potential jitter.
- Opportunities:
  - Introduce texture atlasing and per-type texture arrays to reduce state changes.
  - Adopt `three-mesh-bvh` for fast terrain ray/LOS checks and hitscan.
  - Batch billboard rotation updates with quantized angles and per-chunk throttling.
  - Add LOD tiers for enemies: offscreen aggregation, mid LOD without strafing/rotations.
  - Convert AI/LOS/shot solving into a worker (Comlink) with flat typed-array state.
  - Add a central perf budget (rays/frame, instance writes/frame, chunk ops/frame).

### Suggestions
- Texture atlasing for soldiers and foliage to minimize materials and draw calls.
- Restructure `EnemySystem` into `CombatantSystem` with shared `WeaponSpec`, pooled effects, and BVH-backed LOS/hitscan; add skill modifiers and burst logic.
- Add `ShotQueue` to cap ray tests per frame and defer overflow.
- Introduce AI LOD tiers and update cadences; move to Web Worker with `SharedArrayBuffer`.
- Implement influence grid per chunk for tactical decisions and offscreen attrition.
- Instrument a debug HUD (F1) for FPS, rays/frame, active AI, pool usage, LOD counts.

### Step 0 Cleanup (Legacy Removal)
-
## Step 1 — Player Weapon Rig & Gunfeel

### What changed
- Added `ProgrammaticGunFactory` to build a low-poly rifle from primitives.
- Added `GunplayCore` implementing spread/bloom, deterministic recoil, damage falloff, headshot multiplier, basic penetration hook.
- Added `TracerPool` for pooled hit-scan tracer visuals.
- Upgraded `FirstPersonWeapon`:
  - Switched from sprite to programmatic rifle rig.
  - Added sway and bob; ADS transition (~0.18s) with position lerp.
  - Integrated `GunplayCore` for firing cadence, bloom, recoil offsets.
  - Integrated tracers and hitscan via `EnemySystem.handleHitscan`.
- Extended `EnemySystem` with health, simple ray hit detection, and `applyDamage`.
- Wired `main.ts` to pass `EnemySystem` into `FirstPersonWeapon`.

### Verified
- ADS transition time ≈ 0.18s.
- Damage tuning: 3–5 body shots to kill; 1–2 headshots (headshot multiplier 1.7).
- Movement increases spread; ADS tightens spread; recoil increments each shot.
- Gun model sways/bobs and fires tracers aligned with muzzle.

### Notes/tuning values
- WeaponSpec: `rpm=700`, `baseSpread=0.8°`, `bloom/shot=0.25°`, `recoilV=0.7°`, `recoilH=0.4°`, falloff 20→60m, 34→24 dmg, head 1.7x.
- Tracer lifetime ~60ms; pool size 96.
- Future: use `three-mesh-bvh` for hitscan/penetration; pooled decals for impacts.
- Removed legacy systems and examples to avoid confusion and reduce surface area:
  - Deleted `src/systems/Billboard.ts`, `src/systems/WorldGenerator.ts`, `src/systems/Terrain.ts`, `src/systems/ChunkManager.ts`.
  - Deleted GPU/legacy example code: `src/examples/GPUBillboardExample.ts`, `src/systems/GPUBillboardSystem.ts`, `src/utils/BillboardSystemComparison.ts`.
  - Deleted unused material `src/materials/BillboardShaderMaterial.ts`.
- Refactored `PlayerController` to not depend on `Terrain` or legacy `ChunkManager` types; now only optionally uses `ImprovedChunkManager`.
- Cleaned `src/main.ts` to construct only: `AssetLoader`, `GlobalBillboardSystem`, `ImprovedChunkManager`, `WaterSystem`, `PlayerController`, `FirstPersonWeapon`, `EnemySystem`, `Skybox`.
