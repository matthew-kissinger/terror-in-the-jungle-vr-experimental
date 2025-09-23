import * as THREE from 'three';
import { Text } from 'troika-three-text';

/**
 * VR HUD System - Spatial UI for VR gameplay
 *
 * Controller Mappings (Quest-optimized):
 * LEFT CONTROLLER:
 * - Thumbstick: Movement
 * - Thumbstick Click: Toggle crouch
 * - Trigger: Sprint (hold)
 * - Grip: Show wrist display (hold)
 * - X Button: Toggle minimap
 * - Y Button: Toggle full map
 *
 * RIGHT CONTROLLER:
 * - Thumbstick: Turn/Look
 * - Thumbstick Click: Toggle snap/smooth turn
 * - Trigger: Fire weapon
 * - Grip: Future grab/climb
 * - A Button: Jump
 * - B Button: Reload
 *
 * UI Components:
 * - Wrist Display: Health, ammo, compass (left controller)
 * - Minimap Panel: Tactical 40cm panel
 * - Full Map Panel: Strategic 120cm panel
 * - Combat HUD: Hit markers, damage indicators
 */

interface VRHUDConfig {
  scene: THREE.Scene;
  camera: THREE.Camera;
  leftController?: THREE.Group;
  rightController?: THREE.Group;
}

export class VRHUDSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private hudGroup: THREE.Group;

  // Controller references
  private leftController?: THREE.Group;
  private rightController?: THREE.Group;

  // UI Panels
  private wristDisplay?: WristDisplay;
  private minimapPanel?: MinimapPanel;
  private fullMapPanel?: FullMapPanel;
  private combatHUD?: CombatHUD;

  // Panel visibility states
  private minimapVisible = false;
  private fullMapVisible = false;
  private wristDisplayVisible = true;

  constructor(config: VRHUDConfig) {
    this.scene = config.scene;
    this.camera = config.camera;
    this.leftController = config.leftController;
    this.rightController = config.rightController;

    this.hudGroup = new THREE.Group();
    this.hudGroup.name = 'VRHUDSystem';

    this.initializeHUDComponents();
  }

  private initializeHUDComponents(): void {
    // Create wrist display attached to left controller
    if (this.leftController) {
      this.wristDisplay = new WristDisplay();
      this.leftController.add(this.wristDisplay.group);
    }

    // Create floating minimap panel
    this.minimapPanel = new MinimapPanel();
    this.hudGroup.add(this.minimapPanel.group);

    // Create full map panel
    this.fullMapPanel = new FullMapPanel();
    this.hudGroup.add(this.fullMapPanel.group);

    // Create combat HUD (always visible during combat)
    this.combatHUD = new CombatHUD();
    this.hudGroup.add(this.combatHUD.group);

    // Add HUD group to scene
    this.scene.add(this.hudGroup);

    console.log('🎮 VR HUD System initialized');
  }

  /**
   * Handle controller button inputs for UI toggling
   * Properly mapped to avoid conflicts with gameplay controls
   */
  public handleControllerInput(button: string, controller: 'left' | 'right', pressed: boolean = true): void {
    // Only handle button press, not release
    if (!pressed) return;

    if (controller === 'left') {
      switch(button) {
        case 'xButton':
          this.toggleMinimap();
          this.provideHapticFeedback('left', 0.2, 20); // Subtle click
          break;
        case 'yButton':
          this.toggleFullMap();
          this.provideHapticFeedback('left', 0.2, 20);
          break;
        case 'leftGrip':
          // Wrist display is handled by grip hold
          this.showWristDisplay(true);
          break;
      }
    } else if (controller === 'right') {
      // Right controller buttons reserved for gameplay
      // A = Jump, B = Reload, Trigger = Fire
    }
  }

  /**
   * Handle grip release for wrist display
   */
  public handleGripRelease(controller: 'left' | 'right'): void {
    if (controller === 'left') {
      this.showWristDisplay(false);
    }
  }

  private showWristDisplay(show: boolean): void {
    if (this.wristDisplay) {
      this.wristDisplay.group.visible = show;
      if (show) {
        this.provideHapticFeedback('left', 0.1, 10); // Very subtle
      }
    }
  }

  private provideHapticFeedback(controller: 'left' | 'right', intensity: number, duration: number): void {
    // This would connect to the actual WebXR haptic API
    // Placeholder for haptic implementation
    const controllerRef = controller === 'left' ? this.leftController : this.rightController;
    if (controllerRef && (controllerRef as any).gamepad?.hapticActuators?.[0]) {
      (controllerRef as any).gamepad.hapticActuators[0].pulse(intensity, duration);
    }
  }

  private toggleMinimap(): void {
    this.minimapVisible = !this.minimapVisible;
    if (this.minimapPanel) {
      this.minimapPanel.setVisible(this.minimapVisible);

      if (this.minimapVisible) {
        // Position minimap in front of player
        this.positionPanelInFrontOfPlayer(this.minimapPanel.group, 0.3, 0.2);

        // Play open animation
        this.animatePanelOpen(this.minimapPanel.group);
      } else {
        // Play close animation
        this.animatePanelClose(this.minimapPanel.group);
      }
    }
  }

  private toggleFullMap(): void {
    this.fullMapVisible = !this.fullMapVisible;
    if (this.fullMapPanel) {
      this.fullMapPanel.setVisible(this.fullMapVisible);

      if (this.fullMapVisible) {
        // Position full map in front of player
        this.positionPanelInFrontOfPlayer(this.fullMapPanel.group, 0, 0);

        // Play open animation
        this.animatePanelOpen(this.fullMapPanel.group);
      } else {
        // Play close animation
        this.animatePanelClose(this.fullMapPanel.group);
      }
    }
  }

  private positionPanelInFrontOfPlayer(panel: THREE.Group, offsetX: number, offsetY: number): void {
    // Get camera world position and direction
    const cameraPosition = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();

    this.camera.getWorldPosition(cameraPosition);
    this.camera.getWorldDirection(cameraDirection);

    // Position panel 2 meters in front of player
    panel.position.copy(cameraPosition);
    panel.position.addScaledVector(cameraDirection, 2);
    panel.position.x += offsetX;
    panel.position.y += offsetY;

    // Make panel face the player
    panel.lookAt(cameraPosition);
  }

  private animatePanelOpen(panel: THREE.Group): void {
    panel.scale.set(0.1, 0.1, 0.1);
    panel.visible = true;

    // Animate scale
    const targetScale = 1;
    const animationDuration = 300; // ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const scale = 0.1 + (targetScale - 0.1) * eased;

      panel.scale.set(scale, scale, scale);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  private animatePanelClose(panel: THREE.Group): void {
    const animationDuration = 200; // ms
    const startTime = Date.now();
    const startScale = panel.scale.x;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      // Ease in cubic
      const eased = progress * progress * progress;
      const scale = startScale * (1 - eased);

      panel.scale.set(scale, scale, scale);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        panel.visible = false;
      }
    };

    animate();
  }

  /**
   * Update HUD with game state
   */
  public update(gameState: any): void {
    // Update wrist display
    if (this.wristDisplay) {
      this.wristDisplay.update(gameState);
    }

    // Update minimap if visible
    if (this.minimapVisible && this.minimapPanel) {
      this.minimapPanel.update(gameState);
    }

    // Update combat HUD
    if (this.combatHUD) {
      this.combatHUD.update(gameState);
    }
  }

  /**
   * Show damage indicator
   */
  public showDamage(direction: THREE.Vector3, amount: number): void {
    if (this.combatHUD) {
      this.combatHUD.showDamageIndicator(direction, amount);
    }
  }

  /**
   * Show hit marker
   */
  public showHitMarker(type: 'normal' | 'headshot' | 'kill'): void {
    if (this.combatHUD) {
      this.combatHUD.showHitMarker(type);
    }
  }
}

/**
 * Wrist Display - Always attached to left controller
 * Shows: Health, Ammo, Compass
 */
class WristDisplay {
  public group: THREE.Group;
  private healthBar: THREE.Mesh;
  private ammoText?: Text;
  private compass: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0, 0.05, -0.08); // Position on wrist
    this.group.rotation.x = -Math.PI / 4; // Angle for easy viewing

    // Create watch-like background
    const watchFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.06),
      new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.8
      })
    );
    this.group.add(watchFace);

    // Health bar
    this.healthBar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 0.008),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    this.healthBar.position.set(0, 0.015, 0.001);
    this.group.add(this.healthBar);

    // Ammo counter - using Text from troika-three-text
    try {
      this.ammoText = new Text();
      this.ammoText.text = '30/90';
      this.ammoText.fontSize = 0.01;
      this.ammoText.color = 0xffffff;
      this.ammoText.anchorX = 'center';
      this.ammoText.anchorY = 'middle';
      this.ammoText.position.set(0, 0, 0.002);
      // IMPORTANT: Must call sync() for Text to be rendered
      this.ammoText.sync();
      this.group.add(this.ammoText);
    } catch (e) {
      console.warn('⚠️ VR: Could not create wrist display text:', e);
      // Create fallback without text if Text fails
    }

    // Compass needle
    const compassGeometry = new THREE.ConeGeometry(0.005, 0.02, 3);
    this.compass = new THREE.Mesh(
      compassGeometry,
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    this.compass.position.set(0, -0.015, 0.002);
    this.compass.rotation.z = Math.PI;
    this.group.add(this.compass);
  }

  update(gameState: any): void {
    // Update health bar
    const healthPercent = (gameState.health || 100) / 100;
    this.healthBar.scale.x = healthPercent;
    this.healthBar.position.x = -0.03 * (1 - healthPercent);

    // Update health color
    if (healthPercent > 0.6) {
      (this.healthBar.material as THREE.MeshBasicMaterial).color.setHex(0x00ff00);
    } else if (healthPercent > 0.3) {
      (this.healthBar.material as THREE.MeshBasicMaterial).color.setHex(0xffff00);
    } else {
      (this.healthBar.material as THREE.MeshBasicMaterial).color.setHex(0xff0000);
    }

    // Update ammo
    if (this.ammoText) {
      this.ammoText.text = `${gameState.ammo || 30}/${gameState.maxAmmo || 90}`;
      this.ammoText.sync();
    }

    // Update compass
    if (gameState.playerRotation) {
      this.compass.rotation.z = -gameState.playerRotation.y + Math.PI;
    }
  }
}

/**
 * Minimap Panel - Floating tactical overview
 */
class MinimapPanel {
  public group: THREE.Group;
  private mapMesh: THREE.Mesh;
  private playerIcon: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    // Create panel frame
    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.4),
      new THREE.MeshBasicMaterial({
        color: 0x222222,
        transparent: true,
        opacity: 0.9
      })
    );
    this.group.add(frame);

    // Create map display area
    this.mapMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.35),
      new THREE.MeshBasicMaterial({ color: 0x111111 })
    );
    this.mapMesh.position.z = 0.001;
    this.group.add(this.mapMesh);

    // Player position indicator
    this.playerIcon = new THREE.Mesh(
      new THREE.ConeGeometry(0.01, 0.02, 3),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    this.playerIcon.position.z = 0.002;
    this.group.add(this.playerIcon);

    // Title text
    const title = new Text();
    title.text = 'TACTICAL MAP';
    title.fontSize = 0.02;
    title.color = 0x00ffff;
    title.anchorX = 'center';
    title.position.set(0, 0.18, 0.002);
    title.sync(); // Must sync for text to render
    this.group.add(title);
  }

  setVisible(visible: boolean): void {
    // Visibility handled by parent
  }

  update(gameState: any): void {
    // Update player position on minimap
    if (gameState.playerPosition) {
      // Map world coordinates to minimap coordinates
      const mapScale = 0.35 / 200; // 200 units world = 0.35 panel size
      this.playerIcon.position.x = gameState.playerPosition.x * mapScale;
      this.playerIcon.position.y = gameState.playerPosition.z * mapScale;
    }

    // Update player rotation
    if (gameState.playerRotation) {
      this.playerIcon.rotation.z = -gameState.playerRotation.y;
    }
  }
}

/**
 * Full Map Panel - Large strategic map
 */
class FullMapPanel {
  public group: THREE.Group;
  private mapMesh: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    // Create large panel
    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.8),
      new THREE.MeshBasicMaterial({
        color: 0x1a1a1a,
        transparent: true,
        opacity: 0.95
      })
    );
    this.group.add(frame);

    // Map display area
    this.mapMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.7),
      new THREE.MeshBasicMaterial({ color: 0x0a0a0a })
    );
    this.mapMesh.position.z = 0.001;
    this.group.add(this.mapMesh);

    // Title
    const title = new Text();
    title.text = 'STRATEGIC MAP';
    title.fontSize = 0.03;
    title.color = 0x00ffff;
    title.anchorX = 'center';
    title.position.set(0, 0.36, 0.002);
    title.sync(); // Must sync for text to render
    this.group.add(title);

    // Instructions
    const instructions = new Text();
    instructions.text = 'Press Y to close';
    instructions.fontSize = 0.015;
    instructions.color = 0xaaaaaa;
    instructions.anchorX = 'center';
    instructions.position.set(0, -0.36, 0.002);
    instructions.sync(); // Must sync for text to render
    this.group.add(instructions);
  }

  setVisible(visible: boolean): void {
    // Visibility handled by parent
  }

  update(gameState: any): void {
    // Update full map content
    // This would include zone markers, objectives, etc.
  }
}

/**
 * Combat HUD - Damage indicators and hit markers
 */
class CombatHUD {
  public group: THREE.Group;
  private hitMarker: THREE.Group;
  private damageIndicators: THREE.Mesh[] = [];

  constructor() {
    this.group = new THREE.Group();

    // Create hit marker (crosshair that expands on hit)
    this.hitMarker = new THREE.Group();
    this.createHitMarker();
    this.group.add(this.hitMarker);

    // Create damage indicator pool
    for (let i = 0; i < 4; i++) {
      const indicator = new THREE.Mesh(
        new THREE.PlaneGeometry(0.1, 0.02),
        new THREE.MeshBasicMaterial({
          color: 0xff0000,
          transparent: true,
          opacity: 0
        })
      );
      indicator.visible = false;
      this.damageIndicators.push(indicator);
      this.group.add(indicator);
    }
  }

  private createHitMarker(): void {
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    });

    // Create crosshair lines
    const size = 0.01;
    const gap = 0.005;

    // Top line
    const topGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, gap, -2),
      new THREE.Vector3(0, gap + size, -2)
    ]);
    const topLine = new THREE.Line(topGeometry, material);
    this.hitMarker.add(topLine);

    // Bottom line
    const bottomGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -gap, -2),
      new THREE.Vector3(0, -gap - size, -2)
    ]);
    const bottomLine = new THREE.Line(bottomGeometry, material);
    this.hitMarker.add(bottomLine);

    // Left line
    const leftGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-gap, 0, -2),
      new THREE.Vector3(-gap - size, 0, -2)
    ]);
    const leftLine = new THREE.Line(leftGeometry, material);
    this.hitMarker.add(leftLine);

    // Right line
    const rightGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(gap, 0, -2),
      new THREE.Vector3(gap + size, 0, -2)
    ]);
    const rightLine = new THREE.Line(rightGeometry, material);
    this.hitMarker.add(rightLine);
  }

  showHitMarker(type: 'normal' | 'headshot' | 'kill'): void {
    // Animate hit marker based on type
    const color = type === 'kill' ? 0xff0000 : type === 'headshot' ? 0xffff00 : 0xffffff;

    this.hitMarker.children.forEach((line) => {
      const material = (line as THREE.Line).material as THREE.LineBasicMaterial;
      material.color.setHex(color);
      material.opacity = 1;
    });

    // Animate scale and fade
    const startScale = type === 'kill' ? 1.5 : 1.2;
    this.hitMarker.scale.set(startScale, startScale, 1);

    const animate = () => {
      this.hitMarker.scale.x *= 0.95;
      this.hitMarker.scale.y *= 0.95;

      this.hitMarker.children.forEach((line) => {
        const material = (line as THREE.Line).material as THREE.LineBasicMaterial;
        material.opacity *= 0.9;
      });

      if (this.hitMarker.scale.x > 1.01) {
        requestAnimationFrame(animate);
      } else {
        this.hitMarker.scale.set(1, 1, 1);
      }
    };

    animate();
  }

  showDamageIndicator(direction: THREE.Vector3, amount: number): void {
    // Find an unused indicator
    const indicator = this.damageIndicators.find(i => !i.visible);
    if (!indicator) return;

    // Position indicator based on damage direction
    const angle = Math.atan2(direction.x, direction.z);
    const distance = 1.5;

    indicator.position.x = Math.sin(angle) * distance;
    indicator.position.z = -Math.cos(angle) * distance;
    indicator.position.y = 0;

    // Set opacity based on damage amount
    const material = indicator.material as THREE.MeshBasicMaterial;
    material.opacity = Math.min(amount / 50, 1);
    indicator.visible = true;

    // Fade out
    const fadeOut = () => {
      material.opacity *= 0.95;
      if (material.opacity > 0.01) {
        requestAnimationFrame(fadeOut);
      } else {
        indicator.visible = false;
      }
    };

    setTimeout(fadeOut, 100);
  }

  update(gameState: any): void {
    // Update combat HUD elements
    // This is called every frame for smooth animations
  }
}