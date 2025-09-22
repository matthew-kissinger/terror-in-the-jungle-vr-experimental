import * as THREE from 'three';

/**
 * Input state shared between VR and desktop
 */
export interface InputState {
  // Movement
  movement: THREE.Vector2;      // X/Z movement input (-1 to 1)
  vertical: number;              // Jump/crouch input
  sprint: boolean;               // Sprint modifier

  // Look
  lookDelta: THREE.Vector2;      // Mouse/thumbstick look delta

  // Actions
  primaryFire: boolean;          // Left click / Right trigger
  secondaryFire: boolean;        // Right click / Left trigger
  interact: boolean;             // E key / A button
  reload: boolean;               // R key / X button
  jump: boolean;                 // Space / A button (edge triggered)

  // Menu
  menu: boolean;                 // Escape / Menu button
}

/**
 * Abstract input source interface
 */
export interface InputSource {
  update(deltaTime: number): void;
  getState(): InputState;
  reset(): void;
}

/**
 * Desktop keyboard/mouse input implementation
 */
export class DesktopInput implements InputSource {
  private state: InputState;
  private keys: Set<string> = new Set();
  private mouseMovement: THREE.Vector2 = new THREE.Vector2();
  private mouseSensitivity = 0.002;
  private isPointerLocked = false;

  constructor() {
    this.state = this.createEmptyState();
    this.setupEventListeners();
  }

  private createEmptyState(): InputState {
    return {
      movement: new THREE.Vector2(),
      vertical: 0,
      sprint: false,
      lookDelta: new THREE.Vector2(),
      primaryFire: false,
      secondaryFire: false,
      interact: false,
      reload: false,
      jump: false,
      menu: false
    };
  }

  private setupEventListeners(): void {
    // Keyboard
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));

    // Mouse
    document.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
    document.addEventListener('mousemove', this.onMouseMove.bind(this));

    // Pointer lock
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
  }

  private onKeyDown(event: KeyboardEvent): void {
    this.keys.add(event.code.toLowerCase());
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.code.toLowerCase());
  }

  private onMouseDown(event: MouseEvent): void {
    if (event.button === 0) this.state.primaryFire = true;
    if (event.button === 2) this.state.secondaryFire = true;
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button === 0) this.state.primaryFire = false;
    if (event.button === 2) this.state.secondaryFire = false;
  }

  private onMouseMove(event: MouseEvent): void {
    if (this.isPointerLocked) {
      this.mouseMovement.x += event.movementX;
      this.mouseMovement.y += event.movementY;
    }
  }

  private onPointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement === document.body;
  }

  public update(deltaTime: number): void {
    // Movement from WASD
    this.state.movement.set(0, 0);
    if (this.keys.has('keyw')) this.state.movement.y -= 1;
    if (this.keys.has('keys')) this.state.movement.y += 1;
    if (this.keys.has('keya')) this.state.movement.x -= 1;
    if (this.keys.has('keyd')) this.state.movement.x += 1;

    // Normalize diagonal movement
    if (this.state.movement.length() > 1) {
      this.state.movement.normalize();
    }

    // Sprint
    this.state.sprint = this.keys.has('shiftleft') || this.keys.has('shiftright');

    // Jump (edge triggered)
    const jumpPressed = this.keys.has('space');
    this.state.jump = jumpPressed && !this.state.jump;

    // Actions
    this.state.interact = this.keys.has('keye');
    this.state.reload = this.keys.has('keyr');
    this.state.menu = this.keys.has('escape');

    // Look delta from mouse
    this.state.lookDelta.x = this.mouseMovement.x * this.mouseSensitivity;
    this.state.lookDelta.y = this.mouseMovement.y * this.mouseSensitivity;

    // Reset mouse movement
    this.mouseMovement.set(0, 0);
  }

  public getState(): InputState {
    return { ...this.state };
  }

  public reset(): void {
    this.state = this.createEmptyState();
    this.mouseMovement.set(0, 0);
  }
}

/**
 * VR controller input implementation
 */
export class VRInput implements InputSource {
  private state: InputState;
  private vrSession: XRSession | null = null;
  private lastButtonStates: Map<string, boolean> = new Map();

  constructor(private renderer: THREE.WebGLRenderer) {
    this.state = this.createEmptyState();
  }

  private createEmptyState(): InputState {
    return {
      movement: new THREE.Vector2(),
      vertical: 0,
      sprint: false,
      lookDelta: new THREE.Vector2(),
      primaryFire: false,
      secondaryFire: false,
      interact: false,
      reload: false,
      jump: false,
      menu: false
    };
  }

  public setVRSession(session: XRSession | null): void {
    this.vrSession = session;
  }

  public update(deltaTime: number): void {
    if (!this.vrSession) return;

    for (const source of this.vrSession.inputSources) {
      if (!source.gamepad) continue;

      const gamepad = source.gamepad;
      const hand = source.handedness;

      if (hand === 'left') {
        // Left thumbstick for movement
        this.state.movement.x = this.applyDeadzone(gamepad.axes[2] || 0);
        this.state.movement.y = -this.applyDeadzone(gamepad.axes[3] || 0); // Invert Y

        // Left trigger for secondary fire
        this.state.secondaryFire = gamepad.buttons[0]?.value > 0.5;

        // Left grip for sprint
        this.state.sprint = gamepad.buttons[1]?.pressed || false;

        // X button for reload
        this.state.reload = this.isButtonPressed('x', gamepad.buttons[4]?.pressed);

        // Y button for menu
        this.state.menu = this.isButtonPressed('y', gamepad.buttons[5]?.pressed);

      } else if (hand === 'right') {
        // Right thumbstick for turning (snap turn)
        const turnX = this.applyDeadzone(gamepad.axes[2] || 0);
        if (Math.abs(turnX) > 0.7) {
          // Snap turn - only trigger once per stick movement
          if (!this.lastButtonStates.get('snapTurn')) {
            this.state.lookDelta.x = turnX > 0 ? Math.PI / 6 : -Math.PI / 6;
            this.lastButtonStates.set('snapTurn', true);
          }
        } else {
          this.lastButtonStates.set('snapTurn', false);
          this.state.lookDelta.x = 0;
        }

        // Right trigger for primary fire
        this.state.primaryFire = gamepad.buttons[0]?.value > 0.5;

        // Right grip (could be used for grab/climb)
        const rightGrip = gamepad.buttons[1]?.pressed || false;

        // A button for jump/interact
        this.state.interact = this.isButtonPressed('a', gamepad.buttons[4]?.pressed);
        this.state.jump = this.state.interact; // Same button

        // B button (could be crouch/prone)
        const bButton = gamepad.buttons[5]?.pressed || false;
      }
    }
  }

  private applyDeadzone(value: number, deadzone = 0.2): number {
    return Math.abs(value) > deadzone ? value : 0;
  }

  private isButtonPressed(button: string, currentState: boolean = false): boolean {
    const wasPressed = this.lastButtonStates.get(button) || false;
    this.lastButtonStates.set(button, currentState);
    return currentState && !wasPressed; // Edge trigger
  }

  public getState(): InputState {
    return { ...this.state };
  }

  public reset(): void {
    this.state = this.createEmptyState();
    this.lastButtonStates.clear();
  }
}

/**
 * Unified input manager that switches between VR and desktop input
 */
export class InputManager {
  private desktopInput: DesktopInput;
  private vrInput: VRInput;
  private activeInput: InputSource;
  private isVRActive = false;

  constructor(renderer: THREE.WebGLRenderer) {
    this.desktopInput = new DesktopInput();
    this.vrInput = new VRInput(renderer);
    this.activeInput = this.desktopInput;

    // Listen for VR session changes
    renderer.xr.addEventListener('sessionstart', () => this.onVRSessionStart());
    renderer.xr.addEventListener('sessionend', () => this.onVRSessionEnd());
  }

  private onVRSessionStart(): void {
    console.log('🎮 InputManager: Switching to VR input');
    this.isVRActive = true;
    this.activeInput = this.vrInput;
    const session = (this.vrInput as any).renderer.xr.getSession();
    this.vrInput.setVRSession(session);
  }

  private onVRSessionEnd(): void {
    console.log('🎮 InputManager: Switching to desktop input');
    this.isVRActive = false;
    this.activeInput = this.desktopInput;
    this.vrInput.setVRSession(null);
  }

  public update(deltaTime: number): void {
    this.activeInput.update(deltaTime);
  }

  public getState(): InputState {
    return this.activeInput.getState();
  }

  public reset(): void {
    this.activeInput.reset();
  }

  public getIsVRActive(): boolean {
    return this.isVRActive;
  }

  public requestPointerLock(): void {
    if (!this.isVRActive) {
      document.body.requestPointerLock();
    }
  }
}