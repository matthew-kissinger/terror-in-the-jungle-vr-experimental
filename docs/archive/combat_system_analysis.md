# Combat System Deep Dive Analysis

## Executive Summary
The game implements a sophisticated tactical FPS combat system featuring faction-based warfare between US and OPFOR forces, with zone capture objectives, ticket-based victory conditions, and complex AI behaviors. The system includes both enemy and ally NPCs with squad-based tactics, realistic weapon mechanics, and a comprehensive player health/respawn system.

## 1. NPC Systems Overview

### 1.1 Faction System
- **Two Factions**: US (player faction) vs OPFOR (enemy faction)
- **Shared Combat Logic**: Both use the same CombatantSystem class
- **Visual Differentiation**: Different textures and colors (US=blue, OPFOR=red)

### 1.2 NPC Spawning System

#### Initial Deployment
- **Starting Forces**: 4 soldiers per faction at their respective bases
- **US Base Position**: (0, 0, -50)
- **OPFOR Base Position**: (0, 0, 145)
- **Progressive Reinforcements**: Queue system spawns additional squads over time
  - 6 reinforcement waves queued at start
  - 1000ms delay between spawns
  - Squads of 2-4 soldiers each

#### Dynamic Spawning
- **Max Combatants**: 60 total NPCs allowed
- **Spawn Check Interval**: Every 3 seconds
- **Spawn Radius**: 80 units from reference point
- **Min Spawn Distance**: 30 units from player
- **Despawn Distance**: 150 units from player
- **Balance Maintenance**:
  - US minimum: 10 soldiers
  - OPFOR minimum: 15 soldiers (higher to challenge player)

#### Squad Formation
- **Formation Types**: Wedge, Line, Column
- **Spacing**: 4 meters between soldiers
- **Roles**: Leader + Followers
- **Spawn Pattern**: Leader at front, followers in formation behind

## 2. NPC AI Behavior

### 2.1 AI State Machine
NPCs operate on a finite state machine with the following states:

1. **IDLE**: Default state, no activity
2. **PATROLLING**: Moving toward objectives, scanning for enemies
3. **ALERT**: Enemy spotted, preparing to engage
4. **ENGAGING**: Actively shooting at target
5. **SUPPRESSING**: Firing at last known enemy position
6. **ADVANCING**: Moving toward enemy position
7. **RETREATING**: Falling back (not fully implemented)
8. **DEAD**: Eliminated from combat

### 2.2 AI Skill Profiles
Different skill levels based on faction and role:

#### OPFOR Skills (Better combat skills to balance player advantages)
**Leaders:**
- Reaction Delay: 300ms
- Aim Jitter: 0.8°
- Burst Length: 5 rounds
- Burst Pause: 500ms
- Target Leading: 90% accuracy
- Suppression Resistance: 80%
- Visual Range: 130m
- Field of View: 130°

**Followers:**
- Reaction Delay: 450ms
- Aim Jitter: 1.2°
- Burst Length: 4 rounds
- Burst Pause: 700ms
- Target Leading: 80% accuracy
- Suppression Resistance: 60%
- Visual Range: 130m
- Field of View: 130°

#### US Skills (Slightly worse to balance weapon advantages)
**Leaders:**
- Reaction Delay: 350ms
- Aim Jitter: 1.0°
- Burst Length: 4 rounds
- Burst Pause: 600ms
- Target Leading: 85% accuracy
- Suppression Resistance: 70%
- Visual Range: 120m
- Field of View: 120°

**Followers:**
- Reaction Delay: 500ms
- Aim Jitter: 1.4°
- Burst Length: 3 rounds
- Burst Pause: 800ms
- Target Leading: 75% accuracy
- Suppression Resistance: 50%
- Visual Range: 120m
- Field of View: 120°

### 2.3 Movement Behavior

#### Zone-Seeking Logic
- **Priority Target**: Nearest capturable zone not owned by faction
- **Squad Leaders**: Navigate to zones at 4 units/second
- **Squad Followers**: Stay within 6 units of leader at 2-3 units/second
- **Fallback Objective**: Move toward enemy base if no zones available

#### Combat Movement
- **Ideal Engagement Distance**: 30 meters
- **Advance Threshold**: >40m from target (move closer at 3 units/s)
- **Retreat Threshold**: <20m from target (back up at 2 units/s)
- **Strafe Pattern**: Sinusoidal movement when at ideal range

#### Patrol Movement
- **Wander Pattern**: Random direction changes every 2-4 seconds
- **Wander Speed**: 2 units/second
- **Direction Change**: Random angle every 2-3 seconds

### 2.4 Target Acquisition

#### Detection System
- **LOS Check**: Line of sight required for detection
- **FOV Check**: Target must be within field of view
- **Range Check**: Must be within visual range (120-130m)
- **Priority**: OPFOR prioritizes player over other US soldiers

#### Engagement Flow
1. **Detection**: Enemy enters FOV and range
2. **Alert State**: Reaction delay (300-500ms)
3. **Target Tracking**: Face target, maintain LOS
4. **Engagement**: Begin firing bursts
5. **Suppression**: Continue firing at last known position if LOS lost

## 3. Combat Mechanics

### 3.1 Weapon Systems

#### US Forces (M16A4)
- **Fire Rate**: 750 RPM
- **ADS Time**: 0.18s
- **Base Spread**: 0.6°
- **Bloom per Shot**: 0.2°
- **Recoil per Shot**: 0.55° vertical, 0.3° horizontal
- **Damage**: 26 (near) to 18 (far)
- **Falloff Range**: 25-65m
- **Headshot Multiplier**: 1.7x
- **Penetration Power**: 1.0

#### OPFOR Forces (AK-74)
- **Fire Rate**: 600 RPM
- **ADS Time**: 0.20s
- **Base Spread**: 0.8°
- **Bloom per Shot**: 0.3°
- **Recoil per Shot**: 0.75° vertical, 0.4° horizontal
- **Damage**: 38 (near) to 26 (far)
- **Falloff Range**: 20-55m
- **Headshot Multiplier**: 1.6x
- **Penetration Power**: 1.2

### 3.2 Damage System

#### Hitbox Zones
NPCs have multiple hitbox zones with different radii based on stance:

**Standing/Walking:**
- Head: 0.35m radius at 2.8m height
- Upper Torso: 0.6m radius at 1.5m height
- Lower Torso: 0.55m radius at 0.5m height
- Legs (x2): 0.4m radius at -0.8m height

**Alert/Ready:**
- Head: 0.35m radius at 2.7m height
- Upper Torso: 0.65m radius at 1.5m height
- Lower Torso: 0.55m radius at 0.5m height
- Legs (x2): 0.4m radius at -0.8m height

**Firing/Engaging:**
- Head: 0.3m radius at 2.5m height (smaller, crouched)
- Upper Torso: 0.65m radius at 1.4m height
- Lower Torso: 0.5m radius at 0.4m height
- Legs (x2): 0.35m radius at -0.6m height

#### Health Values
- **NPC Health**: 100 HP
- **Player Health**: 100 HP
- **Death**: 0 HP or below
- **No Health Regeneration** for NPCs
- **Player Regeneration**: 20 HP/s after 5s without damage

### 3.3 Firing Mechanics

#### Burst Control
- **Burst Length**: 2-5 rounds depending on skill
- **Burst Pause**: 400-1200ms between bursts
- **Accuracy Degradation**: Aim jitter increases with suppression

#### Suppressive Fire
- **Trigger**: Lost sight of target
- **Duration**: 1.5 seconds
- **Spread**: 2x normal aim jitter
- **Target**: Last known enemy position

## 4. Player Combat System

### 4.1 Player Weapon
- **Type**: Programmatic rifle (First Person)
- **Fire Rate**: 700 RPM
- **Perfect Accuracy**: 0° spread at crosshair center
- **Recoil**: 0.65° vertical per shot with recovery
- **Damage**: 34 (near) to 24 (far)
- **ADS Zoom**: 1.3x magnification
- **ADS Transition**: 0.18 seconds

### 4.2 Player Health System
- **Max Health**: 100 HP
- **Regeneration Delay**: 5 seconds after damage
- **Regeneration Rate**: 20 HP/second
- **Low Health Effects**:
  - Red screen edges <30 HP
  - Heartbeat sound effect
  - Pulsing health bar

### 4.3 Death & Respawn
- **Death State**: Controls disabled, weapon hidden
- **Respawn Timer**: 3 seconds
- **Spawn Options**:
  - US Base (always available)
  - Captured zones (US-controlled only)
- **Spawn Protection**: None (0 seconds invulnerability)
- **Ticket Cost**: 2 tickets per death

## 5. Zone Capture System

### 5.1 Zone Configuration
- **Total Zones**: 5 (2 bases + 3 capturable)
- **Zone Radius**: 15 meters
- **Capture Speed**: 1% per second per soldier

#### Zone Locations
1. **US Base**: (0, 0, -50) - Uncapturable
2. **OPFOR Base**: (0, 0, 145) - Uncapturable
3. **Alpha**: (-120, y, 50) - 1 ticket bleed/s
4. **Bravo**: (0, y, 50) - 2 ticket bleed/s (center, most valuable)
5. **Charlie**: (120, y, 50) - 1 ticket bleed/s

### 5.2 Capture Mechanics
- **Contest Threshold**: 30% presence required to contest
- **Capture Progress**: 0-100%
- **States**: Neutral, US Controlled, OPFOR Controlled, Contested
- **Visual Indicators**:
  - Flag height shows capture progress
  - Ring color shows ownership
  - Progress ring shows capture percentage

### 5.3 Zone Control Effects
- **Ticket Bleed**: Faction with <50% zone control loses tickets
- **Bleed Rate**: 0.5-2 tickets/second based on zone disadvantage
- **Total Control Bonus**: 2x bleed rate if one faction owns all zones
- **Spawn Points**: Controlled zones become spawn locations

## 6. Victory Conditions

### 6.1 Ticket System
- **Starting Tickets**: 300 per faction
- **Death Penalty**: 2 tickets per soldier killed
- **Zone Bleed**: Variable based on zone control

### 6.2 Game Phases
1. **SETUP** (0-10s): No combat, positioning phase
2. **COMBAT** (10-910s): Main 15-minute battle
3. **OVERTIME** (910-1030s): 2 minutes if score difference <50
4. **ENDED**: Match complete

### 6.3 Win Conditions
1. **Ticket Depletion**: First faction to 0 tickets loses
2. **Total Zone Control**: Instant win if all zones captured
3. **Time Limit**: Higher tickets win after overtime
4. **Admin Override**: Manual game end command

## 7. LOD System (Level of Detail)

### 7.1 Distance-Based Updates
- **High LOD** (<150m): Full AI, movement, combat, visuals - every frame
- **Medium LOD** (150-300m): Full AI and combat - 20 FPS updates
- **Low LOD** (300-500m): Basic movement only - 10 FPS updates
- **Culled** (>500m): No updates

### 7.2 Performance Optimizations
- **Instanced Rendering**: Single draw call per faction/state
- **Billboard Sprites**: 2D sprites instead of 3D models
- **Update Prioritization**: Closer enemies update more frequently
- **Effect Pooling**: Reused tracers, muzzle flashes, impacts

## 8. Visual & Audio Systems

### 8.1 Visual Effects
- **Tracers**: Pooled line renderers (256 max)
- **Muzzle Flashes**: Billboard sprites (128 max)
- **Impact Effects**: Particle bursts (128 max)
- **Damage Indicators**: Directional UI overlays
- **Hit Markers**: UI feedback for successful hits

### 8.2 Sprite States
NPCs change sprites based on state:
- **Walking**: Default patrol sprite
- **Alert**: Weapon raised sprite
- **Firing**: Shooting pose sprite
- **Back**: Rear view sprite (OPFOR only when facing away)

### 8.3 Audio Cues
- **Gunshots**: Positional 3D audio
- **Death Sounds**: Different for allies vs enemies
- **Zone Captures**: Notification sounds
- **Low Health**: Heartbeat effect

## 9. Tactical Considerations

### 9.1 AI Advantages
- **Numbers**: OPFOR maintains 50% more soldiers
- **Skills**: OPFOR has better reaction times and accuracy
- **Coordination**: Squad-based movement and tactics
- **Suppression**: Continues firing at last known positions

### 9.2 Player Advantages
- **Perfect Accuracy**: No spread when aimed properly
- **Better Weapon**: M16 has superior stats to AK-74
- **Respawn Choice**: Can spawn at captured zones
- **Regeneration**: Health recovers over time

### 9.3 Strategic Elements
- **Zone Priority**: Center zone (Bravo) worth 2x ticket bleed
- **Squad Tactics**: NPCs move and fight in coordinated groups
- **Spawn Waves**: Reinforcements arrive periodically
- **Territory Control**: Majority zone control causes enemy ticket bleed

## 10. Technical Implementation

### 10.1 System Architecture
- **Modular Design**: Separate systems for combat, zones, tickets, health
- **Event-Driven**: Systems communicate via callbacks
- **Performance Scaled**: LOD system manages update frequency
- **Memory Pooled**: Reusable objects for effects

### 10.2 Key Classes
- **CombatantSystem**: Manages all NPC logic and combat
- **ZoneManager**: Handles capture zones and territory
- **TicketSystem**: Tracks score and victory conditions
- **PlayerHealthSystem**: Player damage and respawn
- **FirstPersonWeapon**: Player weapon mechanics
- **GunplayCore**: Ballistics and damage calculations

### 10.3 Update Flow
1. Player input processed
2. NPC AI decisions made
3. Movement physics applied
4. Combat calculations performed
5. Zone control updated
6. Tickets adjusted
7. Visual effects spawned
8. Audio cues triggered

## Conclusion

The combat system is a well-balanced tactical shooter with sophisticated AI, realistic ballistics, and strategic zone control mechanics. The faction asymmetry (US weapons vs OPFOR skills) creates interesting gameplay dynamics, while the ticket system ensures matches have clear objectives and time pressure. The LOD system ensures good performance even with 60+ NPCs in combat.

Key strengths include squad-based AI tactics, multi-layered victory conditions, and the integration of territory control with combat objectives. The system successfully creates a Battlefield-style experience in a browser-based environment.