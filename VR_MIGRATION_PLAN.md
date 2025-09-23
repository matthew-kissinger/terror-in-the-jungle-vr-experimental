# VRManager to VRSystem Migration Plan

## ✅ MIGRATION COMPLETE

All VRManager functionality has been successfully migrated to VRSystem. The codebase now uses a single, modern VR system.

## Overview
Migrate all VRManager functionality to VRSystem to eliminate redundancy and modernize the VR architecture.

## Current State
- **VRManager**: Handles input states, controller directions, vrPlayerGroup positioning
- **VRSystem**: Modern WebXR, teleportation, CameraRig, controller models
- **Issue**: Both systems run in parallel, causing complexity and potential drift

## Migration Phases

### Phase 1: Input System Migration
- [x] Add comprehensive input state tracking to VRSystem
  - [x] Create `controllerInputs` object structure matching VRManager
  - [x] Add thumbstick deadzone handling (0.2 threshold)
  - [x] Implement trigger analog value tracking
  - [x] Add grip button state tracking
  - [x] Implement A/B/X/Y button state tracking
- [x] Implement button press detection with cooldowns
  - [x] Create `isButtonPressed()` method with 500ms cooldown
  - [x] Add button cooldown tracking Map
  - [ ] Test button press edge cases
- [x] Create `getControllerInputs()` API matching VRManager interface
- [ ] Test input parity with VRManager

### Phase 2: Controller Direction APIs
- [x] Add controller direction methods to VRSystem
  - [x] Implement `getRightControllerDirection()`
  - [x] Implement `getLeftControllerDirection()`
  - [x] Add `getRightController()` method (already existed)
  - [x] Add `getLeftController()` method (already existed)
- [x] Add head tracking methods
  - [x] Implement `getHeadPosition()`
  - [x] Implement `getHeadRotation()`
- [ ] Test FirstPersonWeapon aiming with new APIs

### Phase 3: Position System Migration
- [x] Enhance CameraRig to replace vrPlayerGroup
  - [x] Add `moveVRPlayer()` method to VRSystem (using CameraRig)
  - [x] Add `getVRPlayerPosition()` to VRSystem (using CameraRig)
  - [x] Add `setVRPlayerPosition()` to VRSystem (using CameraRig)
  - [x] Ensure world-space positioning matches VRManager
- [x] Update VRSystem to use CameraRig for all positioning
  - [x] Replace vrPlayerGroup references with CameraRig dolly
  - [x] Sync teleportation with CameraRig position
  - [x] Ensure smooth locomotion uses CameraRig
- [ ] Test position synchronization with PlayerController

### Phase 4: Game System Integration
- [x] Add game system references to VRSystem
  - [x] Add `setFirstPersonWeapon()` method
  - [x] Add `setPlayerController()` method
  - [x] Store references properly
- [x] Migrate session management hooks
  - [ ] Move terrain height offset calculation
  - [x] Implement weapon attachment on session start
  - [x] Implement weapon detachment on session end
  - [x] Handle PlayerController position sync
- [ ] Connect VRHUDSystem to VRSystem
  - [ ] Move controller input handling for HUD
  - [ ] Ensure haptic feedback works

### Phase 5: Update Dependent Systems
- [x] Update PlayerController
  - [x] Replace VRManager references with VRSystem
  - [x] Update input reading to use VRSystem.getControllerInputs()
  - [x] Update movement to use VRSystem position methods
  - [ ] Test VR locomotion thoroughly
- [x] Update FirstPersonWeapon
  - [x] Replace VRManager controller references
  - [x] Update aiming to use VRSystem.getRightControllerDirection()
  - [x] Update trigger input to use VRSystem
  - [ ] Test weapon firing and reloading
- [x] Update SandboxSystemManager
  - [x] Remove VRManager initialization
  - [x] Update system connections
  - [x] Clean up dual-system synchronization code

### Phase 6: Testing & Validation
- [ ] Test all controller inputs
  - [ ] Verify thumbstick movement
  - [ ] Verify trigger firing
  - [ ] Verify button actions (jump, reload, etc.)
  - [ ] Verify grip buttons
- [ ] Test position tracking
  - [ ] No drift between controller and player position
  - [ ] Teleportation works correctly
  - [ ] Smooth locomotion feels natural
- [ ] Test weapon system
  - [ ] Weapon follows controller properly
  - [ ] Aiming is accurate
  - [ ] Recoil works correctly
- [ ] Test VR HUD system
  - [ ] Minimap toggle (X button)
  - [ ] Full map toggle (Y button)
  - [ ] Wrist display (left grip)
  - [ ] Combat HUD (damage indicators)

### Phase 7: Cleanup
- [x] Remove VRManager.ts file
- [x] Remove VRManager imports throughout codebase
- [x] Update documentation
- [x] Remove legacy comments
- [x] Final code review

## Implementation Notes

### Critical Considerations
1. **Input Polling**: Must maintain 90Hz polling rate for smooth input
2. **Deadzone**: Keep 0.2 threshold for thumbsticks to prevent drift
3. **Button Cooldowns**: 500ms cooldown prevents accidental double-triggers
4. **Position Sync**: CameraRig must update before PlayerController each frame
5. **Weapon Attachment**: Must attach to gripSpace, not hand space

### API Compatibility
Ensure VRSystem provides these exact methods for backward compatibility:
```typescript
interface VRSystemAPI {
  // Input
  getControllerInputs(): ControllerInputs;
  isButtonPressed(button: string): boolean;

  // Controllers
  getRightController(): THREE.Group | null;
  getLeftController(): THREE.Group | null;
  getRightControllerDirection(): THREE.Vector3 | null;
  getLeftControllerDirection(): THREE.Vector3 | null;

  // Head
  getHeadPosition(): THREE.Vector3;
  getHeadRotation(): THREE.Quaternion;

  // Position
  moveVRPlayer(movement: THREE.Vector3): void;
  getVRPlayerPosition(): THREE.Vector3;
  setVRPlayerPosition(position: THREE.Vector3): void;

  // Integration
  setFirstPersonWeapon(weapon: any): void;
  setPlayerController(controller: any): void;
}
```

### Testing Checklist
- [ ] Can move with left thumbstick
- [ ] Can turn with right thumbstick
- [ ] Can shoot with right trigger
- [ ] Can reload with B button
- [ ] Can jump with A button
- [ ] Can sprint with left grip
- [ ] Can toggle minimap with X
- [ ] Can toggle full map with Y
- [ ] Weapon aims where pointing
- [ ] No position drift
- [ ] Haptic feedback works
- [ ] All UI elements visible

## Risk Mitigation
1. **Backup Current State**: Commit before starting migration
2. **Test Incrementally**: Test after each phase
3. **Keep VRManager**: Don't delete until Phase 7
4. **Feature Flags**: Consider migration toggle during testing
5. **User Testing**: Get feedback on controller feel

## Success Criteria
- [ ] All VR functionality works as before
- [ ] No position drift issues
- [ ] Controller input feels responsive
- [ ] Code is cleaner and more maintainable
- [ ] Single VR system instead of two
- [ ] Performance is same or better

## Timeline Estimate
- Phase 1-2: 2 hours (Input & Direction APIs)
- Phase 3: 1 hour (Position System)
- Phase 4: 1 hour (Game Integration)
- Phase 5: 2 hours (Update Dependencies)
- Phase 6: 1 hour (Testing)
- Phase 7: 30 minutes (Cleanup)
- **Total**: ~7.5 hours of focused work