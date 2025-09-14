import * as THREE from 'three';
import { GameSystem } from '../types';
import { ProgrammaticGunFactory } from './ProgrammaticGunFactory';
import { TracerPool } from './TracerPool';
import { MuzzleFlashPool } from './MuzzleFlashPool';
import { ImpactEffectsPool } from './ImpactEffectsPool';
import { GunplayCore, WeaponSpec } from './GunplayCore';
// import { EnemySystem } from './EnemySystem'; // Replaced with CombatantSystem
import { CombatantSystem } from './CombatantSystem';
import { AssetLoader } from './AssetLoader';
import { PlayerController } from './PlayerController';

export class FirstPersonWeapon implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private assetLoader: AssetLoader;
  private playerController?: PlayerController;
  
  // Weapon sprite
  private weaponScene: THREE.Scene;
  private weaponCamera: THREE.OrthographicCamera;
  private weaponRig?: THREE.Group; // rig root
  private muzzleRef?: THREE.Object3D;
  
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

    this.tracerPool = new TracerPool(this.scene, 96);
    this.muzzleFlashPool = new MuzzleFlashPool(this.scene, 32);
    this.impactEffectsPool = new ImpactEffectsPool(this.scene, 32);
    this.gunCore = new GunplayCore(this.weaponSpec);
  }

  async init(): Promise<void> {
    console.log('⚔️ Initializing First Person Weapon...');

    // Build programmatic rifle
    this.weaponRig = ProgrammaticGunFactory.createRifle();
    this.weaponRig.position.set(this.basePosition.x, this.basePosition.y, this.basePosition.z);
    // Don't set rotation here - it will be handled in updateWeaponTransform
    this.weaponScene.add(this.weaponRig);
    this.muzzleRef = this.weaponRig.getObjectByName('muzzle') || undefined;

    // Store base FOV from camera
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.baseFOV = this.camera.fov;
    }

    console.log('✅ First Person Weapon initialized (programmatic rifle)');
  }

  update(deltaTime: number): void {
    if (!this.weaponRig) return;
    
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

    // Apply overlay transform
    this.updateWeaponTransform();

    // Gunplay cooldown
    this.gunCore.cooldown(deltaTime);

    // Auto-fire while mouse is held
    if (this.isFiring) {
      this.tryFire();
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
    if (event.button === 2) {
      // Right mouse - ADS toggle hold
      this.isADS = true;
      return;
    }
    if (event.button === 0) {
      // Left mouse - start firing
      this.isFiring = true;
      this.tryFire();
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

    // Apply position with all offsets including recoil
    this.weaponRig.position.set(
      px + this.bobOffset.x + this.swayOffset.x + this.weaponRecoilOffset.x,
      py + this.bobOffset.y + this.swayOffset.y + this.weaponRecoilOffset.y,
      pz + this.weaponRecoilOffset.z
    );

    // Set up base rotations to point barrel toward crosshair
    // Y rotation: turn gun to face forward and LEFT toward center
    const baseYRotation = Math.PI / 2 + THREE.MathUtils.degToRad(15); // ADD to rotate LEFT
    const adsYRotation = Math.PI / 2; // Straight forward for ADS
    this.weaponRig.rotation.y = THREE.MathUtils.lerp(baseYRotation, adsYRotation, this.adsProgress);

    // X rotation: tilt barrel UPWARD toward crosshair
    const baseXRotation = THREE.MathUtils.degToRad(18); // More upward tilt when not ADS
    const adsXRotation = 0; // Level for sight alignment
    this.weaponRig.rotation.x = THREE.MathUtils.lerp(baseXRotation, adsXRotation, this.adsProgress) + this.weaponRecoilOffset.rotX;

    // Z rotation: cant the gun
    const baseCant = THREE.MathUtils.degToRad(-8); // Negative for proper cant
    const adsCant = 0; // No cant in ADS
    this.weaponRig.rotation.z = THREE.MathUtils.lerp(baseCant, adsCant, this.adsProgress);
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
    if (!this.combatantSystem || !this.gunCore.canFire()) return;
    this.gunCore.registerShot();

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

    // Visual recoil: kick weapon and camera slightly, and persist kick via controller
    const kick = this.gunCore.getRecoilOffsetDeg();
    // Fixed: positive pitch makes the aim go UP (as it should with recoil)
    if (this.playerController) this.playerController.applyRecoil(THREE.MathUtils.degToRad(kick.pitch), THREE.MathUtils.degToRad(kick.yaw));
    // Apply recoil impulse to weapon spring system (moderate recoil)
    if (this.weaponRig) {
      // Add impulse to velocity for spring physics
      this.weaponRecoilVelocity.z -= 2.2; // Backward kick
      this.weaponRecoilVelocity.y += 1.2; // Upward kick
      this.weaponRecoilVelocity.rotX += 0.12; // Rotation kick

      // Small random horizontal kick for variety
      this.weaponRecoilVelocity.x += (Math.random() - 0.5) * 0.4;
    }
    (this as any).lastShotVisualTime = performance.now();
  }

  setHUDSystem(hudSystem: any): void {
    this.hudSystem = hudSystem;
  }
}