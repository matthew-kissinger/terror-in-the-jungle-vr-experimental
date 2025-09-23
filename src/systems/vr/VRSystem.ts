import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { CameraRig } from '../camera/CameraRig';
import { InputManager } from '../input/InputManager';
import { GameSystem } from '../../types';

/**
 * Modern VR System implementation using proper WebXR patterns
 * Handles VR session management, controllers, and locomotion
 */
// Controller input state matching VRManager interface
export interface ControllerInputs {
  // Movement
  leftThumbstickX: number;
  leftThumbstickZ: number;
  rightThumbstickX: number;
  rightThumbstickY: number;

  // Triggers (analog 0-1)
  leftTrigger: number;
  rightTrigger: number;

  // Grips (boolean)
  leftGrip: boolean;
  rightGrip: boolean;

  // Buttons (boolean)
  aButton: boolean;
  bButton: boolean;
  xButton: boolean;
  yButton: boolean;
}

export class VRSystem implements GameSystem {
  // Core references
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private cameraRig: CameraRig;
  private inputManager: InputManager;

  // XR components
  private xrSession: XRSession | null = null;
  private xrReferenceSpace: XRReferenceSpace | null = null;
  private baseReferenceSpace: XRReferenceSpace | null = null;

  // Controllers
  private controllers: THREE.Group[] = [];
  private controllerGrips: THREE.Group[] = [];
  private controllerModelFactory: XRControllerModelFactory;

  // Teleportation
  private teleportMarker?: THREE.Mesh;
  private teleportRaycaster: THREE.Raycaster;
  private isTeleporting = false;

  // Hand tracking (future)
  private hands: THREE.Group[] = [];

  // Locomotion settings
  private locomotionSpeed = 3.0; // m/s
  private snapTurnAngle = Math.PI / 6; // 30 degrees
  private teleportEnabled = true;
  private smoothLocomotion = true;

  // Input state management (from VRManager)
  private controllerInputs: ControllerInputs = {
    leftThumbstickX: 0,
    leftThumbstickZ: 0,
    rightThumbstickX: 0,
    rightThumbstickY: 0,
    leftTrigger: 0,
    rightTrigger: 0,
    leftGrip: false,
    rightGrip: false,
    aButton: false,
    bButton: false,
    xButton: false,
    yButton: false
  };

  // Button press detection with cooldown
  private buttonCooldowns: Map<string, number> = new Map();
  private readonly BUTTON_COOLDOWN = 500; // ms
  private readonly THUMBSTICK_DEADZONE = 0.2;

  // Game system references (from VRManager)
  private firstPersonWeapon?: any;
  private playerController?: any;

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    cameraRig: CameraRig,
    inputManager: InputManager
  ) {
    this.scene = scene;
    this.renderer = renderer;
    this.cameraRig = cameraRig;
    this.inputManager = inputManager;

    this.controllerModelFactory = new XRControllerModelFactory();
    this.teleportRaycaster = new THREE.Raycaster();

    this.setupXR();
    this.setupControllers();
    this.setupTeleportation();
  }

  /**
   * Configure WebXR
   */
  private setupXR(): void {
    // Enable XR
    this.renderer.xr.enabled = true;

    // Set reference space type
    this.renderer.xr.setReferenceSpaceType('local-floor');

    // Listen for session events
    this.renderer.xr.addEventListener('sessionstart', () => this.onSessionStart());
    this.renderer.xr.addEventListener('sessionend', () => this.onSessionEnd());

    console.log('🥽 VRSystem: WebXR configured');
  }

  /**
   * Setup VR controllers
   */
  private setupControllers(): void {
    for (let i = 0; i < 2; i++) {
      // Get controller
      const controller = this.renderer.xr.getController(i);
      controller.name = `Controller${i}`;
      this.controllers.push(controller);

      // Add to camera rig dolly so controllers move with player
      this.cameraRig.dolly.add(controller);

      // Setup controller events
      controller.addEventListener('selectstart', () => this.onSelectStart(i));
      controller.addEventListener('selectend', () => this.onSelectEnd(i));
      controller.addEventListener('squeeze', () => this.onSqueeze(i));
      controller.addEventListener('connected', (event: any) => this.onControllerConnected(event, i));
      controller.addEventListener('disconnected', () => this.onControllerDisconnected(i));

      // Get grip space for controller models
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.name = `ControllerGrip${i}`;
      this.controllerGrips.push(grip);

      // Add controller model
      const model = this.controllerModelFactory.createControllerModel(grip);
      grip.add(model);

      // Add to camera rig dolly
      this.cameraRig.dolly.add(grip);

      // Setup hand tracking (for future use)
      const hand = this.renderer.xr.getHand(i);
      hand.name = `Hand${i}`;
      this.hands.push(hand);
      this.cameraRig.dolly.add(hand);
    }

    console.log('🎮 VRSystem: Controllers configured');
  }

  /**
   * Setup teleportation system
   */
  private setupTeleportation(): void {
    // Create teleport marker
    const geometry = new THREE.RingGeometry(0.15, 0.3, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5
    });
    this.teleportMarker = new THREE.Mesh(geometry, material);
    this.teleportMarker.rotation.x = -Math.PI / 2;
    this.teleportMarker.visible = false;
    this.scene.add(this.teleportMarker);

    // Create teleport line
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(100 * 3);
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 2,
      transparent: true,
      opacity: 0.5
    });

    for (let i = 0; i < 2; i++) {
      const line = new THREE.Line(lineGeometry.clone(), lineMaterial.clone());
      line.name = `TeleportLine${i}`;
      line.visible = false;
      this.controllers[i].add(line);
    }
  }

  /**
   * Called when VR session starts
   */
  private async onSessionStart(): Promise<void> {
    console.log('🥽 VR session started');

    this.xrSession = this.renderer.xr.getSession();
    if (!this.xrSession) return;

    // Get reference spaces
    try {
      this.baseReferenceSpace = await this.xrSession.requestReferenceSpace('local-floor');
      this.xrReferenceSpace = this.baseReferenceSpace;

      // Enter VR mode in camera rig
      this.cameraRig.enterVR();

      // Apply initial offset based on current player position
      this.updateReferenceSpaceOffset();

      // Attach weapon to VR controller (from VRManager)
      if (this.firstPersonWeapon) {
        const rightController = this.getRightController();
        if (rightController) {
          this.firstPersonWeapon.attachToVR(rightController);
        }
      }

      // Sync position with PlayerController (from VRManager)
      if (this.playerController) {
        const playerPos = this.playerController.getPlayerPosition();
        this.setVRPlayerPosition(new THREE.Vector3(playerPos.x, 0, playerPos.z));
      }

    } catch (error) {
      console.error('Failed to get reference space:', error);
    }
  }

  /**
   * Called when VR session ends
   */
  private onSessionEnd(): void {
    console.log('🥽 VR session ended');

    // Detach weapon from VR (from VRManager)
    if (this.firstPersonWeapon) {
      this.firstPersonWeapon.detachFromVR();
    }

    this.xrSession = null;
    this.xrReferenceSpace = null;
    this.baseReferenceSpace = null;

    // Exit VR mode in camera rig
    this.cameraRig.exitVR();

    // Hide teleport marker
    if (this.teleportMarker) {
      this.teleportMarker.visible = false;
    }

    // Sync position back to PlayerController (from VRManager)
    if (this.playerController) {
      const vrPos = this.getVRPlayerPosition();
      this.playerController.setPlayerPosition(vrPos);
    }
  }

  /**
   * Update reference space offset to position player in world
   */
  private updateReferenceSpaceOffset(): void {
    if (!this.baseReferenceSpace || !this.xrSession) return;

    // Get current dolly position (where we want the player to be)
    const dollyPos = this.cameraRig.dolly.position;

    // Create transform to offset reference space
    const offsetTransform = new XRRigidTransform(
      { x: dollyPos.x, y: dollyPos.y, z: dollyPos.z },
      { x: 0, y: 0, z: 0, w: 1 }
    );

    // Apply offset to reference space
    this.xrReferenceSpace = this.baseReferenceSpace.getOffsetReferenceSpace(offsetTransform);

    // Reference space is updated internally, no need to set it in render state
    // The offset reference space will be used automatically

    console.log(`🥽 Reference space offset to: ${dollyPos.x.toFixed(1)}, ${dollyPos.y.toFixed(1)}, ${dollyPos.z.toFixed(1)}`);
  }

  /**
   * Controller connected event
   */
  private onControllerConnected(event: any, index: number): void {
    const controller = this.controllers[index];
    const data = event.data;

    controller.userData.handedness = data.handedness;
    controller.userData.gamepad = data.gamepad;

    console.log(`🎮 Controller ${index} connected: ${data.handedness} hand`);

    // Add visual indicator for controller
    if (data.targetRayMode === 'tracked-pointer') {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
      ]);
      const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2
      });
      const line = new THREE.Line(geometry, material);
      line.name = 'ControllerRay';
      line.scale.z = 5;
      controller.add(line);
    }
  }

  /**
   * Controller disconnected event
   */
  private onControllerDisconnected(index: number): void {
    const controller = this.controllers[index];
    console.log(`🎮 Controller ${index} disconnected`);

    // Remove visual indicators
    const ray = controller.getObjectByName('ControllerRay');
    if (ray) controller.remove(ray);
  }

  /**
   * Handle trigger press (select)
   */
  private onSelectStart(index: number): void {
    const controller = this.controllers[index];
    const handedness = controller.userData.handedness;

    if (handedness === 'left' && this.teleportEnabled) {
      // Left controller: Start teleport
      this.isTeleporting = true;
    }
    // Right controller handled by InputManager for shooting
  }

  /**
   * Handle trigger release
   */
  private onSelectEnd(index: number): void {
    const controller = this.controllers[index];
    const handedness = controller.userData.handedness;

    if (handedness === 'left' && this.isTeleporting) {
      // Execute teleport
      this.executeTeleport(controller);
      this.isTeleporting = false;
    }
  }

  /**
   * Handle squeeze button (grip)
   */
  private onSqueeze(index: number): void {
    // Could be used for grab mechanics
  }

  /**
   * Update teleportation visualization
   */
  private updateTeleportation(): void {
    if (!this.isTeleporting || !this.teleportMarker) return;

    // Get left controller (teleport controller)
    const controller = this.controllers[0];
    if (!controller.userData.handedness || controller.userData.handedness !== 'left') return;

    // Cast ray from controller
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    this.teleportRaycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.teleportRaycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    // Find intersection with ground/terrain
    const intersects = this.teleportRaycaster.intersectObjects(this.scene.children, true);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      this.teleportMarker.position.copy(point);
      this.teleportMarker.visible = true;

      // Update teleport line
      const line = controller.getObjectByName('TeleportLine0') as THREE.Line;
      if (line) {
        const positions = line.geometry.attributes.position.array as Float32Array;
        const controllerPos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);

        // Create arc from controller to target
        for (let i = 0; i < 30; i++) {
          const t = i / 29;
          positions[i * 3] = 0;
          positions[i * 3 + 1] = -t * 2 * (1 - t); // Parabolic arc
          positions[i * 3 + 2] = -t * point.distanceTo(controllerPos);
        }

        line.geometry.attributes.position.needsUpdate = true;
        line.visible = true;
      }
    } else {
      this.teleportMarker.visible = false;
    }
  }

  /**
   * Execute teleportation
   */
  private executeTeleport(controller: THREE.Group): void {
    if (!this.teleportMarker || !this.teleportMarker.visible) return;

    // Teleport to marker position
    const targetPos = this.teleportMarker.position.clone();
    this.cameraRig.teleport(targetPos);

    // Update reference space offset
    this.updateReferenceSpaceOffset();

    // Hide marker
    this.teleportMarker.visible = false;

    console.log(`🎯 Teleported to: ${targetPos.x.toFixed(1)}, ${targetPos.y.toFixed(1)}, ${targetPos.z.toFixed(1)}`);
  }

  /**
   * Update smooth locomotion from thumbsticks
   */
  private updateLocomotion(deltaTime: number): void {
    if (!this.smoothLocomotion || !this.xrSession) return;

    const inputState = this.inputManager.getState();

    // Apply movement
    if (inputState.movement.length() > 0) {
      // Get head direction for movement orientation
      const headDirection = this.cameraRig.getForwardDirection();
      headDirection.y = 0;
      headDirection.normalize();

      const rightDirection = new THREE.Vector3();
      rightDirection.crossVectors(headDirection, new THREE.Vector3(0, 1, 0));

      // Calculate movement vector
      const movement = new THREE.Vector3();
      movement.addScaledVector(rightDirection, inputState.movement.x * this.locomotionSpeed * deltaTime);
      // Negate Y for VR controllers - pushing up on thumbstick should move forward
      movement.addScaledVector(headDirection, -inputState.movement.y * this.locomotionSpeed * deltaTime);

      // Apply movement to camera rig
      this.cameraRig.move(movement);

      // Update reference space offset
      this.updateReferenceSpaceOffset();
    }

    // Apply snap turn
    if (Math.abs(inputState.lookDelta.x) > 0) {
      this.cameraRig.dolly.rotation.y += inputState.lookDelta.x;
    }
  }

  /**
   * Update controller input states from gamepads
   */
  private updateControllerInputs(): void {
    // Reset inputs
    this.controllerInputs = {
      leftThumbstickX: 0,
      leftThumbstickZ: 0,
      rightThumbstickX: 0,
      rightThumbstickY: 0,
      leftTrigger: 0,
      rightTrigger: 0,
      leftGrip: false,
      rightGrip: false,
      aButton: false,
      bButton: false,
      xButton: false,
      yButton: false
    };

    // Update from each controller
    for (const controller of this.controllers) {
      const gamepad = controller.userData.gamepad;
      if (!gamepad) continue;

      const isLeft = controller.userData.handedness === 'left';
      const isRight = controller.userData.handedness === 'right';

      try {
        if (isLeft) {
          // Left thumbstick (axes 2,3 on Quest controllers)
          if (gamepad.axes && gamepad.axes.length >= 4) {
            const x = gamepad.axes[2] || 0;
            const z = gamepad.axes[3] || 0;
            // Apply deadzone
            this.controllerInputs.leftThumbstickX = Math.abs(x) > this.THUMBSTICK_DEADZONE ? x : 0;
            this.controllerInputs.leftThumbstickZ = Math.abs(z) > this.THUMBSTICK_DEADZONE ? z : 0;
          }

          // Left trigger (button 0)
          if (gamepad.buttons && gamepad.buttons[0]) {
            this.controllerInputs.leftTrigger = gamepad.buttons[0].value || 0;
          }

          // Left grip (button 1)
          if (gamepad.buttons && gamepad.buttons[1]) {
            this.controllerInputs.leftGrip = gamepad.buttons[1].pressed || false;
          }

          // X button (button 4)
          if (gamepad.buttons && gamepad.buttons[4]) {
            this.controllerInputs.xButton = gamepad.buttons[4].pressed || false;
          }

          // Y button (button 5)
          if (gamepad.buttons && gamepad.buttons[5]) {
            this.controllerInputs.yButton = gamepad.buttons[5].pressed || false;
          }
        }

        if (isRight) {
          // Right thumbstick (axes 2,3 on Quest controllers)
          if (gamepad.axes && gamepad.axes.length >= 4) {
            const x = gamepad.axes[2] || 0;
            const y = gamepad.axes[3] || 0;
            // Apply deadzone
            this.controllerInputs.rightThumbstickX = Math.abs(x) > this.THUMBSTICK_DEADZONE ? x : 0;
            this.controllerInputs.rightThumbstickY = Math.abs(y) > this.THUMBSTICK_DEADZONE ? y : 0;
          }

          // Right trigger (button 0)
          if (gamepad.buttons && gamepad.buttons[0]) {
            this.controllerInputs.rightTrigger = gamepad.buttons[0].value || 0;
          }

          // Right grip (button 1)
          if (gamepad.buttons && gamepad.buttons[1]) {
            this.controllerInputs.rightGrip = gamepad.buttons[1].pressed || false;
          }

          // A button (button 4)
          if (gamepad.buttons && gamepad.buttons[4]) {
            this.controllerInputs.aButton = gamepad.buttons[4].pressed || false;
          }

          // B button (button 5)
          if (gamepad.buttons && gamepad.buttons[5]) {
            this.controllerInputs.bButton = gamepad.buttons[5].pressed || false;
          }
        }
      } catch (e) {
        console.warn('⚠️ VRSystem: Error reading controller buttons:', e);
      }
    }
  }

  /**
   * Check if a button was pressed (with cooldown)
   */
  public isButtonPressed(button: string): boolean {
    const now = Date.now();
    const lastPress = this.buttonCooldowns.get(button) || 0;

    // Check if cooldown has expired
    if (now - lastPress < this.BUTTON_COOLDOWN) {
      return false;
    }

    // Check button state
    let isPressed = false;
    switch (button) {
      case 'aButton': isPressed = this.controllerInputs.aButton; break;
      case 'bButton': isPressed = this.controllerInputs.bButton; break;
      case 'xButton': isPressed = this.controllerInputs.xButton; break;
      case 'yButton': isPressed = this.controllerInputs.yButton; break;
      case 'leftGrip': isPressed = this.controllerInputs.leftGrip; break;
      case 'rightGrip': isPressed = this.controllerInputs.rightGrip; break;
      case 'leftTrigger': isPressed = this.controllerInputs.leftTrigger > 0.5; break;
      case 'rightTrigger': isPressed = this.controllerInputs.rightTrigger > 0.5; break;
    }

    if (isPressed) {
      this.buttonCooldowns.set(button, now);
      return true;
    }

    return false;
  }

  /**
   * GameSystem interface
   */
  async init(): Promise<void> {
    console.log('🥽 VRSystem initialized');
  }

  update(deltaTime: number): void {
    if (!this.renderer.xr.isPresenting) return;

    // Update controller inputs
    this.updateControllerInputs();

    // Update teleportation visualization
    this.updateTeleportation();

    // Update smooth locomotion
    this.updateLocomotion(deltaTime);
  }

  dispose(): void {
    // Clean up controllers
    for (const controller of this.controllers) {
      this.cameraRig.dolly.remove(controller);
    }

    for (const grip of this.controllerGrips) {
      this.cameraRig.dolly.remove(grip);
    }

    // Clean up teleport marker
    if (this.teleportMarker) {
      this.scene.remove(this.teleportMarker);
    }

    console.log('🧹 VRSystem disposed');
  }

  /**
   * Public API
   */
  public isVRActive(): boolean {
    return this.renderer.xr.isPresenting;
  }

  public getControllers(): THREE.Group[] {
    return this.controllers;
  }

  public getRightController(): THREE.Group | null {
    for (const controller of this.controllers) {
      if (controller.userData.handedness === 'right') {
        return controller;
      }
    }
    return null;
  }

  public getLeftController(): THREE.Group | null {
    for (const controller of this.controllers) {
      if (controller.userData.handedness === 'left') {
        return controller;
      }
    }
    return null;
  }

  public setTeleportEnabled(enabled: boolean): void {
    this.teleportEnabled = enabled;
  }

  public setSmoothLocomotion(enabled: boolean): void {
    this.smoothLocomotion = enabled;
  }

  /**
   * Get controller input state (from VRManager API)
   */
  public getControllerInputs(): ControllerInputs {
    return this.controllerInputs;
  }

  /**
   * Get right controller direction for aiming (from VRManager API)
   */
  public getRightControllerDirection(): THREE.Vector3 | null {
    const controller = this.getRightController();
    if (!controller) return null;

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(controller.quaternion);
    return direction;
  }

  /**
   * Get left controller direction (from VRManager API)
   */
  public getLeftControllerDirection(): THREE.Vector3 | null {
    const controller = this.getLeftController();
    if (!controller) return null;

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(controller.quaternion);
    return direction;
  }

  /**
   * Get head position in world space (from VRManager API)
   */
  public getHeadPosition(): THREE.Vector3 {
    // Camera position in dolly space + dolly position in world
    const headPos = this.cameraRig.camera.position.clone();
    headPos.add(this.cameraRig.dolly.position);
    return headPos;
  }

  /**
   * Get head rotation (from VRManager API)
   */
  public getHeadRotation(): THREE.Quaternion {
    return this.cameraRig.camera.quaternion.clone();
  }

  /**
   * Move VR player in world space (from VRManager API)
   */
  public moveVRPlayer(movement: THREE.Vector3): void {
    this.cameraRig.move(movement);
    this.updateReferenceSpaceOffset();
  }

  /**
   * Get VR player position (from VRManager API)
   */
  public getVRPlayerPosition(): THREE.Vector3 {
    return this.cameraRig.dolly.position.clone();
  }

  /**
   * Set VR player position (from VRManager API)
   */
  public setVRPlayerPosition(position: THREE.Vector3): void {
    this.cameraRig.setPosition(position);
    this.updateReferenceSpaceOffset();
  }

  /**
   * Set first person weapon reference (from VRManager API)
   */
  public setFirstPersonWeapon(weapon: any): void {
    this.firstPersonWeapon = weapon;
  }

  /**
   * Set player controller reference (from VRManager API)
   */
  public setPlayerController(controller: any): void {
    this.playerController = controller;
  }
}