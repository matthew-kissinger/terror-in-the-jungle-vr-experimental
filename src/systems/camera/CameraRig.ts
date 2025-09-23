import * as THREE from 'three';

/**
 * Professional CameraRig implementation for WebXR/Desktop cross-compatibility
 * Based on Three.js WebXR examples and industry best practices
 */
export class CameraRig {
  // Core components
  public readonly dolly: THREE.Group;
  public readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;

  // Position and state tracking
  private worldPosition: THREE.Vector3;
  private isInVR: boolean = false;

  // Movement parameters
  private readonly PLAYER_HEIGHT = 3.0; // Eye height in meters (3m for better VR perspective)
  private readonly COLLISION_RADIUS = 0.3;

  // Reference to terrain/chunk manager for height queries
  private chunkManager?: any;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;

    // Create the dolly (camera rig) - this is what we move for locomotion
    this.dolly = new THREE.Group();
    this.dolly.name = 'CameraRig';

    // Initialize world position
    this.worldPosition = new THREE.Vector3();

    // Add dolly to scene
    this.scene.add(this.dolly);

    // Camera will be added to dolly when entering VR
    // In desktop mode, camera remains in scene
  }

  /**
   * Initialize the rig at a specific world position
   * Called when spawning or teleporting
   */
  public setPosition(position: THREE.Vector3): void {
    this.worldPosition.copy(position);

    if (this.isInVR) {
      // In VR: Position the dolly at ground level
      this.dolly.position.set(
        position.x,
        position.y, // Ground level
        position.z
      );
      // Camera local position in dolly represents standing height
      this.camera.position.set(0, 0, 0); // WebXR will handle the actual offset
    } else {
      // Desktop: Position camera directly at eye height
      this.camera.position.set(
        position.x,
        position.y + this.PLAYER_HEIGHT,
        position.z
      );
      this.dolly.position.set(0, 0, 0);
    }

    console.log(`📹 CameraRig positioned at: ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
  }

  /**
   * Get the current world position (feet position)
   */
  public getPosition(): THREE.Vector3 {
    if (this.isInVR) {
      return this.dolly.position.clone();
    } else {
      const pos = this.camera.position.clone();
      pos.y -= this.PLAYER_HEIGHT; // Convert from eye height to ground level
      return pos;
    }
  }

  /**
   * Get the camera's world position (eye/head position)
   */
  public getHeadPosition(): THREE.Vector3 {
    const headPos = new THREE.Vector3();
    this.camera.getWorldPosition(headPos);
    return headPos;
  }

  /**
   * Move the player (handles both VR and desktop)
   */
  public move(delta: THREE.Vector3): void {
    if (this.isInVR) {
      // VR: Move the dolly
      this.dolly.position.add(delta);
    } else {
      // Desktop: Move the camera
      this.camera.position.add(delta);
    }

    // Update tracked world position
    this.worldPosition = this.getPosition();
  }

  /**
   * Teleport to a new position (instant movement)
   */
  public teleport(position: THREE.Vector3): void {
    this.setPosition(position);
  }

  /**
   * Apply gravity and ground clamping
   */
  public applyGravity(deltaTime: number, velocity: THREE.Vector3): void {
    const currentPos = this.getPosition();

    // Get terrain height at current position
    let groundHeight = 0;
    if (this.chunkManager) {
      groundHeight = this.chunkManager.getEffectiveHeightAt(currentPos.x, currentPos.z);
    }

    // Apply gravity to velocity
    velocity.y -= 9.81 * deltaTime;

    // Calculate new position
    const newPos = currentPos.clone();
    newPos.y += velocity.y * deltaTime;

    // Ground collision
    if (newPos.y <= groundHeight) {
      newPos.y = groundHeight;
      velocity.y = 0;
    }

    // Apply the new position
    this.setPosition(newPos);
  }

  /**
   * Enter VR mode - properly configure camera hierarchy
   */
  public enterVR(): void {
    console.log('📹 CameraRig entering VR mode');
    this.isInVR = true;

    // Get current camera world position before we move it
    const cameraWorldPos = new THREE.Vector3();
    this.camera.getWorldPosition(cameraWorldPos);

    // Calculate ground position (where the player is standing)
    const groundPos = cameraWorldPos.clone();
    groundPos.y -= this.PLAYER_HEIGHT;

    // Position dolly at ground level
    this.dolly.position.copy(groundPos);

    // Remove camera from scene and add to dolly
    if (this.camera.parent) {
      this.camera.parent.remove(this.camera);
    }
    this.dolly.add(this.camera);

    // Reset camera local position - WebXR will control this
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);

    console.log(`📹 Dolly positioned at ground: ${this.dolly.position.x.toFixed(1)}, ${this.dolly.position.y.toFixed(1)}, ${this.dolly.position.z.toFixed(1)}`);
  }

  /**
   * Exit VR mode - restore desktop camera configuration
   */
  public exitVR(): void {
    console.log('📹 CameraRig exiting VR mode');
    this.isInVR = false;

    // Get dolly position (where player was standing in VR)
    const dollyPos = this.dolly.position.clone();

    // Remove camera from dolly and add back to scene
    this.dolly.remove(this.camera);
    this.scene.add(this.camera);

    // Position camera at eye height from where we were in VR
    this.camera.position.set(
      dollyPos.x,
      dollyPos.y + this.PLAYER_HEIGHT,
      dollyPos.z
    );

    // Reset dolly position
    this.dolly.position.set(0, 0, 0);
  }

  /**
   * Set reference to terrain manager for height queries
   */
  public setChunkManager(chunkManager: any): void {
    this.chunkManager = chunkManager;
  }

  /**
   * Check if currently in VR mode
   */
  public getIsInVR(): boolean {
    return this.isInVR;
  }

  /**
   * Apply rotation (desktop only - VR uses head tracking)
   */
  public rotate(yaw: number, pitch: number): void {
    if (!this.isInVR) {
      // Desktop: Apply rotation to camera
      this.camera.rotation.y = yaw;
      this.camera.rotation.x = pitch;
    }
    // In VR, rotation is handled by head tracking
  }

  /**
   * Get forward direction vector
   */
  public getForwardDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    return direction;
  }

  /**
   * Debug visualization
   */
  public update(deltaTime: number): void {
    // Could add debug visualization or interpolation here
  }
}