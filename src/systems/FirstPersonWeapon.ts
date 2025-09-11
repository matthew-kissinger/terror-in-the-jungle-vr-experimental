import * as THREE from 'three';
import { GameSystem } from '../types';
import { AssetLoader } from './AssetLoader';
import { PlayerController } from './PlayerController';

export class FirstPersonWeapon implements GameSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private assetLoader: AssetLoader;
  private playerController?: PlayerController;
  
  // Weapon sprite
  private weaponSprite?: THREE.Mesh;
  private weaponMaterial?: THREE.MeshBasicMaterial;
  private weaponScene: THREE.Scene;
  private weaponCamera: THREE.OrthographicCamera;
  
  // Animation state
  private isSwinging = false;
  private swingTime = 0;
  private readonly SWING_DURATION = 0.4; // 400ms swing
  
  // Idle motion
  private idleTime = 0;
  private bobOffset = { x: 0, y: 0 };
  
  // Base position (relative to screen)
  private readonly basePosition = {
    x: 0.6,   // Even more to the left
    y: -1.1,  // Very low
    z: -1.5   // Close to camera
  };
  
  // Base rotation to angle the sword
  private readonly baseRotation = -0.5; // Angled like coming from shoulder
  
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
    
    // Listen for attack input
    window.addEventListener('click', this.onAttack.bind(this));
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  async init(): Promise<void> {
    console.log('⚔️ Initializing First Person Weapon...');
    
    const weaponTexture = this.assetLoader.getTexture('first-person');
    if (!weaponTexture) {
      console.warn('❌ First-person weapon texture not found');
      return;
    }
    
    // Create material with proper settings
    this.weaponMaterial = new THREE.MeshBasicMaterial({
      map: weaponTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    
    // Create a plane geometry for the weapon - a bit smaller
    const geometry = new THREE.PlaneGeometry(2.0, 2.0);
    
    // Offset the geometry so rotation happens at the bottom of the sprite
    // Move vertices up so the pivot is at the bottom
    geometry.translate(0, 1.0, 0); // Move geometry up by half its height
    
    // Create the weapon mesh
    this.weaponSprite = new THREE.Mesh(geometry, this.weaponMaterial);
    
    // Set base rotation angle
    this.weaponSprite.rotation.z = this.baseRotation;
    
    // Add to weapon scene
    this.weaponScene.add(this.weaponSprite);
    
    // Set initial position
    this.updateWeaponPosition(0, 0, 0);
    
    console.log('⚔️ Weapon sprite created and added to scene');
    
    console.log('✅ First Person Weapon initialized');
  }

  update(deltaTime: number): void {
    if (!this.weaponSprite) return;
    
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
    
    // Update swing animation
    if (this.isSwinging) {
      this.swingTime += deltaTime;
      
      if (this.swingTime >= this.SWING_DURATION) {
        // End swing
        this.isSwinging = false;
        this.swingTime = 0;
        this.updateWeaponPosition(0, 0, 0);
      } else {
        // Calculate swing animation
        const progress = this.swingTime / this.SWING_DURATION;
        this.animateSwing(progress);
      }
    } else {
      // Apply idle motion
      this.updateWeaponPosition(0, 0, 0);
    }
  }

  dispose(): void {
    if (this.weaponSprite) {
      this.weaponScene.remove(this.weaponSprite);
      this.weaponSprite.geometry.dispose();
    }
    
    if (this.weaponMaterial) {
      this.weaponMaterial.dispose();
    }
    
    window.removeEventListener('click', this.onAttack.bind(this));
    window.removeEventListener('mousedown', this.onMouseDown.bind(this));
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    
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

  private onAttack(): void {
    if (!this.isSwinging && this.weaponSprite) {
      this.startSwing();
    }
  }
  
  private onMouseDown(event: MouseEvent): void {
    // Prevent swing when right-clicking (for camera control)
    if (event.button === 2) {
      event.preventDefault();
    }
  }

  private startSwing(): void {
    this.isSwinging = true;
    this.swingTime = 0;
    console.log('⚔️ Sword swing!');
  }

  private animateSwing(progress: number): void {
    // Create a smooth swing arc animation
    // Phase 1: Wind up (0-0.3)
    // Phase 2: Swing (0.3-0.7)
    // Phase 3: Recovery (0.7-1.0)
    
    let rotZ = 0;
    let offsetX = 0;
    let offsetY = 0;
    
    if (progress < 0.2) {
      // Wind up - minimal backward motion
      const windupProgress = progress / 0.2;
      rotZ = -windupProgress * 0.2; // Small wind up (negative for correct direction)
      offsetX = 0; // Keep elbow still
      offsetY = 0; // Keep elbow still
    } else if (progress < 0.7) {
      // Swing - rotate sword forward in arc (clockwise now)
      const swingProgress = (progress - 0.2) / 0.5;
      const eased = this.easeOutCubic(swingProgress);
      
      rotZ = -0.2 + eased * 1.8; // Swing from slight left to far right
      offsetX = 0; // Keep elbow still
      offsetY = 0; // Keep elbow still
    } else {
      // Recovery - return sword to rest position
      const recoveryProgress = (progress - 0.7) / 0.3;
      const eased = this.easeInOutQuad(recoveryProgress);
      
      rotZ = 1.6 - eased * 1.6; // Return rotation to center
      offsetX = 0; // Keep elbow still
      offsetY = 0; // Keep elbow still
    }
    
    this.updateWeaponPosition(offsetX, offsetY, rotZ);
  }

  private updateWeaponPosition(offsetX: number, offsetY: number, rotZ: number): void {
    if (!this.weaponSprite) return;
    
    // Apply base position plus offsets and bobbing
    this.weaponSprite.position.x = this.basePosition.x + offsetX + this.bobOffset.x;
    this.weaponSprite.position.y = this.basePosition.y + offsetY + this.bobOffset.y;
    this.weaponSprite.position.z = this.basePosition.z;
    
    // Apply rotation (base rotation plus animation)
    this.weaponSprite.rotation.z = this.baseRotation + rotZ;
  }
  
  // Called by main game loop to render weapon overlay
  renderWeapon(renderer: THREE.WebGLRenderer): void {
    if (!this.weaponSprite) return;
    
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
  
  // Check if currently attacking (for damage detection)
  isAttacking(): boolean {
    return this.isSwinging && this.swingTime > 0.3 && this.swingTime < 0.7;
  }
}