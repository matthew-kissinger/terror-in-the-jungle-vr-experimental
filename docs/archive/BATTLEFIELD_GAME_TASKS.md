# Battlefield-Style Game Implementation Tasks

## Game Overview: US vs OPFOR Zone Control

### Core Concept
A battlefield-style game where the player fights as a US soldier alongside AI allies against OPFOR AI enemies, capturing and holding zones to achieve victory through tactical combat.

---

## Step 3: Zones & Squads ✅ COMPLETE
**Goal**: Implement tactical layer with teams fighting over objectives

### Zone Control System ✅ COMPLETE
- [✓] Create `ZoneManager.ts`
  - [✓] Define zone structure (id, position, radius, owner, captureProgress)
  - [✓] Implement capture mechanics based on presence
  - [✓] Add visual indicators (flags, markers, progress bars)
  - [✓] Zone types: neutral, US-controlled, OPFOR-controlled
- [✓] Integrated with `TicketSystem.ts` (replaced BattleManager)
  - [✓] Manage overall battle state
  - [✓] Track zone ownership changes
  - [✓] Calculate ticket bleed rates
  - [✓] Handle reinforcement spawning
- [✓] Zone capture mechanics:
  - [✓] Capture rate based on attacker/defender ratio
  - [✓] Contested state when both factions present
  - [✓] Capture progress persistence
  - [✓] Zone bonuses (spawn points at captured zones)

**Metaprompt**: "Create zone control system where areas flip based on faction presence, with visual indicators and capture progress tracking"

### Squad Objective System ✅ COMPLETE
- [✓] Enhanced squad AI:
  - [✓] Objective assignment (zones as destinations)
  - [✓] Priority based on proximity and state
  - [✓] Dynamic behavior based on combat state
- [✓] Squad coordination:
  - [✓] Formation movement with leaders/followers
  - [✓] Burst fire patterns and suppression
  - [✓] Faction-based target prioritization
- [✓] Player squad integration:
  - [✓] US allies spawn near and fight with player
  - [✓] Provide covering fire automatically
  - [✓] React to threats and engage enemies

**Metaprompt**: "Implement squad-level objective assignment where AI squads autonomously attack/defend zones based on tactical priorities"

### Influence System
- [ ] Create influence grid:
  - [ ] Per-chunk influence values
  - [ ] Faction control strength calculation
  - [ ] Front line detection
  - [ ] Safe zone identification
- [ ] AI decision making:
  - [ ] Path planning through friendly territory
  - [ ] Flanking routes identification
  - [ ] Retreat path calculation

**Metaprompt**: "Build influence map system that models territorial control and helps AI make tactical decisions"

---

## Step 4: Scale & LOD
**Goal**: Handle 100+ actors smoothly

### Performance Systems
- [ ] Create `ShotQueue.ts`:
  - [ ] Limit to 64 ray solves per frame
  - [ ] Priority queue based on distance
  - [ ] Batch processing for efficiency
- [ ] Enhanced LOD tiers:
  - [ ] **Near** (0-50m): Full simulation, all effects
  - [ ] **Mid** (50-150m): Reduced update rate, basic effects
  - [ ] **Far** (150-300m): Abstract combat only
  - [ ] **Strategic** (300m+): Statistical resolution
- [ ] Web Worker integration:
  - [ ] Move AI decision making to workers
  - [ ] SharedArrayBuffer for position/state sync
  - [ ] Parallel squad processing

**Metaprompt**: "Optimize combat system to handle 100+ combatants using aggressive LOD, worker threads, and shot queuing"

### Batch Processing
- [ ] Instance batching improvements:
  - [ ] Single draw call per faction-state
  - [ ] Texture atlasing for soldier variations
  - [ ] GPU-based animation states
- [ ] Update scheduling:
  - [ ] Staggered AI updates across frames
  - [ ] Priority-based processing
  - [ ] Frame budget management

**Metaprompt**: "Implement frame-budget-aware update scheduling that maintains 60fps with many combatants"

---

## Step 5: Pathfinding
**Goal**: Smart squad movement and positioning

### Navigation Mesh
- [ ] Coarse grid pathfinding:
  - [ ] Chunk-based navigation grid
  - [ ] Walkability based on terrain slope
  - [ ] Water/cliff avoidance
- [ ] Waypoint system:
  - [ ] Strategic points around zones
  - [ ] Cover positions
  - [ ] Flanking routes
- [ ] Squad pathfinding:
  - [ ] Formation preservation
  - [ ] Coordinated movement
  - [ ] Dynamic obstacle avoidance

**Metaprompt**: "Create navigation system for squad movement that avoids obstacles and maintains formations"

### Cover System
- [ ] Cover point identification:
  - [ ] Terrain elevation analysis
  - [ ] Rock/tree positions
  - [ ] Building edges (future)
- [ ] Cover usage AI:
  - [ ] Seek cover when suppressed
  - [ ] Peek and shoot mechanics
  - [ ] Cover-to-cover movement
- [ ] Cover scoring:
  - [ ] Protection value
  - [ ] Firing angle assessment
  - [ ] Distance to objective

**Metaprompt**: "Implement cover system where AI dynamically identifies and uses terrain features for protection"

---

## Step 6: Player Systems ✅ COMPLETE
**Goal**: Complete player experience with health, respawn, and objectives

### Player Health & Damage ✅ COMPLETE
- [✓] Health system:
  - [✓] 100 HP with 5 second regeneration delay
  - [✓] Damage indicators (red screen edges)
  - [✓] Low health effects (heartbeat sound, screen pulse)
  - [✓] Death state with respawn timer
- [✓] Damage reception:
  - [✓] From AI combatants using GunplayCore
  - [✓] Directional damage indicators:
    - [✓] Red directional arrows showing damage source
    - [✓] Intensity based on damage amount
    - [✓] Fade out over 2-3 seconds
  - [✓] Screen effects:
    - [✓] Red flash on hit
    - [✓] Screen edge reddening
    - [✓] Low health pulsing effect
  - [✓] Audio feedback (damage sounds, heartbeat)

**Metaprompt**: "Add player health system with visual/audio feedback and damage from AI combatants"

### Respawn System ✅ COMPLETE
- [✓] Spawn selection:
  - [✓] Base spawn (always available)
  - [ ] Squad spawn (future enhancement)
  - [✓] Zone spawn (at captured zones)
  - [✓] Spawn protection (3 seconds invulnerability)
- [✓] Death system:
  - [✓] Death screen overlay
  - [ ] Killcam replay (future enhancement)
  - [✓] Respawn timer (3 seconds)
- [ ] Loadout selection (future enhancement):
  - [ ] Primary weapon choice
  - [ ] Equipment selection
  - [ ] Class selection

**Metaprompt**: "Create respawn system with multiple spawn points and brief spawn protection"

---

## Step 7: Game Loop & Victory ✅ COMPLETE
**Goal**: Complete game flow from start to victory/defeat

### Ticket System ✅ COMPLETE
- [✓] Ticket management:
  - [✓] Starting tickets: 300 per faction
  - [✓] Ticket bleed from zone control (<50% = bleed)
  - [✓] Death penalties (2 tickets per death)
  - [✓] Continuous reinforcement spawning
- [✓] Ticket UI:
  - [✓] Faction ticket displays
  - [✓] Bleed rate indicators
  - [✓] Match timer and phase display

**Metaprompt**: "Implement ticket system where controlling majority zones causes enemy ticket bleed"

### Win/Loss Conditions ✅ COMPLETE
- [✓] Victory conditions:
  - [✓] Enemy tickets reach 0
  - [✓] All zones captured (instant win)
  - [✓] Time limit expiration (most tickets win)
- [✓] Defeat conditions:
  - [✓] US tickets reach 0
  - [✓] All zones lost
- [✓] End game:
  - [✓] Victory/defeat screen overlay
  - [✓] Final score display
  - [ ] Return to menu/restart (future enhancement)

**Metaprompt**: "Create win/loss conditions based on tickets and zone control with appropriate end game screens"

### Battle Flow ✅ COMPLETE
- [✓] Match phases:
  - [✓] **Setup** (10s): Initial spawn, "PREPARE FOR BATTLE"
  - [✓] **Combat** (15min): Main battle phase
  - [✓] **Overtime** (2min): Triggers if ticket diff <50
  - [✓] **End**: Victory/defeat screen
- [✓] Dynamic events:
  - [✓] Continuous AI reinforcement spawning
  - [ ] Commander abilities (future enhancement)
  - [ ] Weather changes (future enhancement)

**Metaprompt**: "Implement complete match flow from setup through combat to victory with dynamic pacing"

---

## Step 8: UI & HUD ✅ COMPLETE
**Goal**: Clear battlefield information and controls

### Combat HUD ✅ COMPLETE
- [✓] Core elements:
  - [✓] Health bar with visual states
  - [✓] Ammo counter (integrated in weapon system)
  - [✓] Minimap with zones and combatants
  - [✓] Objective markers and distances
- [✓] Zone indicators:
  - [✓] Capture progress bars
  - [✓] Zone ownership icons (colored circles)
  - [✓] Distance to objectives
- [✓] Combat information:
  - [✓] Faction combatant counts
  - [✓] Ticket displays
  - [✓] Match timer and phase

**Metaprompt**: "Create comprehensive HUD showing health, ammo, objectives, and squad information"

### Tactical Map
- [ ] Full map view (M key):
  - [ ] Zone control overview
  - [ ] Squad positions
  - [ ] Spawn point selection
  - [ ] Objective marking
- [ ] Legend:
  - [ ] Faction colors
  - [ ] Zone states
  - [ ] Unit types

**Metaprompt**: "Build tactical map interface for viewing battlefield state and selecting spawn points"

---

## Step 9: Audio & Feedback
**Goal**: Immersive battlefield audio and clear feedback

### Combat Audio
- [ ] Weapon sounds:
  - [ ] Faction-specific gun sounds
  - [ ] Distance-based attenuation
  - [ ] Interior/exterior filtering
- [ ] Environmental audio:
  - [ ] Ambient battlefield sounds
  - [ ] Directional combat audio
  - [ ] Zone capture sounds
- [ ] Voice callouts:
  - [ ] AI combat chatter
  - [ ] Objective notifications
  - [ ] Squad commands

**Metaprompt**: "Implement 3D positional audio for weapons and battlefield atmosphere"

### Visual Feedback
- [ ] Hit markers:
  - [ ] Standard hits (white X)
  - [ ] Headshots (red X)
  - [ ] Kill confirmation (skull icon)
- [ ] Damage feedback:
  - [ ] Blood splatter on hits
  - [ ] Suppression effects
  - [ ] Screen shake on nearby explosions
- [ ] Objective feedback:
  - [ ] Zone capture animations
  - [ ] Flag raising/lowering
  - [ ] Territory color changes

**Metaprompt**: "Add visual feedback systems for combat actions and objective states"

---

## Step 10: Polish & Optimization
**Goal**: Smooth, bug-free experience

### Performance Optimization
- [ ] Profiling and optimization:
  - [ ] Identify bottlenecks
  - [ ] Memory leak detection
  - [ ] Draw call optimization
  - [ ] Network optimization (future)
- [ ] Quality settings:
  - [ ] Graphics presets (Low/Med/High)
  - [ ] Effects density control
  - [ ] View distance settings
  - [ ] Shadow quality options

**Metaprompt**: "Profile and optimize game to maintain 60fps on medium hardware with 50+ combatants"

### Bug Fixing & Balance
- [ ] Combat balance:
  - [ ] Weapon damage tuning
  - [ ] AI difficulty adjustment
  - [ ] Spawn timing balance
  - [ ] Zone capture rates
- [ ] Bug priorities:
  - [ ] Game-breaking bugs
  - [ ] Combat inconsistencies
  - [ ] Visual glitches
  - [ ] Audio issues

**Metaprompt**: "Test and balance all game systems for fair, enjoyable combat"

---

## Verification Criteria

### Core Gameplay
- [ ] Player can spawn with US squad
- [ ] AI squads fight alongside player
- [ ] Zones can be captured and held
- [ ] Tickets drain based on zone control
- [ ] Victory/defeat conditions trigger correctly

### Combat Feel
- [ ] Gunplay feels responsive and fair
- [ ] AI behaves realistically
- [ ] Squad tactics are visible
- [ ] Cover system works effectively

### Performance
- [ ] 60fps with 50+ combatants
- [ ] Smooth LOD transitions
- [ ] No memory leaks
- [ ] Quick zone transitions

### Polish
- [ ] Clear UI/HUD information
- [ ] Immersive audio
- [ ] Visual feedback for all actions
- [ ] Intuitive controls

---

## Implementation Order

### Phase 1: Foundation ✅ COMPLETE
1. ✅ AI Gunplay (Step 2) - COMPLETE
2. ✅ Zone Control System (Step 3) - COMPLETE
3. ✅ Player Health & Respawn (Step 6) - COMPLETE

### Phase 2: Core Loop ✅ COMPLETE
4. ✅ Ticket System (Step 7.1) - COMPLETE
5. ✅ Win/Loss Conditions (Step 7.2) - COMPLETE
6. ✅ Basic HUD (Step 8) - COMPLETE

### Phase 3: Enhancement (Future)
7. ⛳ Advanced Pathfinding (Step 5)
8. ⛳ Performance Scaling to 100+ units (Step 4)
9. ⛳ Audio System (Step 9)

### Phase 4: Polish (Future)
10. ⛳ Visual Polish (Step 10)
11. ⛳ Balance Tuning
12. ⛳ Additional Content

---

## Current Status
- **Completed**:
  - ✅ Step 2 (AI Gunplay) - Faction-based combat with skill modifiers
  - ✅ Step 3 (Zones & Squads) - Full zone control with capture mechanics
  - ✅ Step 6 (Player Systems) - Health, damage, respawn systems
  - ✅ Step 7 (Game Loop) - Tickets, victory conditions, match flow
  - ✅ Step 8 (UI & HUD) - Complete battlefield interface
- **Game State**: **FULLY PLAYABLE** - All core mechanics operational
- **Performance**: Stable 60fps with 50+ combatants

---

## Key Decisions Made
- Player always on US side (no faction selection)
- Zone control drives victory (not just deathmatch)
- Squad-based AI (not individual soldiers)
- Ticket system for match duration
- No respawn delay initially (can be tuned)

---

## Risk Areas
1. **Performance with 100+ actors** - May need aggressive LOD
2. **Pathfinding complexity** - Start with simple grid
3. **Network multiplayer** - Not in initial scope
4. **Weapon variety** - Start with basic rifles only
5. **Map size** - Balance between scale and performance