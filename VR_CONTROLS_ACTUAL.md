# VR Controls - ACTUAL IMPLEMENTATION

## Current Working Controls (as of latest commit)

### LEFT CONTROLLER:
| Button | Current Function | Code Location |
|--------|-----------------|---------------|
| **Left Thumbstick** | Movement (forward/back/strafe) | PlayerController.ts:355-377 |
| **Left Trigger** | Sprint (hold to run) | PlayerController.ts:359 |
| **Left Grip** | Show Wrist Display (when held) | SandboxSystemManager.ts:427-428 |
| **X Button** | Toggle Minimap | SandboxSystemManager.ts:418-419 |
| **Y Button** | Toggle Full Map | SandboxSystemManager.ts:421-422 |

### RIGHT CONTROLLER:
| Button | Current Function | Code Location |
|--------|-----------------|---------------|
| **Right Thumbstick** | Smooth Turn (left/right) | PlayerController.ts:395-403 |
| **Right Trigger** | Fire Weapon | FirstPersonWeapon.ts (via InputManager) |
| **Right Grip** | Jump (alternative) | PlayerController.ts:385-386 |
| **A Button** | Jump (primary) | PlayerController.ts:385-386 |
| **B Button** | Reload Weapon | FirstPersonWeapon.ts:229 |

## Features Currently Implemented:
- ✅ Sprint (LEFT TRIGGER - hold to run)
- ✅ Jump (A Button or Right Grip)
- ✅ Reload (B Button)
- ✅ Movement (Left Thumbstick)
- ✅ Turning (Right Thumbstick)
- ✅ Shooting (Right Trigger)
- ✅ Minimap (X Button)
- ✅ Full Map (Y Button)
- ✅ Wrist Display (Left Grip)

## Features Currently Missing:
- ❌ Crouch button (no VR crouch control implemented)
- ❌ Menu/Pause button

## Control Conflicts/Issues:
- ✅ Jump is on BOTH A Button AND Right Grip (redundant but intentional for comfort)
- ✅ Turning is smooth (not snap) with 1.5 rad/s speed
- ✅ Red laser sight always visible when weapon attached

## Visual Feedback:
- 🔴 Red laser sight from gun barrel (50m range)
- 📍 Minimap appears 1.5m in front when X pressed
- 🗺️ Full map appears 2m in front when Y pressed
- ⌚ Wrist display shows when Left Grip held

## Recommended Controls to Add:

### Sprint Options:
1. **Left Trigger** (hold) - Most natural for extended running
2. **Left Thumbstick Click** - Toggle sprint on/off
3. **Double-tap forward on thumbstick** - Auto-sprint

### Crouch Options:
1. **Left Thumbstick Click** - Toggle crouch
2. **Physical crouch** - Use headset height detection

### Menu:
- **Menu Button** on either controller - Pause game

## Notes:
- All button indices are for Quest 2/3 controllers
- Haptic feedback triggers on weapon fire
- Movement speed is currently fixed (no sprint multiplier in VR)