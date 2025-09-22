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

  // VR scale factor (game units to VR meters)
  public readonly VR_SCALE = 0.1; // 10 game units = 1 VR meter

  // Controller input state
  private controllerInputs = {
    leftThumbstick: { x: 0, z: 0 },
    rightThumbstick: { x: 0, y: 0 },
    leftTrigger: 0,
    rightTrigger: 0,
    leftGrip: false,
    rightGrip: false
  };

  // VR session state
  private vrSession: XRSession | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.controllerModelFactory = new XRControllerModelFactory();

    // Create VR player group
    this.vrPlayerGroup = new THREE.Group();
    this.vrPlayerGroup.name = 'VRPlayerGroup';

    // Scale the entire player group for VR
    this.vrPlayerGroup.scale.setScalar(this.VR_SCALE);

    // Add camera to VR group
    this.vrPlayerGroup.add(this.camera);

    // Set VR standing height (1.6m in VR space, scaled to game units)
    this.camera.position.set(0, 1.6 / this.VR_SCALE, 0);

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

    // Reset VR player group position
    this.vrPlayerGroup.position.set(0, 0, 0);
    this.vrPlayerGroup.rotation.set(0, 0, 0);
  }

  private onVRSessionEnd(): void {
    this.vrSession = null;
    console.log('🥽 VR session ended');
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
        } else if (handedness === 'right') {
          // Right thumbstick for turning (optional)
          this.controllerInputs.rightThumbstick.x = this.applyDeadzone(gamepad.axes[2] || 0);
          this.controllerInputs.rightThumbstick.y = this.applyDeadzone(gamepad.axes[3] || 0);
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

  // Get VR player position in game coordinates
  getVRPlayerPosition(): THREE.Vector3 {
    const position = this.vrPlayerGroup.position.clone();
    // Convert from VR space back to game coordinates
    position.divideScalar(this.VR_SCALE);
    return position;
  }

  // Set VR player position from game coordinates
  setVRPlayerPosition(position: THREE.Vector3): void {
    const vrPosition = position.clone();
    // Convert from game coordinates to VR space
    vrPosition.multiplyScalar(this.VR_SCALE);
    this.vrPlayerGroup.position.copy(vrPosition);
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
}