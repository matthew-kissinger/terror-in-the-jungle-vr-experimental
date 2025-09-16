import * as THREE from 'three';
import { Combatant, CombatantState, Faction } from './types';
import { AssetLoader } from '../assets/AssetLoader';

export class CombatantRenderer {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private assetLoader: AssetLoader;

  private factionMeshes: Map<string, THREE.InstancedMesh> = new Map();
  private soldierTextures: Map<string, THREE.Texture> = new Map();

  constructor(scene: THREE.Scene, camera: THREE.Camera, assetLoader: AssetLoader) {
    this.scene = scene;
    this.camera = camera;
    this.assetLoader = assetLoader;
  }

  async createFactionBillboards(): Promise<void> {
    // Load US soldier textures
    const usWalking = this.assetLoader.getTexture('ASoldierWalking');
    const usAlert = this.assetLoader.getTexture('ASoldierAlert');
    const usFiring = this.assetLoader.getTexture('ASoldierFiring');

    // Load OPFOR soldier textures
    const opforWalking = this.assetLoader.getTexture('EnemySoldierWalking');
    const opforAlert = this.assetLoader.getTexture('EnemySoldierAlert');
    const opforFiring = this.assetLoader.getTexture('EnemySoldierFiring');
    const opforBack = this.assetLoader.getTexture('EnemySoldierBack');

    // Store textures
    if (usWalking) this.soldierTextures.set('US_walking', usWalking);
    if (usAlert) this.soldierTextures.set('US_alert', usAlert);
    if (usFiring) this.soldierTextures.set('US_firing', usFiring);
    if (opforWalking) this.soldierTextures.set('OPFOR_walking', opforWalking);
    if (opforAlert) this.soldierTextures.set('OPFOR_alert', opforAlert);
    if (opforFiring) this.soldierTextures.set('OPFOR_firing', opforFiring);
    if (opforBack) this.soldierTextures.set('OPFOR_back', opforBack);

    // Create instanced meshes for each faction-state combination
    const soldierGeometry = new THREE.PlaneGeometry(5, 7);

    // Helper to create mesh for faction-state
    const createFactionMesh = (texture: THREE.Texture, key: string, maxInstances: number = 30) => {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        depthWrite: true
      });

      const mesh = new THREE.InstancedMesh(soldierGeometry, material, maxInstances);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.renderOrder = 1;
      this.scene.add(mesh);
      this.factionMeshes.set(key, mesh);
    };

    // Create meshes for each faction-state combination
    if (usWalking) createFactionMesh(usWalking, 'US_walking');
    if (usAlert) createFactionMesh(usAlert, 'US_alert');
    if (usFiring) createFactionMesh(usFiring, 'US_firing');
    if (opforWalking) createFactionMesh(opforWalking, 'OPFOR_walking');
    if (opforAlert) createFactionMesh(opforAlert, 'OPFOR_alert');
    if (opforFiring) createFactionMesh(opforFiring, 'OPFOR_firing');
    if (opforBack) createFactionMesh(opforBack, 'OPFOR_back');

    console.log('🎖️ Created faction-specific soldier meshes');
  }

  updateBillboards(combatants: Map<string, Combatant>, playerPosition: THREE.Vector3): void {
    // Reset all mesh counts
    this.factionMeshes.forEach(mesh => mesh.count = 0);

    // Group combatants by faction and state
    const combatantGroups = new Map<string, Combatant[]>();

    combatants.forEach(combatant => {
      if (combatant.state === CombatantState.DEAD) return;
      if (combatant.isPlayerProxy) return;

      // Check if player is behind this enemy combatant
      let isShowingBack = false;
      if (combatant.faction === Faction.OPFOR) {
        const enemyForward = new THREE.Vector3(
          Math.cos(combatant.visualRotation),
          0,
          Math.sin(combatant.visualRotation)
        );
        const toPlayer = new THREE.Vector3()
          .subVectors(playerPosition, combatant.position)
          .normalize();

        const behindDot = enemyForward.dot(toPlayer);
        isShowingBack = behindDot < -0.2 &&
                       (!combatant.target || combatant.target.id !== 'PLAYER');
      }

      let stateKey = 'walking';
      if (isShowingBack) {
        stateKey = 'back';
      } else if (combatant.state === CombatantState.ENGAGING || combatant.state === CombatantState.SUPPRESSING) {
        stateKey = 'firing';
      } else if (combatant.state === CombatantState.ALERT) {
        stateKey = 'alert';
      }

      const key = `${combatant.faction}_${stateKey}`;
      if (!combatantGroups.has(key)) {
        combatantGroups.set(key, []);
      }
      combatantGroups.get(key)!.push(combatant);
    });

    // Update each mesh
    const matrix = new THREE.Matrix4();
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z);

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
    const cameraForward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();

    combatantGroups.forEach((combatants, key) => {
      const mesh = this.factionMeshes.get(key);
      if (!mesh) return;

      combatants.forEach((combatant, index) => {
        const isBackTexture = key.includes('_back');

        const combatantForward = new THREE.Vector3(
          Math.cos(combatant.visualRotation),
          0,
          Math.sin(combatant.visualRotation)
        );

        const toCombatant = new THREE.Vector3()
          .subVectors(combatant.position, playerPosition)
          .normalize();

        const viewAngle = toCombatant.dot(cameraRight);

        let finalRotation: number;
        let scaleX = combatant.scale.x;

        if (isBackTexture) {
          finalRotation = cameraAngle * 0.8 + combatant.visualRotation * 0.2;
          scaleX = Math.abs(scaleX);
        } else if (combatant.faction === Faction.OPFOR) {
          finalRotation = cameraAngle;
          scaleX = Math.abs(scaleX);
        } else {
          const facingDot = Math.abs(combatantForward.dot(cameraForward));
          const billboardBlend = 0.3 + facingDot * 0.4;
          finalRotation = cameraAngle * billboardBlend + combatant.visualRotation * (1 - billboardBlend);

          const combatantDotRight = combatantForward.dot(cameraRight);
          const shouldFlip = (viewAngle > 0 && combatantDotRight < 0) ||
                            (viewAngle < 0 && combatantDotRight > 0);
          scaleX = shouldFlip ? -Math.abs(scaleX) : Math.abs(scaleX);
        }

        matrix.makeRotationY(finalRotation);
        matrix.setPosition(combatant.position);

        const scaleMatrix = new THREE.Matrix4().makeScale(
          scaleX,
          combatant.scale.y,
          combatant.scale.z
        );
        matrix.multiply(scaleMatrix);

        mesh.setMatrixAt(index, matrix);
        combatant.billboardIndex = index;
      });

      mesh.count = combatants.length;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  updateCombatantTexture(combatant: Combatant): void {
    let textureKey = `${combatant.faction}_`;

    switch (combatant.state) {
      case CombatantState.ENGAGING:
      case CombatantState.SUPPRESSING:
        textureKey += 'firing';
        break;
      case CombatantState.ALERT:
        textureKey += 'alert';
        break;
      default:
        textureKey += 'walking';
        break;
    }

    combatant.currentTexture = this.soldierTextures.get(textureKey);
  }

  dispose(): void {
    this.factionMeshes.forEach(mesh => {
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
      this.scene.remove(mesh);
    });

    this.factionMeshes.clear();
    this.soldierTextures.clear();
  }
}