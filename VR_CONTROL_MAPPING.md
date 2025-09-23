# VR Controller Mapping - Quest Controllers

## Current Control Mappings Analysis

### Existing Mappings (from codebase):

#### LEFT CONTROLLER:
- **Left Thumbstick**: Movement (forward/back/strafe)
- **Left Trigger**: Secondary fire (currently unused)
- **Left Grip**: Sprint (hold to run)
- **X Button**: Reload weapon
- **Y Button**: Currently unused (menu in some code)

#### RIGHT CONTROLLER:
- **Right Thumbstick**: Snap turning (left/right)
- **Right Trigger**: Primary fire (shoot weapon)
- **Right Grip**: Alternative jump (or unused)
- **A Button**: Jump/Interact
- **B Button**: Reload (duplicate of X) or Crouch

### Issues Found:
1. Reload is mapped to BOTH X and B buttons (redundant)
2. Jump is on both A button and Right Grip (redundant)
3. No dedicated button for HUD/UI controls
4. No button for map/inventory access

## Proposed VR Control Scheme

### LEFT CONTROLLER (Movement & UI):
| Button | Action | Notes |
|--------|--------|-------|
| **Left Thumbstick** | Movement (WASD equivalent) | Push forward/back/left/right to move |
| **Left Thumbstick Click** | Toggle Crouch | Click to crouch/stand |
| **Left Trigger** | Sprint (hold) | More natural than grip for extended use |
| **Left Grip** | Show Wrist Display | Hold and rotate wrist to check stats |
| **X Button** | Toggle Minimap | Quick tactical overview |
| **Y Button** | Toggle Full Map | Strategic map view |

### RIGHT CONTROLLER (Combat & Interaction):
| Button | Action | Notes |
|--------|--------|-------|
| **Right Thumbstick** | Smooth Turn | Left/right for rotation |
| **Right Thumbstick Click** | Toggle Snap/Smooth Turn | Player preference |
| **Right Trigger** | Primary Fire | Shoot weapon |
| **Right Grip** | Grab/Climb | Future: physical interactions |
| **A Button** | Jump | Primary jump button |
| **B Button** | Reload | Tactical reload |

### Menu Button (Both Controllers):
- **Menu Button**: Pause/Settings Menu

## UI Interaction Design

### Wrist Display (Always Available):
- Attached to left controller
- Shows: Health bar, Ammo count, Compass
- **Activation**: Hold Left Grip and rotate wrist inward (watch gesture)
- Natural "checking your watch" motion

### Minimap (Toggle):
- **Activation**: Press X Button
- Appears 1.5m in front, slightly to upper-right
- Semi-transparent tactical overview
- Shows: Player position, nearby enemies, objectives
- **Size**: 40cm x 40cm panel

### Full Map (Toggle):
- **Activation**: Press Y Button
- Appears 2m in front, centered
- Large strategic overview
- Shows: All zones, objectives, spawn points
- **Size**: 120cm x 80cm panel
- Can be grabbed and moved with grip buttons

### Combat HUD (Context Sensitive):
- Hit markers appear in center of view
- Damage indicators show direction of incoming fire
- Kill feed appears briefly above crosshair
- No permanent UI cluttering view

## Interaction Zones

### Near Field (0.3m - 0.75m):
- Wrist display
- Weapon inspection
- Inventory items (future)

### Mid Field (0.75m - 2m):
- Minimap
- Interaction prompts
- Pickup indicators

### Far Field (2m - 3m):
- Full map
- Menu screens
- Scoreboards

## Design Principles

1. **No Double Mapping**: Each button has ONE primary function
2. **Context Separation**: Left controller for movement/UI, right for combat
3. **Natural Gestures**: Wrist check for stats, trigger for shooting
4. **Comfort First**: Most-used actions on most comfortable buttons
5. **Optional Complexity**: Core gameplay uses few buttons, advanced features are optional

## Implementation Priority

### Phase 1 (Core):
- Fix current double mappings
- Implement wrist display
- Basic minimap toggle

### Phase 2 (Enhanced):
- Full map system
- Smooth vs snap turn toggle
- Crouch on thumbstick click

### Phase 3 (Polish):
- Grab/climb mechanics
- Physical reload gestures
- Customizable button mapping

## Haptic Feedback Guide

### Combat:
- **Weapon Fire**: Strong pulse (0.8 intensity, 100ms)
- **Reload Complete**: Double tap (0.5 intensity, 50ms each)
- **Take Damage**: Variable intensity based on damage
- **Low Health**: Heartbeat pattern

### UI:
- **Button Press**: Light tap (0.3 intensity, 30ms)
- **Menu Open/Close**: Soft pulse (0.4 intensity, 60ms)
- **Map Toggle**: Subtle click (0.2 intensity, 20ms)

### Movement:
- **Jump Landing**: Medium thud (0.6 intensity, 80ms)
- **Sprint Start**: Quick burst (0.4 intensity, 40ms)
- **Wall Collision**: Bump feedback (0.5 intensity, 60ms)

## Notes for Development

1. **Test with actual Quest 2/3 hardware** - Button indices may vary
2. **Add button remapping in settings** - Accessibility is important
3. **Consider left-handed mode** - Swap controller functions
4. **Save user preferences** - Remember snap/smooth turn choice
5. **Tutorial system** - Teach controls progressively