# VR Game Upgrade Plan - Terror in the Jungle VR

## Executive Summary
This document outlines the critical fixes and improvements needed to transform this game from a PC-with-VR-support title into a VR-first experience. The main issues are weapon positioning drift, button crash bugs, improper input mapping, and camera height problems.

## Critical Issues to Fix

### 🔴 Issue 1: Gun Position Drift
**Problem:** The gun moves away from the player as they move around the world, indicating a coordinate space mismatch.

**Root Cause Analysis:**
- Gun is likely attached to world space instead of local controller space
- Position updates may be additive instead of absolute
- Coordinate transformations between VR rig and world space are incorrect

**Files to Modify:**
- `src/systems/player/FirstPersonWeapon.ts:714-759` - VR weapon attachment logic
- `src/systems/vr/VRManager.ts:365-405` - VR weapon positioning
- `src/systems/vr/VRSystem.ts` - Controller tracking updates

### 🔴 Issue 2: Button Crashes
**Problem:** Some Oculus buttons cause the game to crash.

**Likely Causes:**
- Null reference exceptions when buttons trigger undefined actions
- Missing input validation in VR input handlers
- Conflicting input systems (VRSystem vs VRManager)

**Files to Check:**
- `src/systems/input/VRInput.ts` - Button event handlers
- `src/systems/vr/VRSystem.ts:handleControllerInput()` - Input processing

### 🟡 Issue 3: Camera Too Low
**Problem:** VR camera is positioned too low to the ground.

**Files to Modify:**
- `src/systems/camera/CameraRig.ts` - Dolly height configuration
- `src/systems/vr/VRSystem.ts` - VR player group positioning

### 🟡 Issue 4: Button Mapping Issues
**Problem:** Sprint and reload buttons not properly mapped.

**Current Mapping:**
- Sprint: Left Grip
- Reload: X Button or B Button
- Need to verify these work consistently

---

## Task List with Metaprompts

### Task 1: Fix Gun Position Drift 🔧
**Priority:** CRITICAL
**Estimated Complexity:** High

**Metaprompt for Implementation:**
```
Fix the VR weapon positioning system so the gun stays properly attached to the right controller regardless of player movement. The weapon should:
1. Always maintain the same relative position to the controller grip
2. Point in the direction the controller is pointing
3. Not drift or accumulate position errors as the player moves

Key areas to investigate:
- In FirstPersonWeapon.ts, ensure vr3DWeapon is added to the controller grip, not world/scene
- Verify the weapon's position is set relative to controller, not world coordinates
- Check that weapon updates happen in local space, not world space
- Ensure no cumulative transformations are being applied

The fix should make the gun feel like a natural extension of the player's hand.
```

### Task 2: Fix Button Crash Bugs 🐛
**Priority:** CRITICAL
**Estimated Complexity:** Medium

**Metaprompt for Implementation:**
```
Debug and fix crashes that occur when pressing certain Oculus buttons. Add comprehensive error handling to prevent any button press from crashing the game.

Steps:
1. Add try-catch blocks around all button handlers in VRInput.ts
2. Add null checks before accessing controller.gamepad.buttons
3. Validate button indices exist before accessing array elements
4. Add console warnings for undefined button mappings instead of throwing errors
5. Test all buttons (A, B, X, Y, triggers, grips, thumbsticks) for crashes

The game should gracefully handle any button press, even if unmapped.
```

### Task 3: Fix Camera Height 📏
**Priority:** HIGH
**Estimated Complexity:** Low

**Metaprompt for Implementation:**
```
Adjust the VR camera height to be at a comfortable standing eye level (approximately 1.6-1.7 meters).

In CameraRig.ts or VRSystem.ts:
1. Find where the VR player group or dolly is positioned
2. Add a vertical offset of approximately 1.6 meters
3. Ensure this doesn't break ground collision detection
4. Test that the player's eye level feels natural in VR

The player should feel like they're standing at normal human height.
```

### Task 4: Standardize Input Mapping 🎮
**Priority:** HIGH
**Estimated Complexity:** Medium

**Metaprompt for Implementation:**
```
Create a unified, well-documented input mapping system for VR controllers that properly handles all game actions.

Required mappings:
- Left Thumbstick: Movement (forward/back/strafe)
- Right Thumbstick: Snap turning (or smooth turning option)
- Right Trigger: Fire weapon
- Left Grip: Sprint (hold to run)
- A Button: Jump
- B Button or X Button: Reload
- Y Button: Open menu/pause

Ensure all mappings are clearly defined in one place and work consistently.
```

### Task 5: Remove Legacy PC Code 🧹
**Priority:** MEDIUM
**Estimated Complexity:** High

**Metaprompt for Implementation:**
```
Identify and remove or refactor legacy PC-specific code that's no longer needed for a VR-first experience.

Areas to clean up:
1. Remove duplicate VR systems (consolidate VRManager and VRSystem)
2. Remove desktop-specific UI elements that don't work in VR
3. Refactor PlayerController to be VR-optimized
4. Remove 2D weapon overlay system (keep only 3D VR weapons)
5. Simplify input system to focus on VR controllers

Keep the game functional in desktop mode for development, but optimize for VR.
```

### Task 6: Add Haptic Feedback 📳
**Priority:** LOW
**Estimated Complexity:** Low

**Metaprompt for Implementation:**
```
Enhance VR immersion by adding haptic feedback for key actions:

1. Weapon firing: Short pulse on trigger pull
2. Weapon reload: Pattern vibration during reload animation
3. Taking damage: Increasing intensity based on damage amount
4. Footsteps: Subtle pulses when walking (optional)
5. Interactions: Feedback when grabbing or using objects

Use the WebXR haptics API to trigger controller vibrations at appropriate moments.
```

### Task 7: Implement Comfort Options 🤢
**Priority:** MEDIUM
**Estimated Complexity:** Medium

**Metaprompt for Implementation:**
```
Add VR comfort options to reduce motion sickness:

1. Snap turning angles: 15°, 30°, 45°, 90° options
2. Smooth turning speed adjustment
3. Vignette during movement (optional tunnel vision)
4. Teleportation as alternative to smooth locomotion
5. Seated play mode with adjusted height
6. Dominant hand switching (left/right handed modes)

Create a VR settings menu accessible in-game.
```

---

## Implementation Order

1. **Phase 1 - Critical Fixes** ✅ COMPLETED
   - ✅ Fix gun position drift (Task 1) - Fixed by synchronizing CameraRig with VRManager positions
   - ✅ Fix button crashes (Task 2) - Added try-catch error handling for button access
   - ✅ Fix camera height (Task 3) - Increased player height from 1.6m to 1.8m

2. **Phase 2 - Core Improvements**
   - Standardize input mapping (Task 4)
   - Add basic haptic feedback (Task 6)

3. **Phase 3 - Optimization**
   - Remove legacy PC code (Task 5)
   - Implement comfort options (Task 7)

---

## Testing Checklist

After each fix, verify:
- [ ] Gun stays attached to hand during all movements
- [ ] All controller buttons work without crashes
- [ ] Camera is at comfortable standing height
- [ ] Sprint works with left grip
- [ ] Reload works with X or B button
- [ ] Movement feels smooth and responsive
- [ ] Turning (snap or smooth) works correctly
- [ ] No null reference errors in console
- [ ] Game runs at stable 72+ FPS in VR

---

## Code Quality Guidelines

When implementing fixes:
1. **Prefer VR-first design** - Make decisions that optimize for VR experience
2. **Use single source of truth** - Don't duplicate state across systems
3. **Add error handling** - VR should never crash from user input
4. **Document VR-specific code** - Help future developers understand VR requirements
5. **Test on actual hardware** - Oculus Quest 2/3 recommended for testing

---

## Success Metrics

The upgrade is successful when:
- ✅ No crashes from any controller input
- ✅ Gun perfectly tracks hand movement
- ✅ Player height feels natural
- ✅ All controls are intuitive and responsive
- ✅ Game maintains 72+ FPS on Quest 2
- ✅ Players can complete full gameplay session without motion sickness

---

## Additional Notes

### Current Architecture Issues
- Two parallel VR systems (VRSystem and VRManager) create confusion
- Three different player controllers with overlapping responsibilities
- Input handling spread across multiple files
- Coordinate space transformations are inconsistent

### Recommended Architecture
- Single VR system managing all XR functionality
- Unified player controller with VR/desktop modes
- Centralized input manager with clear mappings
- Consistent local-space transformations for all VR objects

### Resources
- [WebXR Device API](https://www.w3.org/TR/webxr/)
- [Three.js WebXR Documentation](https://threejs.org/docs/#manual/en/introduction/How-to-create-VR-content)
- [Oculus Best Practices](https://developer.oculus.com/resources/bp-overview/)