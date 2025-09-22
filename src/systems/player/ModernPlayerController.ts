import * as THREE from 'three';
import { GameSystem } from '../../types';
import { CameraRig } from '../camera/CameraRig';
import { InputManager, InputState } from '../input/InputManager';
import { VRSystem } from '../vr/VRSystem';

/**
 * Player state data
 */
interface PlayerState {
  // Position and movement
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;

  // Movement properties
  walkSpeed: number;
  runSpeed: number;
  jumpForce: number;
  gravity: number;

  // State flags
  isGrounded: boolean;
  isRunning: boolean;
  isJumping: boolean;
  isCrouching: boolean;

  // Health and status
  health: number;
  maxHealth: number;
  isAlive: boolean;
}

/**
 * Modern player controller using proper patterns
 * Handles both VR and desktop movement with unified input system
 */
export class ModernPlayerController implements GameSystem {
  // Core systems
  private cameraRig: CameraRig;
  private inputManager: InputManager;
  private vrSystem?: VRSystem;

  // Player state
  private state: PlayerState;

  // Movement parameters
  private readonly ACCELERATION = 10;
  private readonly FRICTION = 8;
  private readonly AIR_FRICTION = 2;
  private readonly GRAVITY = -9.81;
  private readonly TERMINAL_VELOCITY = -50;

  // Look controls (desktop only)
  private yaw = 0;
  private pitch = 0;
  private readonly PITCH_LIMIT = Math.PI / 2 - 0.1;

  // References
  private scene: THREE.Scene;
  private chunkManager?: any; // Terrain system
  private gameModeManager?: any; // Game mode system

  constructor(
    scene: THREE.Scene,
    cameraRig: CameraRig,
    inputManager: InputManager,
    vrSystem?: VRSystem
  ) {
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.inputManager = inputManager;
    this.vrSystem = vrSystem;

    // Initialize state
    this.state = {
      position: new THREE.Vector3(0, 5, 0),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(),

      walkSpeed: 5,
      runSpeed: 10,
      jumpForce: 6,
      gravity: this.GRAVITY,

      isGrounded: false,
      isRunning: false,
      isJumping: false,
      isCrouching: false,

      health: 100,
      maxHealth: 100,
      isAlive: true
    };
  }

  /**
   * Initialize player at spawn position
   */
  async init(): Promise<void> {
    // Get spawn position from game mode
    const spawnPos = this.getSpawnPosition();
    this.spawn(spawnPos);

    console.log('🎮 Player controller initialized');
  }

  /**
   * Spawn player at position
   */
  public spawn(position: THREE.Vector3): void {
    this.state.position.copy(position);
    this.state.velocity.set(0, 0, 0);
    this.state.isGrounded = false;
    this.state.isJumping = false;

    // Update camera rig position
    this.cameraRig.setPosition(position);

    // Reset look direction - face north (positive Z)
    this.yaw = Math.PI; // Face north instead of south
    this.pitch = 0;

    console.log(`🎯 Player spawned at: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
  }

  /**
   * Main update loop
   */
  update(deltaTime: number): void {
    if (!this.state.isAlive) return;

    // Get input state
    const input = this.inputManager.getState();

    // Update based on mode
    if (this.cameraRig.getIsInVR()) {
      this.updateVR(deltaTime, input);
    } else {
      this.updateDesktop(deltaTime, input);
    }

    // Update physics (gravity, collisions)
    this.updatePhysics(deltaTime);

    // Update camera rig
    this.cameraRig.update(deltaTime);
  }

  /**
   * Update desktop movement and controls
   */
  private updateDesktop(deltaTime: number, input: InputState): void {
    // Look controls
    this.updateLook(input.lookDelta, deltaTime);

    // Movement
    this.updateMovement(input, deltaTime);

    // Actions
    this.handleActions(input, deltaTime);
  }

  /**
   * Update VR movement (handled by VRSystem mostly)
   */
  private updateVR(deltaTime: number, input: InputState): void {
    // Handle VR movement with physics
    this.updateMovement(input, deltaTime);

    // Handle VR-specific actions
    this.handleActions(input, deltaTime);
  }

  /**
   * Update look rotation (desktop only)
   */
  private updateLook(lookDelta: THREE.Vector2, deltaTime: number): void {
    if (this.cameraRig.getIsInVR()) return; // VR uses head tracking

    // Apply look delta
    this.yaw -= lookDelta.x;
    this.pitch -= lookDelta.y;

    // Clamp pitch
    this.pitch = Math.max(-this.PITCH_LIMIT, Math.min(this.PITCH_LIMIT, this.pitch));

    // Apply rotation to camera
    this.cameraRig.rotate(this.yaw, this.pitch);
  }

  /**
   * Update movement from input
   */
  private updateMovement(input: InputState, deltaTime: number): void {
    // Check if moving
    const isMoving = input.movement.length() > 0;

    if (isMoving) {
      // Get camera direction
      const forward = this.cameraRig.getForwardDirection();
      forward.y = 0;
      forward.normalize();

      const right = new THREE.Vector3();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

      // Calculate desired velocity
      const speed = input.sprint ? this.state.runSpeed : this.state.walkSpeed;
      const targetVelocity = new THREE.Vector3();
      targetVelocity.addScaledVector(right, input.movement.x * speed);
      targetVelocity.addScaledVector(forward, input.movement.y * speed); // Fixed: removed negation

      // Apply acceleration
      const acceleration = this.state.isGrounded ? this.ACCELERATION : this.ACCELERATION * 0.2;
      const horizontalVel = new THREE.Vector3(this.state.velocity.x, 0, this.state.velocity.z);
      horizontalVel.lerp(targetVelocity, Math.min(deltaTime * acceleration, 1));

      // Update velocity (preserve Y for gravity)
      this.state.velocity.x = horizontalVel.x;
      this.state.velocity.z = horizontalVel.z;

      // Update state
      this.state.isRunning = input.sprint;
    } else {
      // Apply friction
      const friction = this.state.isGrounded ? this.FRICTION : this.AIR_FRICTION;
      const frictionFactor = Math.max(0, 1 - deltaTime * friction);
      this.state.velocity.x *= frictionFactor;
      this.state.velocity.z *= frictionFactor;

      this.state.isRunning = false;
    }

    // Handle jump
    if (input.jump && this.state.isGrounded && !this.state.isJumping) {
      this.state.velocity.y = this.state.jumpForce;
      this.state.isJumping = true;
      this.state.isGrounded = false;
    }
  }

  /**
   * Update physics (gravity, collisions)
   */
  private updatePhysics(deltaTime: number): void {
    // Apply gravity
    this.state.velocity.y += this.state.gravity * deltaTime;
    this.state.velocity.y = Math.max(this.state.velocity.y, this.TERMINAL_VELOCITY);

    // Calculate new position
    const movement = this.state.velocity.clone().multiplyScalar(deltaTime);
    const newPosition = this.state.position.clone().add(movement);

    // Check ground collision
    let groundHeight = 0;
    if (this.chunkManager) {
      groundHeight = this.chunkManager.getEffectiveHeightAt(newPosition.x, newPosition.z);
    }

    if (newPosition.y <= groundHeight) {
      // Hit ground
      newPosition.y = groundHeight;
      this.state.velocity.y = 0;
      this.state.isGrounded = true;
      this.state.isJumping = false;
    } else {
      // In air
      this.state.isGrounded = false;
    }

    // Update position
    this.state.position.copy(newPosition);

    // Always update camera rig position for both VR and desktop
    // This ensures proper terrain collision in VR mode
    this.cameraRig.setPosition(this.state.position);
  }

  /**
   * Handle player actions (shoot, reload, etc.)
   */
  private handleActions(input: InputState, deltaTime: number): void {
    if (input.primaryFire) {
      this.shoot();
    }

    if (input.reload) {
      this.reload();
    }

    if (input.interact) {
      this.interact();
    }
  }

  /**
   * Shoot weapon
   */
  private shoot(): void {
    // Implement shooting logic
    console.log('🔫 Shoot!');
  }

  /**
   * Reload weapon
   */
  private reload(): void {
    console.log('🔄 Reload');
  }

  /**
   * Interact with objects
   */
  private interact(): void {
    console.log('✋ Interact');
  }

  /**
   * Get spawn position from game mode
   */
  private getSpawnPosition(): THREE.Vector3 {
    // Try to get spawn from game mode manager
    if (this.gameModeManager) {
      const config = this.gameModeManager.getCurrentConfig();

      // Find the main US HQ (player spawn)
      const usMainHQ = config.zones.find((z: any) =>
        z.isHomeBase &&
        z.owner === 'US' &&
        (z.id.includes('main') || z.id === 'us_base')
      );

      if (usMainHQ) {
        const spawnPos = usMainHQ.position.clone();

        // Get actual terrain height at spawn position
        if (this.chunkManager) {
          const terrainHeight = this.chunkManager.getEffectiveHeightAt(spawnPos.x, spawnPos.z);

          if (terrainHeight === 0 || terrainHeight < -100) {
            console.warn(`⚠️ No terrain at spawn position ${spawnPos.x}, ${spawnPos.z} - using fallback height`);
            spawnPos.y = 10; // Higher fallback to avoid falling through
          } else {
            spawnPos.y = terrainHeight + 2; // Player height above terrain
          }

          console.log(`🎯 Spawning at US main HQ - Terrain height: ${terrainHeight.toFixed(1)}, Player at: ${spawnPos.x.toFixed(1)}, ${spawnPos.y.toFixed(1)}, ${spawnPos.z.toFixed(1)}`);
        } else {
          spawnPos.y = 5; // Default height if no terrain manager
        }

        return spawnPos;
      }
    }

    // Fallback spawn position
    const defaultSpawn = new THREE.Vector3(0, 5, -50);

    // Check terrain height at default spawn
    if (this.chunkManager) {
      const terrainHeight = this.chunkManager.getEffectiveHeightAt(defaultSpawn.x, defaultSpawn.z);
      if (terrainHeight > -100) { // Valid terrain
        defaultSpawn.y = terrainHeight + 2; // Player height above terrain
      }
    }

    console.log('📍 Using default spawn position');
    return defaultSpawn;
  }

  /**
   * Take damage
   */
  public takeDamage(amount: number): void {
    if (!this.state.isAlive) return;

    this.state.health = Math.max(0, this.state.health - amount);

    if (this.state.health <= 0) {
      this.die();
    }
  }

  /**
   * Handle player death
   */
  private die(): void {
    this.state.isAlive = false;
    console.log('💀 Player died');

    // Trigger respawn after delay
    setTimeout(() => this.respawn(), 3000);
  }

  /**
   * Respawn player
   */
  private respawn(): void {
    this.state.isAlive = true;
    this.state.health = this.state.maxHealth;

    const spawnPos = this.getSpawnPosition();
    this.spawn(spawnPos);
  }

  /**
   * Getters
   */
  public getPosition(): THREE.Vector3 {
    return this.state.position.clone();
  }

  public getVelocity(): THREE.Vector3 {
    return this.state.velocity.clone();
  }

  public getHealth(): number {
    return this.state.health;
  }

  public isAlive(): boolean {
    return this.state.isAlive;
  }

  /**
   * Setters
   */
  public setChunkManager(chunkManager: any): void {
    this.chunkManager = chunkManager;
    this.cameraRig.setChunkManager(chunkManager);
  }

  public setGameModeManager(gameModeManager: any): void {
    this.gameModeManager = gameModeManager;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    // Cleanup if needed
    console.log('🧹 Player controller disposed');
  }
}