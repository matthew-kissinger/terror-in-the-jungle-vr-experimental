# Helicopter Implementation - Iterative Development Plan

This document outlines a step-by-step approach to implement helicopters directly into the main game, with each step being fully testable before proceeding.

## Current Status: Step 2 Complete ✅ (With Improvements)
- **Step 1: HelipadSystem** ✅ Complete - Functional helipad with collision detection
- **Step 2: HelicopterModel** ✅ Complete - Refined UH-1 Huey design with authentic geometry

### Step 1 Achievements ✅
- **HelipadSystem created** and integrated into the main game
- **Helipad positioned** at US Main HQ in Open Frontier mode (40, 0, -1400)
- **Collision detection** - players can stand on helipad platform
- **Terrain-aware positioning** - helipad sits 0.8 units above max terrain height
- **Vegetation clearing** - active removal of existing vegetation + exclusion zones
- **Solid materials** - all helipad components are fully opaque
- **12m radius platform** with white 'H' marking and green perimeter lights

### Step 2 Achievements ✅ (Refined Design)
- **Authentic UH-1 Huey design** - Proper proportions with larger cabin than cockpit
- **Hollow cabin structure** - Large door openings for troop access, see-through effect
- **Refined cockpit design** - Simple rounded nose with large front windscreen and lower panel
- **Proper tail rotor** - 2-blade vertical configuration mounted sideways (not fan-like)
- **Detailed miniguns** - Door-mounted M60s with barrels, bipods, ammo belts, pintle mounts
- **Animation-ready rotors** - Both main and tail rotors organized for easy animation rigging
- **Collision detection** - Players cannot walk through helicopter
- **Military authenticity** - Vietnam-era olive drab colors, US Army star markings
- **Robust loading** - Fixed race conditions with terrain chunk validation
- **Ready for Step 3** - Helicopter positioned on helipad with collision, ready for interaction

## Adding More Features
To add new helicopter features, follow this pattern:

1. **Create the system file** in `src/systems/helicopter/`
2. **Add to SandboxSystemManager.ts**:
   ```typescript
   import { NewSystem } from '../systems/helicopter/NewSystem';
   public newSystem!: NewSystem;
   this.newSystem = new NewSystem(scene);
   this.systems.push(this.newSystem);
   ```
3. **Connect dependencies** in `connectSystems()` method
4. **Test thoroughly** before moving to next feature

## Development Philosophy
- **One feature at a time** - Each step must be complete and testable
- **Direct integration** - No separate test environments, build directly in main game
- **Immediate feedback** - Player can test each addition as it's implemented
- **Incremental complexity** - Start simple, add complexity gradually

## Step-by-Step Implementation

### Step 1: Basic Helipad Placement ✅ COMPLETE
**Goal**: Add a simple helipad near US HQ spawn that players can see and walk on
**Status**: ✅ COMPLETE - All test criteria met
**Files modified**:
- `src/systems/helicopter/HelipadSystem.ts` - Complete helipad system
- `src/core/SandboxSystemManager.ts` - Integration with game systems
- `src/systems/world/billboard/GlobalBillboardSystem.ts` - Vegetation exclusion zones
- `src/systems/world/billboard/GPUBillboardSystem.ts` - Active vegetation clearing
**Features implemented**:
- Terrain-aware height positioning (samples terrain in 12m radius)
- Vegetation clearing system (removes existing + prevents new)
- Military-grade helipad design with H marking and perimeter lights
- Proper material handling (solid, non-transparent)
- Automatic creation when terrain chunks load
- Vietnam-era aesthetic preparation for Huey helicopter
**Test criteria**: ✅ All passed
- ✅ Helipad appears at correct location (40, 0, -1400)
- ✅ Player can walk on it (0.8 units above terrain)
- ✅ Professional visual appearance with H marking
- ✅ No vegetation interference

### Step 2: Basic Helicopter Model
**Goal**: Add a static UH-1 "Huey" helicopter model sitting on the helipad
**Design Philosophy**: Simple but elegant - iconic Vietnam-era Huey silhouette using programmatic geometry
**Testable**: Player can see helicopter on helipad and walk around it
**Visual Target**: Recognizable UH-1 Huey profile with:
- Long fuselage with slight upward curve at tail
- Distinctive bubble cockpit windows
- Main rotor (large diameter, Vietnam-era style)
- Tail rotor (vertical, on left side of tail boom)
- Skid landing gear (two parallel skids)
- Olive drab military colors with subtle US Army markings
**Files to add/modify**:
- Create `HelicopterModel.ts` in `src/systems/helicopter/`
- Programmatic geometry using THREE.js primitives (boxes, cylinders, spheres)
- Position helicopter centered on helipad
- Military color scheme (olive drab primary, dark accents)
**Test criteria**:
- ✅ Helicopter appears on helipad center
- ✅ Player can walk around helicopter and recognize Huey silhouette
- ✅ Iconic Vietnam-era military aesthetic
- ✅ Proper scale (fits well on 12m helipad)

### Step 3: Helicopter Entry Detection
**Goal**: Show interaction prompt when player is near helicopter
**Testable**: "Press E to enter helicopter" appears when close to helicopter
**Files to modify**:
- Add collision detection for player proximity to helicopter
- Add UI prompt system for helicopter entry
- No actual entry yet, just the prompt
**Test criteria**:
- Prompt appears when player is near helicopter
- Prompt disappears when player moves away
- Prompt looks good and is readable

### Step 4: Basic Entry/Exit System
**Goal**: Player can press E to enter helicopter (teleport inside)
**Testable**: Player disappears when entering, reappears when exiting
**Files to modify**:
- Handle E key press when near helicopter
- Move player to helicopter position (basic teleport)
- Add exit mechanism (E key again or ESC)
- Basic state management (in helicopter vs on foot)
**Test criteria**:
- Player can enter helicopter with E key
- Player can exit helicopter
- Player position changes appropriately
- No crashes or weird behavior

### Step 5: Basic Helicopter Camera
**Goal**: When in helicopter, camera switches to third-person view behind helicopter
**Testable**: Camera follows helicopter properly when entered
**Files to modify**:
- Add helicopter camera mode to camera system
- Position camera behind and above helicopter
- Switch camera when entering/exiting helicopter
**Test criteria**:
- Camera switches to helicopter view when entering
- Camera returns to first-person when exiting
- Camera position looks reasonable
- No jarring transitions

### Step 6: Basic Helicopter Movement
**Goal**: Simple WASD movement for helicopter (slide around on ground like a car)
**Testable**: Player can move helicopter around on the ground with keyboard
**Files to modify**:
- Add basic helicopter movement controls
- WASD to move helicopter horizontally
- Very simple physics (just translate position)
- Camera follows helicopter movement
**Test criteria**:
- WASD moves helicopter around
- Movement feels responsive
- Camera follows smoothly
- Helicopter doesn't fall through terrain

### Step 7: Add Vertical Movement
**Goal**: Space/Shift to move helicopter up and down
**Testable**: Helicopter can hover and land
**Files to modify**:
- Add vertical movement controls
- Space for up, Shift for down
- Simple altitude control
**Test criteria**:
- Space lifts helicopter up
- Shift lowers helicopter down
- Helicopter can hover at any altitude
- Helicopter respects terrain collision

### Step 8: Basic Flight Physics
**Goal**: Add momentum and more realistic movement
**Testable**: Helicopter feels more like flying, less like sliding
**Files to modify**:
- Add velocity and acceleration
- Smooth movement with momentum
- Basic gravity when not powered
**Test criteria**:
- Movement has momentum and feels smooth
- Helicopter gradually accelerates/decelerates
- Gravity affects helicopter when not powered up

### Step 9: Rotor Animation
**Goal**: Add spinning rotor blades to helicopter
**Testable**: Rotors spin when helicopter is powered
**Files to modify**:
- Add rotor geometry to helicopter model
- Animate rotor rotation
- Different speeds for main rotor vs tail rotor
**Test criteria**:
- Main rotor spins horizontally
- Tail rotor spins vertically
- Animation is smooth and realistic
- Rotors stop when helicopter is off

### Step 10: Enhanced Controls & Polish
**Goal**: Better flight controls and visual improvements
**Testable**: Helicopter feels good to fly
**Files to modify**:
- Improve control responsiveness
- Add banking/tilting animations
- Better physics tuning
- Sound effects (optional)
**Test criteria**:
- Controls feel intuitive and responsive
- Flight physics feel realistic but fun
- Visual animations enhance the experience

## Key Implementation Notes

### Technical Achievements from Step 1
- **Vegetation System Integration**: Successfully added exclusion zones to GPU billboard system
- **Active Vegetation Clearing**: Implemented real-time removal of existing vegetation instances
- **Terrain Sampling**: Advanced height detection across entire helipad area (not just center point)
- **System Architecture**: Clean integration following existing patterns in SandboxSystemManager
- **Material Property Handling**: Proper Three.js material configuration for solid appearance

### Recent Technical Improvements (Step 2 Refinements)
- **Race Condition Fixes**: Replaced non-existent `isChunkLoaded()` with proper `getChunkAt()` validation
- **Robust Terrain Loading**: Both systems now wait for valid terrain chunks before creating objects
- **Cockpit Redesign**: Simplified from complex multi-sphere design to clean geometric approach
- **Authentic Tail Rotor**: Changed from 4-blade fan to proper 2-blade vertical Huey configuration
- **TypeScript Compliance**: Fixed all compilation errors and improved type safety
- **Glass Orientation**: Corrected window positioning for proper outward-facing visibility

### Design Guidelines for Step 2 (Huey Helicopter)
- **Authenticity**: UH-1 "Huey" proportions and iconic Vietnam-era silhouette
- **Simplicity**: Elegant programmatic geometry using THREE.js primitives
- **Military Aesthetic**: Olive drab colors, weathered look, subtle US Army markings
- **Recognizability**: Even with simple geometry, should be unmistakably a Huey
- **Scale**: Proper helicopter-to-helipad proportions (realistic military size)

### Integration Points
- **Player System**: Handle transition between ground and helicopter modes
- **Camera System**: Switch between FPS and helicopter cameras
- **Input System**: Route controls to helicopter when in helicopter mode
- **Terrain System**: Use existing terrain collision for helicopter physics
- **UI System**: Add helicopter interaction prompts

### Testing Strategy
After each step:
1. `npm run dev` to start the game
2. Navigate to US HQ area
3. Test the new feature thoroughly
4. Verify no existing functionality is broken
5. Only proceed to next step when current step works perfectly

### Success Criteria for Each Step
- Feature works as intended
- No crashes or errors
- No impact on existing game functionality
- Smooth transitions between modes
- Intuitive user experience

The goal is to have a working, testable helicopter system that integrates seamlessly with the existing game, built incrementally with full testing at each stage.