import * as THREE from 'three';
import { GameSystem } from '../../types';
import { ProgrammaticGunFactory } from './ProgrammaticGunFactory';
import { TracerPool } from '../effects/TracerPool';
import { MuzzleFlashPool } from '../effects/MuzzleFlashPool';
import { ImpactEffectsPool } from '../effects/ImpactEffectsPool';
import { GunplayCore, WeaponSpec } from '../weapons/GunplayCore';
// import { EnemySystem } from './EnemySystem'; // Replaced with CombatantSystem
import { CombatantSystem } from '../combat/CombatantSystem';
import { AssetLoader } from '../assets/AssetLoader';
import { PlayerController } from './PlayerController';
import { AudioManager } from '../audio/AudioManager';
import { AmmoManager } from '../weapons/AmmoManager';
import { ZoneManager } from '../world/ZoneManager';
import { VRSystem } from '../vr/VRSystem';

export class FirstPersonWeapon implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private assetLoader: AssetLoader;
  private playerController?: PlayerController;
  private gameStarted: boolean = false;
  
  // Weapon sprite
  private weaponScene: THREE.Scene;
  private weaponCamera: THREE.OrthographicCamera;
  private weaponRig?: THREE.Group; // rig root
  private muzzleRef?: THREE.Object3D;
  private magazineRef?: THREE.Object3D; // Magazine for reload animation
  
  // Animation state
  private isADS = false;
  private adsProgress = 0; // 0..1
  private readonly ADS_TIME = 0.18; // seconds
  private isFiring = false; // Track if mouse is held down

  // Recoil recovery with spring physics
  private weaponRecoilOffset = { x: 0, y: 0, z: 0, rotX: 0 };
  private weaponRecoilVelocity = { x: 0, y: 0, z: 0, rotX: 0 };
  private readonly RECOIL_SPRING_STIFFNESS = 120;
  private readonly RECOIL_SPRING_DAMPING = 15;
  
  // Idle motion
  private idleTime = 0;
  private bobOffset = { x: 0, y: 0 };
  private swayOffset = { x: 0, y: 0 };
  
  // Base position (relative to screen)
  private readonly basePosition = { x: 0.5, y: -0.45, z: -0.75 }; // More to the right
  // ADS position - centered and closer for sight alignment
  private readonly adsPosition = { x: 0.0, y: -0.18, z: -0.55 };

  private readonly baseRotation = 0.0;
  private readonly hipCantDeg = -12; // cant to the right at hip
  private baseFOV = 75; // Store base FOV for zoom effect

  // Gunplay
  private tracerPool: TracerPool;
  private muzzleFlashPool: MuzzleFlashPool;
  private impactEffectsPool: ImpactEffectsPool;
  private gunCore: GunplayCore;
  private weaponSpec: WeaponSpec = {
    name: 'Rifle', rpm: 700, adsTime: 0.18,
    baseSpreadDeg: 0.8, bloomPerShotDeg: 0.25,
    recoilPerShotDeg: 0.65, recoilHorizontalDeg: 0.35, // Moderate recoil
    damageNear: 34, damageFar: 24, falloffStart: 20, falloffEnd: 60,
    headshotMultiplier: 1.7, penetrationPower: 1
  };
  // private enemySystem?: EnemySystem;
  private combatantSystem?: CombatantSystem;
  private hudSystem?: any; // HUD system for hit markers
  private audioManager?: AudioManager;
  private ammoManager: AmmoManager;
  private zoneManager?: ZoneManager;
  // VRManager removed - using VRSystem instead
  private vrSystem?: VRSystem;

  // Reload animation state
  private reloadAnimationProgress = 0;
  private isReloadAnimating = false;
  private readonly RELOAD_ANIMATION_TIME = 2.5;
  private reloadRotation = { x: 0, y: 0, z: 0 };
  private reloadTranslation = { x: 0, y: 0, z: 0 };
  private magazineOffset = { x: 0, y: 0, z: 0 }; // Magazine animation offset
  private magazineRotation = { x: 0, y: 0, z: 0 }; // Magazine rotation during reload

  // VR weapon state
  private vr3DWeapon?: THREE.Group; // 3D weapon model for VR
  private vrWeaponAttached = false;
  private vrMuzzleRef?: THREE.Object3D; // Muzzle reference for VR weapon
  private vrAimingLaser?: THREE.Line; // Laser sight for VR aiming
  private vrCrosshair?: THREE.Mesh; // 3D crosshair for VR aiming
  
  constructor(scene: THREE.Scene, camera: THREE.Camera, assetLoader: AssetLoader) {
    this.scene = scene;
    this.camera = camera;
    this.assetLoader = assetLoader;
    
    // Create separate scene for weapon overlay
    this.weaponScene = new THREE.Scene();
    
    // Create orthographic camera for weapon rendering
    const aspect = window.innerWidth / window.innerHeight;
    this.weaponCamera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10);
    this.weaponCamera.position.z = 1;
    
    // Input
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', this.onWindowResize.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));

    this.tracerPool = new TracerPool(this.scene, 96);
    this.muzzleFlashPool = new MuzzleFlashPool(this.scene, 32);
    this.impactEffectsPool = new ImpactEffectsPool(this.scene, 32);
    this.gunCore = new GunplayCore(this.weaponSpec);

    // Initialize ammo manager
    this.ammoManager = new AmmoManager(30, 90); // 30 rounds per mag, 90 reserve
    this.ammoManager.setOnReloadComplete(() => this.onReloadComplete());
    this.ammoManager.setOnAmmoChange((state) => this.onAmmoChange(state));
  }

  async init(): Promise<void> {
    console.log('⚔️ Initializing First Person Weapon...');

    // Build programmatic rifle
    this.weaponRig = ProgrammaticGunFactory.createRifle();
    this.weaponRig.position.set(this.basePosition.x, this.basePosition.y, this.basePosition.z);
    // Don't set rotation here - it will be handled in updateWeaponTransform
    this.weaponScene.add(this.weaponRig);
    this.muzzleRef = this.weaponRig.getObjectByName('muzzle') || undefined;
    this.magazineRef = this.weaponRig.getObjectByName('magazine') || undefined;

    // Store base FOV from camera
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.baseFOV = this.camera.fov;
    }

    console.log('✅ First Person Weapon initialized (programmatic rifle)');

    // Create VR weapon if VR Manager is available
    if (this.vrSystem) {
      this.createVRWeapon();
    }

    // Trigger initial ammo display
    this.onAmmoChange(this.ammoManager.getState());
  }

  private isEnabled = true; // For death system

  update(deltaTime: number): void {
    if (!this.weaponRig || !this.isEnabled) return;

    // Update ammo manager with player position for zone resupply
    const playerPos = this.playerController?.getPosition();
    this.ammoManager.update(deltaTime, playerPos);
    
    // Update idle animation
    this.idleTime += deltaTime;
    
    // Get player movement state if available
    const isMoving = this.playerController?.isMoving() || false;
    
    // Calculate idle bobbing
    if (isMoving) {
      // Walking bob - bigger movements
      this.bobOffset.x = Math.sin(this.idleTime * 8) * 0.04;
      this.bobOffset.y = Math.abs(Math.sin(this.idleTime * 8)) * 0.06;
    } else {
      // Gentle breathing motion when standing
      this.bobOffset.x = Math.sin(this.idleTime * 2) * 0.01;
      this.bobOffset.y = Math.sin(this.idleTime * 2) * 0.02;
    }

    // Mouse-look sway (small)
    const lookVel = this.playerController ? this.playerController.getVelocity() : new THREE.Vector3();
    const speedFactor = Math.min(1, lookVel.length() / 10);
    this.swayOffset.x = THREE.MathUtils.lerp(this.swayOffset.x, speedFactor * 0.02, 8 * deltaTime);
    this.swayOffset.y = THREE.MathUtils.lerp(this.swayOffset.y, speedFactor * 0.02, 8 * deltaTime);
    
    // ADS transition
    const target = this.isADS ? 1 : 0;
    const k = this.ADS_TIME > 0 ? Math.min(1, deltaTime / this.ADS_TIME) : 1;
    this.adsProgress = THREE.MathUtils.lerp(this.adsProgress, target, k);

    // Apply FOV zoom when ADS (reduced zoom for less disorientation)
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const targetFOV = THREE.MathUtils.lerp(this.baseFOV, this.baseFOV / 1.3, this.adsProgress);
      this.camera.fov = targetFOV;
      this.camera.updateProjectionMatrix();
    }

    // Apply recoil recovery spring physics
    this.updateRecoilRecovery(deltaTime);

    // Update reload animation
    if (this.isReloadAnimating) {
      this.updateReloadAnimation(deltaTime);
    }

    // Apply overlay transform
    this.updateWeaponTransform();

    // Gunplay cooldown
    this.gunCore.cooldown(deltaTime);

    // Handle VR controller firing
    const isVRActive = this.vrSystem?.isVRActive() || this.vrSystem?.isVRActive();
    if (isVRActive) {
      // Attach weapon to VR controller if not already attached
      if (!this.vrWeaponAttached) {
        this.attachVRWeapon();
      }

      const inputs = this.vrSystem?.getControllerInputs() || { rightTrigger: 0 };
      if (inputs.rightTrigger > 0 && !this.isReloadAnimating) {
        this.tryFireVR();
      }

      // Update VR weapon position and rotation
      if (this.vrWeaponAttached) {
        this.updateVRWeapon();
      }

      // Handle VR B button for reload
      if (this.vrSystem?.isButtonPressed('bButton') && !this.isReloadAnimating) {
        this.startReload();
      }
    } else {
      // Detach weapon from VR if we exit VR
      if (this.vrWeaponAttached) {
        this.detachVRWeapon();
      }
      // Auto-fire while mouse is held (desktop mode)
      if (this.isFiring) {
        this.tryFire();
      }
    }

    // Update all effects
    this.tracerPool.update();
    this.muzzleFlashPool.update();
    this.impactEffectsPool.update(deltaTime);
  }

  dispose(): void {
    window.removeEventListener('mousedown', this.onMouseDown.bind(this));
    window.removeEventListener('mouseup', this.onMouseUp.bind(this));
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    this.tracerPool.dispose();
    this.muzzleFlashPool.dispose();
    this.impactEffectsPool.dispose();
    
    console.log('🧹 First Person Weapon disposed');
  }
  
  private onWindowResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.weaponCamera.left = -aspect;
    this.weaponCamera.right = aspect;
    this.weaponCamera.updateProjectionMatrix();
  }

  setPlayerController(controller: PlayerController): void {
    this.playerController = controller;
  }

  // Deprecated: Use setCombatantSystem instead
  setEnemySystem(enemy: any): void {
    console.warn('setEnemySystem is deprecated, use setCombatantSystem');
  }

  setCombatantSystem(combatantSystem: CombatantSystem): void {
    this.combatantSystem = combatantSystem;
  }

  
  private onMouseDown(event: MouseEvent): void {
    // Don't process input until game has started and weapon is visible
    if (!this.gameStarted || !this.isEnabled || !this.weaponRig) return;

    if (event.button === 2) {
      // Right mouse - ADS toggle hold (can't ADS while reloading)
      if (!this.isReloadAnimating) {
        this.isADS = true;
      }
      return;
    }
    if (event.button === 0) {
      // Left mouse - start firing (can't fire while reloading)
      if (!this.isReloadAnimating) {
        this.isFiring = true;
        this.tryFire();
      }
    }
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button === 2) {
      this.isADS = false;
    }
    if (event.button === 0) {
      // Stop firing when left mouse is released
      this.isFiring = false;
    }
  }

  private updateWeaponTransform(): void {
    if (!this.weaponRig) return;
    const px = THREE.MathUtils.lerp(this.basePosition.x, this.adsPosition.x, this.adsProgress);
    const py = THREE.MathUtils.lerp(this.basePosition.y, this.adsPosition.y, this.adsProgress);
    const pz = THREE.MathUtils.lerp(this.basePosition.z, this.adsPosition.z, this.adsProgress);

    // Apply position with all offsets including recoil and reload animation
    this.weaponRig.position.set(
      px + this.bobOffset.x + this.swayOffset.x + this.weaponRecoilOffset.x + this.reloadTranslation.x,
      py + this.bobOffset.y + this.swayOffset.y + this.weaponRecoilOffset.y + this.reloadTranslation.y,
      pz + this.weaponRecoilOffset.z + this.reloadTranslation.z
    );

    // Set up base rotations to point barrel toward crosshair
    // Y rotation: turn gun to face forward and LEFT toward center
    const baseYRotation = Math.PI / 2 + THREE.MathUtils.degToRad(15); // ADD to rotate LEFT
    const adsYRotation = Math.PI / 2; // Straight forward for ADS
    this.weaponRig.rotation.y = THREE.MathUtils.lerp(baseYRotation, adsYRotation, this.adsProgress);

    // X rotation: tilt barrel UPWARD toward crosshair + reload animation
    const baseXRotation = THREE.MathUtils.degToRad(18); // More upward tilt when not ADS
    const adsXRotation = 0; // Level for sight alignment
    this.weaponRig.rotation.x = THREE.MathUtils.lerp(baseXRotation, adsXRotation, this.adsProgress) + this.weaponRecoilOffset.rotX + this.reloadRotation.x;

    // Z rotation: cant the gun + reload tilt
    const baseCant = THREE.MathUtils.degToRad(-8); // Negative for proper cant
    const adsCant = 0; // No cant in ADS
    this.weaponRig.rotation.z = THREE.MathUtils.lerp(baseCant, adsCant, this.adsProgress) + this.reloadRotation.z;

    // Update magazine position if it exists
    if (this.magazineRef && this.isReloadAnimating) {
      this.magazineRef.position.x = 0.2 + this.magazineOffset.x;
      this.magazineRef.position.y = -0.25 + this.magazineOffset.y;
      this.magazineRef.position.z = 0 + this.magazineOffset.z;

      this.magazineRef.rotation.x = this.magazineRotation.x;
      this.magazineRef.rotation.y = this.magazineRotation.y;
      this.magazineRef.rotation.z = 0.1 + this.magazineRotation.z;
    }
  }

  private updateRecoilRecovery(deltaTime: number): void {
    // Spring physics for smooth recoil recovery
    const springForceX = -this.weaponRecoilOffset.x * this.RECOIL_SPRING_STIFFNESS;
    const springForceY = -this.weaponRecoilOffset.y * this.RECOIL_SPRING_STIFFNESS;
    const springForceZ = -this.weaponRecoilOffset.z * this.RECOIL_SPRING_STIFFNESS;
    const springForceRotX = -this.weaponRecoilOffset.rotX * this.RECOIL_SPRING_STIFFNESS;

    // Apply damping
    const dampingX = -this.weaponRecoilVelocity.x * this.RECOIL_SPRING_DAMPING;
    const dampingY = -this.weaponRecoilVelocity.y * this.RECOIL_SPRING_DAMPING;
    const dampingZ = -this.weaponRecoilVelocity.z * this.RECOIL_SPRING_DAMPING;
    const dampingRotX = -this.weaponRecoilVelocity.rotX * this.RECOIL_SPRING_DAMPING;

    // Update velocity
    this.weaponRecoilVelocity.x += (springForceX + dampingX) * deltaTime;
    this.weaponRecoilVelocity.y += (springForceY + dampingY) * deltaTime;
    this.weaponRecoilVelocity.z += (springForceZ + dampingZ) * deltaTime;
    this.weaponRecoilVelocity.rotX += (springForceRotX + dampingRotX) * deltaTime;

    // Update position
    this.weaponRecoilOffset.x += this.weaponRecoilVelocity.x * deltaTime;
    this.weaponRecoilOffset.y += this.weaponRecoilVelocity.y * deltaTime;
    this.weaponRecoilOffset.z += this.weaponRecoilVelocity.z * deltaTime;
    this.weaponRecoilOffset.rotX += this.weaponRecoilVelocity.rotX * deltaTime;
  }
  
  // Called by main game loop to render weapon overlay
  renderWeapon(renderer: THREE.WebGLRenderer): void {
    if (!this.weaponRig) return;

    // Don't render 2D weapon overlay in VR mode
    if (this.vrSystem?.isVRActive()) return;
    
    // Save current renderer state
    const currentAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    
    // Clear depth buffer to render on top
    renderer.clearDepth();
    
    // Render weapon scene
    renderer.render(this.weaponScene, this.weaponCamera);
    
    // Restore renderer state
    renderer.autoClear = currentAutoClear;
  }

  // Easing functions for smooth animation
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }
  
  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  
  private tryFire(): void {
    if (!this.combatantSystem || !this.gunCore.canFire() || !this.isEnabled) return;

    // Check ammo
    if (!this.ammoManager.canFire()) {
      if (this.ammoManager.isEmpty()) {
        // Play empty click sound
        console.log('🔫 *click* - Empty magazine!');
        // Auto-reload if we have reserve ammo
        if (this.ammoManager.getState().reserveAmmo > 0) {
          this.startReload();
        }
      }
      return;
    }

    // Consume ammo
    if (!this.ammoManager.consumeRound()) return;
    this.gunCore.registerShot();

    // Play player gunshot sound
    if (this.audioManager) {
      this.audioManager.playPlayerGunshot();
    }

    // Spread and recoil
    const spread = this.gunCore.getSpreadDeg();
    const ray = this.gunCore.computeShotRay(this.camera, spread);

    // Hitscan damage application with enhanced result
    const result = this.combatantSystem.handlePlayerShot(ray, (d, head) => this.gunCore.computeDamage(d, head));

    // Spawn impact effect at hit point
    if (result.hit) {
      // Calculate impact normal (opposite of ray direction for now)
      const normal = ray.direction.clone().negate();
      this.impactEffectsPool.spawn(result.point, normal);

      // Show hit marker
      if (this.hudSystem) {
        // Check if it's a kill or normal hit
        const hitType = (result as any).killed ? 'kill' : (result as any).headshot ? 'headshot' : 'normal';
        this.hudSystem.showHitMarker(hitType);
      }

      // Also show in VR HUD if active
      const vrHUDSystem = (this as any).vrHUDSystem || (window as any).vrHUDSystem;
      if (vrHUDSystem && (this.vrSystem?.isVRActive() || this.vrSystem?.isVRActive())) {
        const hitType = (result as any).killed ? 'kill' : (result as any).headshot ? 'headshot' : 'normal';
        vrHUDSystem.showHitMarker(hitType);
      }
    }

    // Spawn muzzle flash at the muzzle position
    const muzzlePos = new THREE.Vector3();
    const cameraPos = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPos);
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    if (this.muzzleRef) {
      // Get muzzle world position for 3D scene flash
      this.muzzleRef.getWorldPosition(muzzlePos);
      // Offset forward from camera position
      muzzlePos.copy(cameraPos).addScaledVector(forward, 1.5);
    } else {
      muzzlePos.copy(cameraPos).addScaledVector(forward, 1);
    }

    this.muzzleFlashPool.spawn(muzzlePos, forward, 1.2);

    // Check if we're in VR or desktop mode
    const isVRActive = this.vrSystem?.isVRActive() || this.vrSystem?.isVRActive();

    if (!isVRActive) {
      // DESKTOP: Apply visual recoil to camera and weapon
      const kick = this.gunCore.getRecoilOffsetDeg();
      // Apply camera recoil (pitch up, random yaw)
      if (this.playerController) {
        this.playerController.applyRecoil(
          THREE.MathUtils.degToRad(kick.pitch),
          THREE.MathUtils.degToRad(kick.yaw)
        );
      }

      // Apply weapon visual recoil (spring physics for smooth recovery)
      if (this.weaponRig) {
        // Add impulse to velocity for spring physics
        this.weaponRecoilVelocity.z -= 2.2; // Backward kick
        this.weaponRecoilVelocity.y += 1.2; // Upward kick
        this.weaponRecoilVelocity.rotX += 0.12; // Rotation kick

        // Small random horizontal kick for variety
        this.weaponRecoilVelocity.x += (Math.random() - 0.5) * 0.4;
      }
    } else {
      // VR: No camera shake (would cause motion sickness)
      // Instead, we'll use haptic feedback
      this.applyVRHapticRecoil();
    }
    (this as any).lastShotVisualTime = performance.now();
  }

  private tryFireVR(): void {
    if (!this.combatantSystem || !this.gunCore.canFire() || !this.isEnabled || !this.vrSystem) return;

    // Check ammo
    if (!this.ammoManager.canFire()) {
      if (this.ammoManager.isEmpty()) {
        // Play empty click sound
        console.log('🔫 *click* - Empty magazine!');
        // Auto-reload if we have reserve ammo
        if (this.ammoManager.getState().reserveAmmo > 0) {
          this.startReload();
        }
      }
      return;
    }

    // Consume ammo
    if (!this.ammoManager.consumeRound()) return;
    this.gunCore.registerShot();

    // Play player gunshot sound
    if (this.audioManager) {
      this.audioManager.playPlayerGunshot();
    }

    // Get shooting direction from right controller
    const shootDirection = this.vrSystem.getRightControllerDirection();
    const rightController = this.vrSystem.getRightController();

    // Get controller position for bullet spawn
    const bulletStart = new THREE.Vector3();
    rightController.getWorldPosition(bulletStart);

    // Create ray for hitscan
    const ray = new THREE.Ray(bulletStart, shootDirection);

    // Apply spread
    const spread = this.gunCore.getSpreadDeg();
    const spreadRadians = THREE.MathUtils.degToRad(spread);
    ray.direction.x += (Math.random() - 0.5) * spreadRadians;
    ray.direction.y += (Math.random() - 0.5) * spreadRadians;
    ray.direction.normalize();

    // Hitscan damage application
    const result = this.combatantSystem.handlePlayerShot(ray, (d, head) => this.gunCore.computeDamage(d, head));

    // Spawn impact effect at hit point
    if (result.hit) {
      const normal = ray.direction.clone().negate();
      this.impactEffectsPool.spawn(result.point, normal);

      // Show hit marker
      if (this.hudSystem) {
        const hitType = (result as any).killed ? 'kill' : (result as any).headshot ? 'headshot' : 'normal';
        this.hudSystem.showHitMarker(hitType);
      }
    }

    // Spawn muzzle flash at controller position
    this.muzzleFlashPool.spawn(bulletStart, shootDirection, 1.2);

    // Apply haptic feedback to controller
    if (rightController && rightController.userData.gamepad) {
      const gamepad = rightController.userData.gamepad;
      if (gamepad.hapticActuators && gamepad.hapticActuators[0]) {
        gamepad.hapticActuators[0].pulse(0.8, 100); // Strong pulse for 100ms
      }
    }

    // VR: Apply haptic feedback instead of camera shake
    this.applyVRHapticRecoil();

    (this as any).lastShotVisualTime = performance.now();
  }

  setHUDSystem(hudSystem: any): void {
    this.hudSystem = hudSystem;
  }

  setAudioManager(audioManager: AudioManager): void {
    this.audioManager = audioManager;
  }

  setZoneManager(zoneManager: ZoneManager): void {
    this.zoneManager = zoneManager;
    this.ammoManager.setZoneManager(zoneManager);
  }

  // VRManager setter removed - use setVRSystem instead

  setVRSystem(vrSystem: VRSystem): void {
    this.vrSystem = vrSystem;
  }

  // Public methods for VRSystem to call during session management
  public attachToVR(rightController: THREE.Group): void {
    if (!rightController) return;

    // Create VR weapon if needed
    if (!this.vr3DWeapon) {
      this.createVRWeapon();
    }

    // Attach directly to the provided controller
    if (this.vr3DWeapon && !this.vrWeaponAttached) {
      rightController.add(this.vr3DWeapon);
      this.vrWeaponAttached = true;

      // Show VR aiming system
      if (this.vrAimingLaser) this.vrAimingLaser.visible = true;
      if (this.vrCrosshair) this.vrCrosshair.visible = true;

      console.log('🔫 VR weapon attached via VRSystem');
    }
  }

  public detachFromVR(): void {
    this.detachVRWeapon();
  }

  setVRHUDSystem(vrHUDSystem: any): void {
    (this as any).vrHUDSystem = vrHUDSystem;
  }

  /**
   * Apply haptic feedback for VR gun recoil
   * Professional VR games use haptics instead of camera shake to avoid motion sickness
   */
  private applyVRHapticRecoil(): void {
    // Get the right controller (shooting hand)
    const rightController = this.vrSystem?.getRightController() || this.vrSystem?.getRightController();
    if (!rightController) return;

    // Try to get gamepad from controller's XR input source
    const xrSession = (this.vrSystem as any)?.renderer?.xr?.getSession() ||
                      (this.vrSystem as any)?.vrSession;

    if (xrSession && xrSession.inputSources) {
      for (const source of xrSession.inputSources) {
        if (source.handedness === 'right' && source.gamepad) {
          const gamepad = source.gamepad;

          // Apply haptic pulse for recoil feel
          if (gamepad.hapticActuators && gamepad.hapticActuators[0]) {
            // Strong pulse for gun recoil
            // Intensity: 0.8 (80%) for strong kick
            // Duration: 100ms for sharp recoil feel
            gamepad.hapticActuators[0].pulse(0.8, 100);

            // For automatic weapons, you might want shorter, lighter pulses:
            // gamepad.hapticActuators[0].pulse(0.5, 50);
          }
          break;
        }
      }
    }

    // Optional: Add visual recoil to the VR weapon itself (small kick animation)
    if (this.vr3DWeapon) {
      // Small visual kick that settles quickly
      // This is much subtler than desktop recoil
      const originalZ = this.vr3DWeapon.position.z;
      const originalRotX = this.vr3DWeapon.rotation.x;

      // Kick back
      this.vr3DWeapon.position.z += 0.02;
      this.vr3DWeapon.rotation.x -= 0.05;

      // Animate back to original position
      setTimeout(() => {
        if (this.vr3DWeapon) {
          this.vr3DWeapon.position.z = originalZ;
          this.vr3DWeapon.rotation.x = originalRotX;
        }
      }, 100);
    }
  }


  private createVRWeapon(): void {
    // Check if VR system is available
    if (!this.vrSystem) return;

    // Create 3D weapon for VR using the same factory as desktop
    this.vr3DWeapon = ProgrammaticGunFactory.createRifle();

    // Scale weapon for VR hand size (slightly smaller than desktop overlay)
    this.vr3DWeapon.scale.set(0.6, 0.6, 0.6);

    // Position weapon at the stock for proper holding (move attachment point back)
    this.vr3DWeapon.position.set(0.05, -0.05, 0.2); // Back towards stock, slightly right
    // Rotate 45 degrees to the left so barrel points forward properly
    this.vr3DWeapon.rotation.set(0, -Math.PI / 4, 0); // -45 degrees Y rotation

    // Get muzzle reference for VR aiming
    this.vrMuzzleRef = this.vr3DWeapon.getObjectByName('muzzle');

    // Create VR aiming system
    this.createVRAimingSystem();

    console.log('🔫 VR 3D weapon created');
  }

  private createVRAimingSystem(): void {
    if (!this.vr3DWeapon || !this.vrMuzzleRef) return;

    // Create laser sight - thin red line
    const laserGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -10) // 10 meters forward
    ]);
    const laserMaterial = new THREE.LineBasicMaterial({
      color: 0xff0000,
      opacity: 0.6,
      transparent: true
    });
    this.vrAimingLaser = new THREE.Line(laserGeometry, laserMaterial);
    this.vrAimingLaser.visible = false; // Hidden by default

    // Add laser to the weapon (it will follow the muzzle)
    this.vr3DWeapon.add(this.vrAimingLaser);

    // Create 3D crosshair - small glowing sphere
    const crosshairGeometry = new THREE.SphereGeometry(0.02, 8, 8);
    const crosshairMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff44,
      transparent: true,
      opacity: 0.8
    });
    this.vrCrosshair = new THREE.Mesh(crosshairGeometry, crosshairMaterial);
    this.vrCrosshair.visible = false; // Hidden by default
    this.scene.add(this.vrCrosshair);

    console.log('🎯 VR aiming system created');
  }


  public attachVRWeapon(): void {
    if (this.vrWeaponAttached) return;

    // Get right controller from either VRSystem (new) or VRManager (old)
    const rightController = this.vrSystem?.getRightController() || this.vrSystem?.getRightController();
    if (!rightController) return;

    // Create VR 3D weapon if it doesn't exist yet
    if (!this.vr3DWeapon) {
      this.createVRWeapon();
    }

    // Use the 3D weapon model for VR (not the overlay weapon)
    if (this.vr3DWeapon) {
      rightController.add(this.vr3DWeapon);
      this.vrWeaponAttached = true;

      // Show VR aiming system
      if (this.vrAimingLaser) this.vrAimingLaser.visible = true;
      if (this.vrCrosshair) this.vrCrosshair.visible = true;

      console.log('🔫 VR weapon attached to right controller');
    }
  }

  private updateVRWeapon(): void {
    // The weapon is attached to the controller, so it moves automatically
    // We can add any per-frame adjustments here if needed
    // For example, recoil effects or aiming adjustments
  }

  public detachVRWeapon(): void {
    if (!this.vrWeaponAttached || !this.vr3DWeapon) return;

    const rightController = this.vrSystem?.getRightController() || this.vrSystem?.getRightController();
    if (rightController) {
      rightController.remove(this.vr3DWeapon);
      this.vrWeaponAttached = false;

      // Hide VR aiming system
      if (this.vrAimingLaser) this.vrAimingLaser.visible = false;
      if (this.vrCrosshair) this.vrCrosshair.visible = false;

      console.log('🔫 VR weapon detached from controller');
    }
  }

  // Disable weapon (for death)
  disable(): void {
    this.isEnabled = false;
    this.isADS = false;
    this.adsProgress = 0;
    if (this.weaponRig) {
      this.weaponRig.visible = false;
    }
  }

  // Enable weapon (for respawn)
  enable(): void {
    this.isEnabled = true;
    if (this.weaponRig) {
      this.weaponRig.visible = true;
    }
    // Reset ammo on respawn
    this.ammoManager.reset();
  }

  // Set game started state
  setGameStarted(started: boolean): void {
    this.gameStarted = started;
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.gameStarted || !this.isEnabled) return;

    if (event.key.toLowerCase() === 'r') {
      this.startReload();
    }
  }

  private startReload(): void {
    // Can't reload while ADS
    if (this.isADS) {
      console.log('⚠️ Cannot reload while aiming');
      return;
    }

    if (this.ammoManager.startReload()) {
      this.isReloadAnimating = true;
      this.reloadAnimationProgress = 0;
      this.isFiring = false; // Stop firing during reload

      // Play reload sound if available
      if (this.audioManager) {
        this.audioManager.playReloadSound();
      }
    }
  }

  private updateReloadAnimation(deltaTime: number): void {
    if (!this.isReloadAnimating) return;

    // Update reload animation progress
    this.reloadAnimationProgress += deltaTime / this.RELOAD_ANIMATION_TIME;

    if (this.reloadAnimationProgress >= 1) {
      this.reloadAnimationProgress = 1;
      this.isReloadAnimating = false;
      // Reset animation values
      this.reloadRotation = { x: 0, y: 0, z: 0 };
      this.reloadTranslation = { x: 0, y: 0, z: 0 };
      this.magazineOffset = { x: 0, y: 0, z: 0 };
      this.magazineRotation = { x: 0, y: 0, z: 0 };

      // Reset magazine to default position
      if (this.magazineRef) {
        this.magazineRef.position.set(0.2, -0.25, 0);
        this.magazineRef.rotation.set(0, 0, 0.1);
      }
      return;
    }

    // Calculate reload animation based on progress
    this.calculateReloadAnimation(this.reloadAnimationProgress);
  }

  private calculateReloadAnimation(progress: number): void {
    // Multi-stage reload animation with magazine detachment
    // Stage 1 (0-20%): Tilt gun right to expose magazine
    // Stage 2 (20-40%): Pull magazine out downward
    // Stage 3 (40-50%): Magazine falls away, pause
    // Stage 4 (50-70%): Insert new magazine from below
    // Stage 5 (70-85%): Rotate gun back to center
    // Stage 6 (85-100%): Chamber round (slight pull back)

    if (progress < 0.2) {
      // Stage 1: Tilt gun right
      const t = progress / 0.2;
      const ease = this.easeInOutQuad(t);
      this.reloadRotation.z = THREE.MathUtils.degToRad(-25) * ease; // Tilt right
      this.reloadRotation.y = THREE.MathUtils.degToRad(15) * ease; // Turn slightly
      this.reloadTranslation.x = 0.15 * ease; // Move right slightly
    } else if (progress < 0.4) {
      // Stage 2: Pull mag out downward
      const t = (progress - 0.2) / 0.2;
      const ease = this.easeOutCubic(t);
      this.reloadRotation.z = THREE.MathUtils.degToRad(-25);
      this.reloadRotation.y = THREE.MathUtils.degToRad(15);
      this.reloadTranslation.x = 0.15;

      // Magazine detaches and drops
      this.magazineOffset.y = -0.4 * ease; // Drop down
      this.magazineOffset.x = -0.1 * ease; // Slight left movement
      this.magazineRotation.z = THREE.MathUtils.degToRad(-15) * ease; // Tilt as it drops
    } else if (progress < 0.5) {
      // Stage 3: Magazine fully detached, pause
      this.reloadRotation.z = THREE.MathUtils.degToRad(-25);
      this.reloadRotation.y = THREE.MathUtils.degToRad(15);
      this.reloadTranslation.x = 0.15;

      // Magazine fully dropped
      this.magazineOffset.y = -0.6; // Off screen
      this.magazineOffset.x = -0.15;
      this.magazineRotation.z = THREE.MathUtils.degToRad(-20);
    } else if (progress < 0.7) {
      // Stage 4: Insert new mag from below
      const t = (progress - 0.5) / 0.2;
      const ease = this.easeInCubic(t);
      this.reloadRotation.z = THREE.MathUtils.degToRad(-25);
      this.reloadRotation.y = THREE.MathUtils.degToRad(15);
      this.reloadTranslation.x = 0.15;

      // Magazine slides back up into place
      this.magazineOffset.y = -0.6 + (0.6 * ease); // Rise from below
      this.magazineOffset.x = -0.15 + (0.15 * ease); // Move back to center
      this.magazineRotation.z = THREE.MathUtils.degToRad(-20) * (1 - ease); // Straighten
    } else if (progress < 0.85) {
      // Stage 5: Rotate gun back to center
      const t = (progress - 0.7) / 0.15;
      const ease = this.easeInOutQuad(t);
      this.reloadRotation.z = THREE.MathUtils.degToRad(-25) * (1 - ease);
      this.reloadRotation.y = THREE.MathUtils.degToRad(15) * (1 - ease);
      this.reloadTranslation.x = 0.15 * (1 - ease);

      // Magazine locked in place
      this.magazineOffset.y = 0;
      this.magazineOffset.x = 0;
      this.magazineRotation.z = 0;
    } else {
      // Stage 6: Chamber round (slight pull back)
      const t = (progress - 0.85) / 0.15;
      const ease = this.easeOutCubic(t);
      const pullBack = ease < 0.5 ? ease * 2 : (1 - ease) * 2;
      this.reloadTranslation.z = -0.05 * pullBack; // Pull back slightly
      this.reloadRotation.x = THREE.MathUtils.degToRad(-3) * pullBack; // Slight upward kick

      // Magazine stays in place
      this.magazineOffset.y = 0;
      this.magazineOffset.x = 0;
      this.magazineRotation.z = 0;
    }
  }

  private easeInCubic(t: number): number {
    return t * t * t;
  }

  private onReloadComplete(): void {
    console.log('✅ Weapon reloaded!');
    // Reload animation will finish independently
  }

  private onAmmoChange(state: any): void {
    // Update HUD if available
    if (this.hudSystem) {
      this.hudSystem.updateAmmoDisplay(state.currentMagazine, state.reserveAmmo);
    }

    // Check for low ammo warning
    if (this.ammoManager.isLowAmmo()) {
      console.log('⚠️ Low ammo!');
    }
  }

  getAmmoState(): any {
    return this.ammoManager.getState();
  }

  // Helicopter integration methods
  hideWeapon(): void {
    if (this.weaponRig) {
      this.weaponRig.visible = false;
      console.log('🚁 🔫 Weapon hidden (in helicopter)');
    }
  }

  showWeapon(): void {
    if (this.weaponRig) {
      this.weaponRig.visible = true;
      console.log('🚁 🔫 Weapon shown (exited helicopter)');
    }
  }

  setFireingEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      // Stop any current firing
      this.isFiring = false;
      console.log('🚁 🔫 Firing disabled (in helicopter)');
    } else {
      console.log('🚁 🔫 Firing enabled (exited helicopter)');
    }
  }
}