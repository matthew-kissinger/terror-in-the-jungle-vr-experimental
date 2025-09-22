# VR/Desktop Cross-Platform Migration Guide

## Overview
This guide explains how to integrate the new professional-grade VR/Desktop cross-platform systems into your existing codebase.

## New Architecture

### 1. CameraRig System (`src/systems/camera/CameraRig.ts`)
- **Purpose**: Manages camera positioning for both VR and desktop modes
- **Key Feature**: Uses "dolly" pattern - camera goes in a group that we move for locomotion
- **Why**: WebXR directly controls camera's world matrix, so we can't move the camera itself in VR

### 2. InputManager System (`src/systems/input/InputManager.ts`)
- **Purpose**: Abstracts input between VR controllers and keyboard/mouse
- **Key Feature**: Unified `InputState` interface for all input sources
- **Why**: Same game logic works for both VR and desktop

### 3. VRSystem (`src/systems/vr/VRSystem.ts`)
- **Purpose**: Modern WebXR implementation with proper patterns
- **Key Features**:
  - Teleportation
  - Smooth locomotion
  - Proper reference space management
  - Controller handling

### 4. ModernPlayerController (`src/systems/player/ModernPlayerController.ts`)
- **Purpose**: Unified player controller that works with both input modes
- **Key Feature**: Uses CameraRig and InputManager for cross-platform compatibility

## Integration Steps

### Step 1: Update SandboxSystemManager

```typescript
// In src/core/SandboxSystemManager.ts

import { CameraRig } from '../systems/camera/CameraRig';
import { InputManager } from '../systems/input/InputManager';
import { VRSystem } from '../systems/vr/VRSystem';
import { ModernPlayerController } from '../systems/player/ModernPlayerController';

export class SandboxSystemManager {
  // Add new systems
  public cameraRig: CameraRig;
  public inputManager: InputManager;
  public vrSystem: VRSystem;
  public modernPlayerController: ModernPlayerController;

  async initializeSystems() {
    // Create camera rig
    this.cameraRig = new CameraRig(this.scene, this.camera);

    // Create input manager
    this.inputManager = new InputManager(this.renderer);

    // Create VR system
    this.vrSystem = new VRSystem(
      this.scene,
      this.renderer,
      this.cameraRig,
      this.inputManager
    );

    // Create modern player controller
    this.modernPlayerController = new ModernPlayerController(
      this.scene,
      this.cameraRig,
      this.inputManager,
      this.vrSystem
    );

    // Set references
    this.modernPlayerController.setChunkManager(this.chunkManager);

    // Initialize systems
    await this.vrSystem.init();
    await this.modernPlayerController.init();
  }

  update(deltaTime: number) {
    // Update new systems
    this.inputManager.update(deltaTime);
    this.vrSystem.update(deltaTime);
    this.modernPlayerController.update(deltaTime);
  }
}
```

### Step 2: Update SandboxRenderer

```typescript
// In src/core/SandboxRenderer.ts

enableVRButton(): void {
  // Enable WebXR
  this.renderer.xr.enabled = true;
  this.renderer.xr.setReferenceSpaceType('local-floor');

  // Create VR button
  this.vrButton = VRButton.createButton(this.renderer);
  document.body.appendChild(this.vrButton);

  // No need to handle session events here - VRSystem handles them
}
```

### Step 3: Update Main Game Loop

```typescript
// In src/core/PixelArtSandbox.ts

private animate(): void {
  const deltaTime = this.clock.getDelta();

  // Systems will handle VR/desktop differences internally
  this.systemManager.update(deltaTime);

  // Render
  this.sandboxRenderer.renderer.render(
    this.sandboxRenderer.scene,
    this.systemManager.cameraRig.camera // Use camera from rig
  );
}
```

## Key Differences from Old System

### Old Approach (Incorrect)
```typescript
// ❌ Wrong: Trying to move camera in VR
vrPlayerGroup.add(camera);
camera.position.set(0, 1.6, 0); // WebXR ignores this!
```

### New Approach (Correct)
```typescript
// ✅ Correct: Move the dolly, camera stays put
dolly.add(camera);
dolly.position.set(x, terrainHeight, z); // Move the whole rig
```

## Testing Checklist

### Desktop Mode
- [ ] Mouse look works
- [ ] WASD movement works
- [ ] Jump works
- [ ] Player stays on terrain

### VR Mode
- [ ] Player spawns at correct height on terrain
- [ ] Left stick moves player
- [ ] Right stick snap turns
- [ ] Player stays on terrain while moving
- [ ] Teleportation works (if enabled)
- [ ] Controllers visible and tracking

## Common Issues and Solutions

### Issue: Player still appears at water level in VR
**Solution**: Make sure CameraRig.enterVR() is called when VR session starts, and that the dolly is positioned at the correct terrain height.

### Issue: Controls not working in VR
**Solution**: Check that InputManager is receiving the VR session and that VRInput is properly polling gamepad data.

### Issue: Camera jumps when entering/exiting VR
**Solution**: CameraRig handles position continuity - make sure enterVR/exitVR are called at the right times.

## Performance Considerations

1. **Reference Space Updates**: Only update when player teleports or enters VR
2. **Input Polling**: InputManager polls every frame but only processes changes
3. **Teleportation Raycasting**: Only active when teleport button is held

## Next Steps

1. Integrate weapon system with VR controllers
2. Add haptic feedback
3. Implement hand tracking (when available)
4. Add VR UI system (spatial UI)
5. Optimize for 90+ FPS in VR

## References

- [Three.js WebXR Examples](https://threejs.org/examples/#webxr_vr_dragging)
- [WebXR Device API](https://immersive-web.github.io/webxr/)
- [Oculus Best Practices](https://developer.oculus.com/resources/bp-locomotion/)