import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { GameSystem } from '../../types';

export class VRManager implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // VR player group - contains camera and controllers
  public vrPlayerGroup: THREE.Group;

  // Controllers
  private leftController!: THREE.Group;
  private rightController!: THREE.Group;
  private leftGrip!: THREE.Group;
  private rightGrip!: THREE.Group;

  // Controller models
  private controllerModelFactory: XRControllerModelFactory;

  // VR scale factor (WebXR standard: 1 unit = 1 meter)
  public readonly VR_SCALE = 1.0; // 1:1 scale following WebXR best practices

  // Controller input state
  private controllerInputs = {
    leftThumbstick: { x: 0, z: 0 },
    rightThumbstick: { x: 0, y: 0 },
    leftTrigger: 0,
    rightTrigger: 0,
    leftGrip: false,
    rightGrip: false,
    aButton: false,
    bButton: false,
    xButton: false,
    yButton: false
  };

  // VR session state
  private vrSession: XRSession | null = null;

  // Reference to weapon system for VR weapon attachment
  private firstPersonWeapon?: any;

  // Reference to player controller for position sync
  private playerController?: any;

  // Button press cooldowns to prevent multiple triggers
  private buttonCooldowns = {
    aButton: false,
    bButton: false,
    xButton: false,
    yButton: false
  };

  // Debug flag for input source warning
  private noInputSourceWarned = false;
  private debugTimer = 0;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.controllerModelFactory = new XRControllerModelFactory();

    // Create VR player group (but don't add camera yet)
    this.vrPlayerGroup = new THREE.Group();
    this.vrPlayerGroup.name = 'VRPlayerGroup';

    // Don't scale or modify camera in constructor - only when VR is active
    this.scene.add(this.vrPlayerGroup);

    this.setupControllers();
    this.setupEventListeners();
  }

  private setupControllers(): void {
    // Get controller references
    this.leftController = this.renderer.xr.getController(0);
    this.rightController = this.renderer.xr.getController(1);
    this.leftGrip = this.renderer.xr.getControllerGrip(0);
    this.rightGrip = this.renderer.xr.getControllerGrip(1);

    // Add controller models
    this.leftGrip.add(this.controllerModelFactory.createControllerModel(this.leftGrip));
    this.rightGrip.add(this.controllerModelFactory.createControllerModel(this.rightGrip));

    // Add controllers to VR player group
    this.vrPlayerGroup.add(this.leftController);
    this.vrPlayerGroup.add(this.rightController);
    this.vrPlayerGroup.add(this.leftGrip);
    this.vrPlayerGroup.add(this.rightGrip);

    // Add interaction events (using any to bypass TypeScript WebXR event type issues)
    (this.rightController as any).addEventListener('selectstart', this.onRightTriggerStart.bind(this));
    (this.rightController as any).addEventListener('selectend', this.onRightTriggerEnd.bind(this));
    (this.leftController as any).addEventListener('selectstart', this.onLeftTriggerStart.bind(this));
    (this.leftController as any).addEventListener('selectend', this.onLeftTriggerEnd.bind(this));

    (this.rightController as any).addEventListener('squeezestart', this.onRightGripStart.bind(this));
    (this.rightController as any).addEventListener('squeezeend', this.onRightGripEnd.bind(this));
    (this.leftController as any).addEventListener('squeezestart', this.onLeftGripStart.bind(this));
    (this.leftController as any).addEventListener('squeezeend', this.onLeftGripEnd.bind(this));

    console.log('🎮 VR controllers initialized');
  }

  private setupEventListeners(): void {
    // Listen for VR session start/end
    this.renderer.xr.addEventListener('sessionstart', this.onVRSessionStart.bind(this));
    this.renderer.xr.addEventListener('sessionend', this.onVRSessionEnd.bind(this));
  }

  private onVRSessionStart(): void {
    this.vrSession = this.renderer.xr.getSession();
    console.log('🥽 VR session started');

    // CRITICAL: In WebXR, we CANNOT move the camera - WebXR controls it directly
    // Instead, we use vrPlayerGroup as a "dolly" to offset the player position in the world

    // Get the camera's ACTUAL world position - this is where the player really is
    const cameraWorldPos = new THREE.Vector3();
    this.camera.getWorldPosition(cameraWorldPos);
    console.log(`🥽 Camera world position before VR: ${cameraWorldPos.x.toFixed(1)}, ${cameraWorldPos.y.toFixed(1)}, ${cameraWorldPos.z.toFixed(1)}`);

    // WebXR will place the camera at the physical floor (y=0 in reference space)
    // We need to position our dolly/rig to compensate for the terrain height
    const terrainHeight = cameraWorldPos.y - 1.8; // Current camera y minus eye height = terrain level

    // Position the dolly at the player's XZ position with proper Y offset
    this.vrPlayerGroup.position.set(
      cameraWorldPos.x,
      terrainHeight,  // This is where the player's feet should be on the terrain
      cameraWorldPos.z
    );
    this.vrPlayerGroup.rotation.set(0, 0, 0);

    // IMPORTANT: Do NOT add camera to vrPlayerGroup - WebXR needs it in the scene
    // The camera stays in the scene, and WebXR will control its position
    // We'll move the vrPlayerGroup (dolly) for locomotion

    console.log(`🥽 VR dolly positioned at: ${this.vrPlayerGroup.position.x.toFixed(1)}, ${this.vrPlayerGroup.position.y.toFixed(1)}, ${this.vrPlayerGroup.position.z.toFixed(1)}`);
    console.log(`🥽 Expected player height above terrain: ${(cameraWorldPos.y - terrainHeight).toFixed(1)}m`);

    // Sync this position back to the PlayerController
    if (this.playerController && typeof this.playerController.syncPositionFromVR === 'function') {
      this.playerController.syncPositionFromVR(this.vrPlayerGroup.position.clone());
    }

    // Attach VR weapon to controller
    if (this.firstPersonWeapon && typeof this.firstPersonWeapon.attachVRWeapon === 'function') {
      // Small delay to ensure controllers are ready
      setTimeout(() => {
        this.firstPersonWeapon.attachVRWeapon();
      }, 100);
    }
  }

  private onVRSessionEnd(): void {
    this.vrSession = null;
    console.log('🥽 VR session ended');

    // Detach VR weapon from controller
    if (this.firstPersonWeapon && typeof this.firstPersonWeapon.detachVRWeapon === 'function') {
      this.firstPersonWeapon.detachVRWeapon();
    }

    // Camera should already be in the scene (we didn't move it in VR)
    // Restore camera position to dolly position for continuity
    const dollyPos = this.vrPlayerGroup.position.clone();
    this.camera.position.set(dollyPos.x, dollyPos.y + 1.8, dollyPos.z);

    // Reset VR group
    this.vrPlayerGroup.position.set(0, 0, 0);
    this.vrPlayerGroup.scale.setScalar(1);
  }

  // Controller event handlers
  private onRightTriggerStart(): void {
    this.controllerInputs.rightTrigger = 1.0;
  }

  private onRightTriggerEnd(): void {
    this.controllerInputs.rightTrigger = 0.0;
  }

  private onLeftTriggerStart(): void {
    this.controllerInputs.leftTrigger = 1.0;
  }

  private onLeftTriggerEnd(): void {
    this.controllerInputs.leftTrigger = 0.0;
  }

  private onRightGripStart(): void {
    this.controllerInputs.rightGrip = true;
  }

  private onRightGripEnd(): void {
    this.controllerInputs.rightGrip = false;
  }

  private onLeftGripStart(): void {
    this.controllerInputs.leftGrip = true;
  }

  private onLeftGripEnd(): void {
    this.controllerInputs.leftGrip = false;
  }

  async init(): Promise<void> {
    console.log('🥽 VR Manager initialized');
  }

  update(deltaTime: number): void {
    if (!this.isVRActive()) return;

    // Update controller input from gamepad data
    this.updateControllerInputs();

    // Debug: Periodically log positions to understand what's happening
    if (!this.debugTimer) this.debugTimer = 0;
    this.debugTimer += deltaTime;
    if (this.debugTimer > 3) { // Log every 3 seconds
      this.debugTimer = 0;
      const cameraWorld = new THREE.Vector3();
      this.camera.getWorldPosition(cameraWorld);
      console.log(`🥽 VR Debug:
        vrPlayerGroup: ${this.vrPlayerGroup.position.x.toFixed(1)}, ${this.vrPlayerGroup.position.y.toFixed(1)}, ${this.vrPlayerGroup.position.z.toFixed(1)}
        camera local: ${this.camera.position.x.toFixed(1)}, ${this.camera.position.y.toFixed(1)}, ${this.camera.position.z.toFixed(1)}
        camera world: ${cameraWorld.x.toFixed(1)}, ${cameraWorld.y.toFixed(1)}, ${cameraWorld.z.toFixed(1)}`);
    }
  }

  private updateControllerInputs(): void {
    if (!this.vrSession) return;

    let hasInputSources = false;
    // Poll gamepad data for thumbsticks
    for (const source of this.vrSession.inputSources) {
      hasInputSources = true;
      if (source.gamepad) {
        const gamepad = source.gamepad;
        const handedness = source.handedness;

        if (handedness === 'left') {
          // Left thumbstick for movement
          const leftX = gamepad.axes[2] || 0;
          const leftZ = gamepad.axes[3] || 0;
          this.controllerInputs.leftThumbstick.x = this.applyDeadzone(leftX);
          this.controllerInputs.leftThumbstick.z = this.applyDeadzone(leftZ);

          // Debug log significant movement
          if (Math.abs(leftX) > 0.1 || Math.abs(leftZ) > 0.1) {
            console.log(`🎮 Left stick: X=${leftX.toFixed(2)}, Z=${leftZ.toFixed(2)}`);
          }

          // Left controller buttons (X and Y)
          this.controllerInputs.xButton = gamepad.buttons[4] ? gamepad.buttons[4].pressed : false;
          this.controllerInputs.yButton = gamepad.buttons[5] ? gamepad.buttons[5].pressed : false;
        } else if (handedness === 'right') {
          // Right thumbstick for turning
          const rightX = gamepad.axes[2] || 0;
          const rightY = gamepad.axes[3] || 0;
          this.controllerInputs.rightThumbstick.x = this.applyDeadzone(rightX);
          this.controllerInputs.rightThumbstick.y = this.applyDeadzone(rightY);

          // Debug log significant movement
          if (Math.abs(rightX) > 0.1 || Math.abs(rightY) > 0.1) {
            console.log(`🎮 Right stick: X=${rightX.toFixed(2)}, Y=${rightY.toFixed(2)}`);
          }

          // Right controller buttons (A and B)
          this.controllerInputs.aButton = gamepad.buttons[4] ? gamepad.buttons[4].pressed : false;
          this.controllerInputs.bButton = gamepad.buttons[5] ? gamepad.buttons[5].pressed : false;
        }
      }
    }

    // Log once if no input sources
    if (!hasInputSources && !this.noInputSourceWarned) {
      console.warn('⚠️ VR: No input sources detected');
      this.noInputSourceWarned = true;
    }
  }

  private applyDeadzone(value: number, deadzone: number = 0.2): number {
    return Math.abs(value) > deadzone ? value : 0;
  }

  dispose(): void {
    this.scene.remove(this.vrPlayerGroup);

    // Remove event listeners
    this.renderer.xr.removeEventListener('sessionstart', this.onVRSessionStart.bind(this));
    this.renderer.xr.removeEventListener('sessionend', this.onVRSessionEnd.bind(this));

    console.log('🧹 VR Manager disposed');
  }

  // Public getters
  isVRActive(): boolean {
    return this.renderer.xr.isPresenting;
  }

  getControllerInputs() {
    return { ...this.controllerInputs };
  }

  // Check if a button was just pressed (not held)
  isButtonPressed(button: 'aButton' | 'bButton' | 'xButton' | 'yButton'): boolean {
    const pressed = this.controllerInputs[button];
    if (pressed && !this.buttonCooldowns[button]) {
      this.buttonCooldowns[button] = true;
      // Reset cooldown after short delay
      setTimeout(() => {
        this.buttonCooldowns[button] = false;
      }, 200);
      return true;
    }
    return false;
  }

  getLeftController(): THREE.Group {
    return this.leftController;
  }

  getRightController(): THREE.Group {
    return this.rightController;
  }

  getRightControllerDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();
    this.rightController.getWorldDirection(direction);
    return direction;
  }

  getLeftControllerDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3();
    this.leftController.getWorldDirection(direction);
    return direction;
  }

  // Move the VR player group (for locomotion)
  moveVRPlayer(movement: THREE.Vector3): void {
    if (!this.isVRActive()) return;

    // Apply movement to VR player group (dolly)
    // This moves our reference frame, effectively moving the player in VR
    this.vrPlayerGroup.position.add(movement);
  }

  // Get VR player position (now 1:1 coordinates)
  getVRPlayerPosition(): THREE.Vector3 {
    return this.vrPlayerGroup.position.clone();
  }

  // Set VR player position (now 1:1 coordinates)
  setVRPlayerPosition(position: THREE.Vector3): void {
    this.vrPlayerGroup.position.copy(position);
  }

  // Get head position in world coordinates for gameplay logic
  getHeadPosition(): THREE.Vector3 {
    if (!this.isVRActive()) return this.camera.position.clone();

    // In VR, we need to combine dolly position with camera's local VR position
    const headPos = new THREE.Vector3();
    this.camera.getWorldPosition(headPos);
    // Add the dolly offset
    headPos.add(this.vrPlayerGroup.position);
    return headPos;
  }

  // Get head rotation for gameplay logic
  getHeadRotation(): THREE.Quaternion {
    if (!this.isVRActive()) return this.camera.quaternion.clone();

    const headRot = new THREE.Quaternion();
    this.camera.getWorldQuaternion(headRot);
    return headRot;
  }

  // Set reference to weapon system for VR weapon attachment
  setFirstPersonWeapon(firstPersonWeapon: any): void {
    this.firstPersonWeapon = firstPersonWeapon;
  }

  // Set reference to player controller for position sync
  setPlayerController(playerController: any): void {
    this.playerController = playerController;
  }
}