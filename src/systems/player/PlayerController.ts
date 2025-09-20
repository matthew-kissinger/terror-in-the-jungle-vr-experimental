import * as THREE from 'three';
import { GameSystem, PlayerState } from '../../types';
import { MathUtils } from '../../utils/Math';
import { ImprovedChunkManager } from '../terrain/ImprovedChunkManager';
import { GameModeManager } from '../world/GameModeManager';
import { Faction } from '../combat/types';

export class PlayerController implements GameSystem {
  private camera: THREE.PerspectiveCamera;
  private chunkManager?: ImprovedChunkManager;
  private gameModeManager?: GameModeManager;
  private playerState: PlayerState;
  private keys: Set<string> = new Set();
  private mouseMovement = { x: 0, y: 0 };
  private isPointerLocked = false;
  private isControlsEnabled = true; // For death system
  private gameStarted = false; // Don't lock pointer until game starts

  // Camera settings
  private pitch = 0;
  private yaw = Math.PI; // Face toward negative X (opposite of yaw=0)
  private maxPitch = Math.PI / 2 - 0.1; // Prevent full vertical rotation

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;

    // Default position - will be updated when game mode is set
    this.playerState = {
      position: new THREE.Vector3(0, 5, -50),
      velocity: new THREE.Vector3(0, 0, 0),
      speed: 10,
      runSpeed: 20,
      isRunning: false,
      isGrounded: false,
      isJumping: false,
      jumpForce: 12,
      gravity: -25
    };

    this.setupEventListeners();
  }

  async init(): Promise<void> {
    // Get spawn position from game mode if available
    if (this.gameModeManager) {
      const spawnPos = this.getSpawnPosition();
      this.playerState.position.copy(spawnPos);
    }

    // Set initial camera position
    this.camera.position.copy(this.playerState.position);
    console.log(`Player controller initialized at ${this.playerState.position.x.toFixed(1)}, ${this.playerState.position.y.toFixed(1)}, ${this.playerState.position.z.toFixed(1)}`);
  }

  update(deltaTime: number): void {
    if (!this.isControlsEnabled) return; // Skip updates when dead
    this.updateMovement(deltaTime);
    this.updateCamera();
    
    // Update chunk manager with player position
    if (this.chunkManager) {
      this.chunkManager.updatePlayerPosition(this.playerState.position);
    }
  }

  dispose(): void {
    this.removeEventListeners();
  }

  private setupEventListeners(): void {
    // Keyboard events
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));

    // Mouse events
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    document.addEventListener('mousemove', this.onMouseMove.bind(this));

    // Store bound function to avoid duplicate listeners
    this.boundRequestPointerLock = this.requestPointerLock.bind(this);

    // Instructions for user
    this.showControls();
  }

  private removeEventListeners(): void {
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
    document.removeEventListener('keyup', this.onKeyUp.bind(this));
    document.removeEventListener('click', this.requestPointerLock.bind(this));
    document.removeEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.isControlsEnabled) return; // Ignore input when dead
    this.keys.add(event.code.toLowerCase());

    // Handle special keys
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.playerState.isRunning = true;
    }

    if (event.code === 'Space' && this.playerState.isGrounded && !this.playerState.isJumping) {
      this.playerState.velocity.y = this.playerState.jumpForce;
      this.playerState.isJumping = true;
      this.playerState.isGrounded = false;
    }

    if (event.code === 'Escape') {
      document.exitPointerLock();
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.code.toLowerCase());
    
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.playerState.isRunning = false;
    }
  }

  private boundRequestPointerLock?: () => void;

  private requestPointerLock(): void {
    // Don't lock if controls are disabled (dead/respawning)
    if (this.gameStarted && !this.isPointerLocked && this.isControlsEnabled) {
      document.body.requestPointerLock();
    }
  }

  setGameStarted(started: boolean): void {
    this.gameStarted = started;
    if (started && this.boundRequestPointerLock) {
      // Remove any existing listener first
      document.removeEventListener('click', this.boundRequestPointerLock);
      // Add click listener for pointer lock
      document.addEventListener('click', this.boundRequestPointerLock);
      console.log('🎮 Game started - click to enable mouse look');
    }
  }

  private onPointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement === document.body;
    
    if (this.isPointerLocked) {
      console.log('Pointer locked - mouse look enabled');
    } else {
      console.log('Pointer lock released - click to re-enable mouse look');
    }
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isPointerLocked) return;

    const sensitivity = 0.002;
    this.mouseMovement.x = event.movementX * sensitivity;
    this.mouseMovement.y = event.movementY * sensitivity;
  }

  private updateMovement(deltaTime: number): void {
    const moveVector = new THREE.Vector3();
    const currentSpeed = this.playerState.isRunning ? this.playerState.runSpeed : this.playerState.speed;

    // Calculate movement direction based on camera orientation
    if (this.keys.has('keyw')) {
      moveVector.z -= 1;
    }
    if (this.keys.has('keys')) {
      moveVector.z += 1;
    }
    if (this.keys.has('keya')) {
      moveVector.x -= 1;
    }
    if (this.keys.has('keyd')) {
      moveVector.x += 1;
    }

    // Normalize movement vector
    if (moveVector.length() > 0) {
      moveVector.normalize();
      
      // Apply camera rotation to movement
      const cameraDirection = new THREE.Vector3();
      this.camera.getWorldDirection(cameraDirection);
      cameraDirection.y = 0; // Keep movement horizontal
      cameraDirection.normalize();
      
      const cameraRight = new THREE.Vector3();
      cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
      
      const worldMoveVector = new THREE.Vector3();
      worldMoveVector.addScaledVector(cameraDirection, -moveVector.z);
      worldMoveVector.addScaledVector(cameraRight, moveVector.x);
      
      // Apply movement with acceleration (only horizontal components)
      const acceleration = currentSpeed * 5; // Acceleration factor
      const targetVelocity = worldMoveVector.multiplyScalar(currentSpeed);
      const horizontalVelocity = new THREE.Vector3(this.playerState.velocity.x, 0, this.playerState.velocity.z);
      
      horizontalVelocity.lerp(targetVelocity, Math.min(deltaTime * acceleration, 1));
      
      // Update only horizontal components, preserve Y velocity for jumping/gravity
      this.playerState.velocity.x = horizontalVelocity.x;
      this.playerState.velocity.z = horizontalVelocity.z;
    } else {
      // Apply friction when not moving (only horizontal components)
      const frictionFactor = Math.max(0, 1 - deltaTime * 8);
      this.playerState.velocity.x *= frictionFactor;
      this.playerState.velocity.z *= frictionFactor;
    }

    // Apply gravity
    this.playerState.velocity.y += this.playerState.gravity * deltaTime;

    // Update position
    const movement = this.playerState.velocity.clone().multiplyScalar(deltaTime);
    const newPosition = this.playerState.position.clone().add(movement);

    // No bounds clamping for infinite world
    // Remove the old terrain bounds limitation

    // Check ground collision using ImprovedChunkManager if available, otherwise use flat baseline
    let groundHeight = 2; // Default player height above ground (flat world fallback)
    if (this.chunkManager) {
      const effectiveHeight = this.chunkManager.getEffectiveHeightAt(newPosition.x, newPosition.z);
      groundHeight = effectiveHeight + 2;
    }
    
    if (newPosition.y <= groundHeight) {
      // Player is on or below ground
      newPosition.y = groundHeight;
      this.playerState.velocity.y = 0;
      this.playerState.isGrounded = true;
      this.playerState.isJumping = false;
    } else {
      // Player is in the air
      this.playerState.isGrounded = false;
    }

    this.playerState.position.copy(newPosition);
  }

  private updateCamera(): void {
    // Update camera rotation from mouse movement
    if (this.isPointerLocked) {
      this.yaw -= this.mouseMovement.x;
      this.pitch -= this.mouseMovement.y;
      this.pitch = MathUtils.clamp(this.pitch, -this.maxPitch, this.maxPitch);
      
      // Reset mouse movement
      this.mouseMovement.x = 0;
      this.mouseMovement.y = 0;
    }

    // Apply rotation to camera
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Update camera position
    this.camera.position.copy(this.playerState.position);
  }

  // Apply recoil to camera by adjusting internal yaw/pitch so effect persists
  applyRecoil(pitchDeltaRad: number, yawDeltaRad: number): void {
    this.pitch = MathUtils.clamp(this.pitch + pitchDeltaRad, -this.maxPitch, this.maxPitch);
    this.yaw += yawDeltaRad;
  }

  setPosition(position: THREE.Vector3): void {
    this.playerState.position.copy(position);
    this.camera.position.copy(position);
    // Reset velocity to prevent carrying momentum
    this.playerState.velocity.set(0, 0, 0);
    this.playerState.isGrounded = false;
    console.log(`Player teleported to ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
  }

  // Disable controls (for death)
  disableControls(): void {
    this.isControlsEnabled = false;
    this.keys.clear();
    this.playerState.velocity.set(0, 0, 0);
    this.playerState.isRunning = false;

    // Unlock mouse cursor for respawn UI
    if (document.pointerLockElement === document.body) {
      document.exitPointerLock();
    }
  }

  // Enable controls (for respawn)
  enableControls(): void {
    this.isControlsEnabled = true;

    // Re-lock mouse cursor after respawn
    if (this.gameStarted && !document.pointerLockElement) {
      // Small delay to avoid conflict with UI interaction
      setTimeout(() => {
        document.body.requestPointerLock();
      }, 100);
    }
  }

  private showControls(): void {
    console.log(`
🎮 CONTROLS:
WASD - Move
Shift - Run
Space - Jump
Mouse - Look around (click to enable pointer lock)
Escape - Release pointer lock
    `);
  }

  getPosition(): THREE.Vector3 {
    return this.playerState.position.clone();
  }

  getVelocity(): THREE.Vector3 {
    return this.playerState.velocity.clone();
  }
  
  isMoving(): boolean {
    return this.playerState.velocity.length() > 0.1;
  }

  teleport(position: THREE.Vector3): void {
    this.playerState.position.copy(position);
    this.playerState.velocity.set(0, 0, 0);
  }

  setChunkManager(chunkManager: ImprovedChunkManager): void {
    this.chunkManager = chunkManager;
  }

  setGameModeManager(gameModeManager: GameModeManager): void {
    this.gameModeManager = gameModeManager;
  }

  private getSpawnPosition(): THREE.Vector3 {
    if (!this.gameModeManager) {
      return new THREE.Vector3(0, 5, -50); // Default fallback
    }

    const config = this.gameModeManager.getCurrentConfig();

    // Find the main US HQ
    const usMainHQ = config.zones.find(z =>
      z.isHomeBase &&
      z.owner === Faction.US &&
      (z.id.includes('main') || z.id === 'us_base')
    );

    if (usMainHQ) {
      // Spawn at main HQ with player height
      const spawnPos = usMainHQ.position.clone();
      spawnPos.y = 5; // Player height
      console.log(`🎯 Spawning at US main HQ: ${spawnPos.x.toFixed(1)}, ${spawnPos.y.toFixed(1)}, ${spawnPos.z.toFixed(1)}`);
      return spawnPos;
    }

    // Fallback to default
    console.warn('Could not find US main HQ, using default spawn');
    return new THREE.Vector3(0, 5, -50);
  }
}