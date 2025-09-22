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

    // Use camera's current world position - this is exactly where the player is in desktop mode
    const currentPlayerPosition = this.camera.position.clone();
    console.log(`🥽 Entering VR from desktop position: ${currentPlayerPosition.x.toFixed(1)}, ${currentPlayerPosition.y.toFixed(1)}, ${currentPlayerPosition.z.toFixed(1)}`);

    // Now that VR is active, move camera to VR group and apply VR settings
    this.camera.parent?.remove(this.camera);
    this.vrPlayerGroup.add(this.camera);

    // Use 1:1 scale (no scaling needed with WebXR standard)
    this.vrPlayerGroup.scale.setScalar(this.VR_SCALE);

    // Set VR standing height (1.6m - standard human height)
    this.camera.position.set(0, 1.6, 0);

    // Position VR player group at current game position to maintain terrain alignment
    this.vrPlayerGroup.position.copy(currentPlayerPosition);
    this.vrPlayerGroup.position.y -= 1.6; // Offset for camera height within group
    this.vrPlayerGroup.rotation.set(0, 0, 0);

    console.log(`🥽 VR player group positioned at: ${this.vrPlayerGroup.position.x.toFixed(1)}, ${this.vrPlayerGroup.position.y.toFixed(1)}, ${this.vrPlayerGroup.position.z.toFixed(1)}`);
    console.log(`🥽 Camera position within VR group: ${this.camera.position.x.toFixed(1)}, ${this.camera.position.y.toFixed(1)}, ${this.camera.position.z.toFixed(1)}`);

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

    // Return camera to scene and restore normal positioning
    this.vrPlayerGroup.remove(this.camera);
    this.scene.add(this.camera);

    // Reset VR group scale to 1:1
    this.vrPlayerGroup.scale.setScalar(1);

    // Reset camera position to normal desktop position (1.8m height)
    this.camera.position.set(0, 1.8, 0);
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
  }

  private updateControllerInputs(): void {
    if (!this.vrSession) return;

    // Poll gamepad data for thumbsticks
    for (const source of this.vrSession.inputSources) {
      if (source.gamepad) {
        const gamepad = source.gamepad;
        const handedness = source.handedness;

        if (handedness === 'left') {
          // Left thumbstick for movement
          this.controllerInputs.leftThumbstick.x = this.applyDeadzone(gamepad.axes[2] || 0);
          this.controllerInputs.leftThumbstick.z = this.applyDeadzone(gamepad.axes[3] || 0);

          // Left controller buttons (X and Y)
          this.controllerInputs.xButton = gamepad.buttons[4] ? gamepad.buttons[4].pressed : false;
          this.controllerInputs.yButton = gamepad.buttons[5] ? gamepad.buttons[5].pressed : false;
        } else if (handedness === 'right') {
          // Right thumbstick for turning
          this.controllerInputs.rightThumbstick.x = this.applyDeadzone(gamepad.axes[2] || 0);
          this.controllerInputs.rightThumbstick.y = this.applyDeadzone(gamepad.axes[3] || 0);

          // Right controller buttons (A and B)
          this.controllerInputs.aButton = gamepad.buttons[4] ? gamepad.buttons[4].pressed : false;
          this.controllerInputs.bButton = gamepad.buttons[5] ? gamepad.buttons[5].pressed : false;
        }
      }
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

    // Apply movement to VR player group
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

    const headPos = new THREE.Vector3();
    this.camera.getWorldPosition(headPos);
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