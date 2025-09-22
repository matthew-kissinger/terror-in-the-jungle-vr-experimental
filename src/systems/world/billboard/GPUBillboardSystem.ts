import * as THREE from 'three';
import { AssetLoader } from '../../assets/AssetLoader';

// Vertex shader for GPU-based billboard instancing with LOD and culling
const BILLBOARD_VERTEX_SHADER = `
  precision highp float;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform vec3 cameraPosition;
  uniform float time;
  uniform vec2 lodDistances; // x = LOD1 distance, y = LOD2 distance
  uniform mat4 viewMatrix;
  uniform float maxDistance;

  attribute vec3 position;
  attribute vec2 uv;

  // Instance attributes
  attribute vec3 instancePosition;
  attribute vec2 instanceScale;
  attribute float instanceRotation;

  varying vec2 vUv;
  varying float vDistance;
  varying float vLodFactor;

  void main() {
    vUv = uv;

    // Calculate distance for LOD/fade
    vec3 worldPos = instancePosition;
    vDistance = length(cameraPosition - worldPos);

    // LOD factor for fragment shader (0-1, where 0 = full quality, 1 = lowest quality)
    if (vDistance < lodDistances.x) {
      vLodFactor = 0.0; // Full quality
    } else if (vDistance < lodDistances.y) {
      vLodFactor = 0.5; // Medium quality
    } else {
      vLodFactor = 1.0; // Low quality
    }

    // Calculate billboard orientation - cylindrical (Y-axis aligned)
    // Get direction from billboard to camera
    vec3 toCamera = cameraPosition - worldPos;
    vec3 toCameraXZ = vec3(toCamera.x, 0.0, toCamera.z);

    // Handle edge case when camera is directly above/below
    float xzLength = length(toCameraXZ);
    if (xzLength < 0.001) {
      toCameraXZ = vec3(0.0, 0.0, 1.0);
      xzLength = 1.0;
    }

    // Normalize the XZ direction
    vec3 forward = toCameraXZ / xzLength;

    // Calculate right vector (perpendicular to forward in XZ plane)
    // Right is 90 degrees CCW from forward in XZ plane
    vec3 right = vec3(forward.z, 0.0, -forward.x);
    vec3 up = vec3(0.0, 1.0, 0.0);

    // Scale the billboard quad
    vec3 scaledPos = vec3(position.x * instanceScale.x, position.y * instanceScale.y, 0.0);

    // Transform from billboard space to world space
    // Since PlaneGeometry is in XY facing +Z, we map:
    // X -> right, Y -> up, and implicitly the plane faces toward the camera
    vec3 rotatedPosition = right * scaledPos.x + up * scaledPos.y;

    // Add wind sway animation (reduced for distant objects)
    float lodWindScale = 1.0 - vLodFactor * 0.7; // Reduce wind for distant objects
    float windStrength = 0.3 * lodWindScale;
    float windFreq = 1.5;
    float sway = sin(time * windFreq + worldPos.x * 0.1 + worldPos.z * 0.1) * windStrength;
    rotatedPosition.x += sway * position.y * 0.1; // More sway at top

    // Transform to world position
    vec3 finalPosition = worldPos + rotatedPosition;

    // Project to screen
    vec4 mvPosition = modelViewMatrix * vec4(finalPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment shader with distance-based alpha fade and LOD
const BILLBOARD_FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D map;
  uniform float fadeDistance;
  uniform float maxDistance;

  varying vec2 vUv;
  varying float vDistance;
  varying float vLodFactor;

  void main() {
    vec4 texColor = texture2D(map, vUv);

    // Alpha test for transparency
    if (texColor.a < 0.5) discard;

    // Distance-based fade
    float fadeFactor = 1.0;
    if (vDistance > fadeDistance) {
      fadeFactor = 1.0 - smoothstep(fadeDistance, maxDistance, vDistance);
    }

    // Apply LOD-based alpha reduction for distant objects
    fadeFactor *= (1.0 - vLodFactor * 0.3);

    gl_FragColor = vec4(texColor.rgb, texColor.a * fadeFactor);
  }
`;

export interface GPUVegetationConfig {
  maxInstances: number;
  texture: THREE.Texture;
  width: number;
  height: number;
  fadeDistance: number;
  maxDistance: number;
}

export class GPUBillboardVegetation {
  private geometry: THREE.InstancedBufferGeometry;
  private material: THREE.RawShaderMaterial;
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;

  // Instance data arrays
  private positions: Float32Array;
  private scales: Float32Array;
  private rotations: Float32Array;

  // Attributes
  private positionAttribute: THREE.InstancedBufferAttribute;
  private scaleAttribute: THREE.InstancedBufferAttribute;
  private rotationAttribute: THREE.InstancedBufferAttribute;

  private maxInstances: number;
  private activeCount: number = 0;

  constructor(scene: THREE.Scene, config: GPUVegetationConfig) {
    this.scene = scene;
    this.maxInstances = config.maxInstances;

    // Create plane geometry for billboard
    const planeGeometry = new THREE.PlaneGeometry(config.width, config.height);

    // Convert to InstancedBufferGeometry
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = planeGeometry.index;
    this.geometry.attributes = planeGeometry.attributes;

    // Initialize instance arrays
    this.positions = new Float32Array(this.maxInstances * 3);
    this.scales = new Float32Array(this.maxInstances * 2);
    this.rotations = new Float32Array(this.maxInstances);

    // Create instance attributes
    this.positionAttribute = new THREE.InstancedBufferAttribute(this.positions, 3);
    this.scaleAttribute = new THREE.InstancedBufferAttribute(this.scales, 2);
    this.rotationAttribute = new THREE.InstancedBufferAttribute(this.rotations, 1);

    // Set dynamic for updates
    this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.scaleAttribute.setUsage(THREE.DynamicDrawUsage);
    this.rotationAttribute.setUsage(THREE.DynamicDrawUsage);

    // Add attributes to geometry
    this.geometry.setAttribute('instancePosition', this.positionAttribute);
    this.geometry.setAttribute('instanceScale', this.scaleAttribute);
    this.geometry.setAttribute('instanceRotation', this.rotationAttribute);

    // Create shader material
    this.material = new THREE.RawShaderMaterial({
      uniforms: {
        map: { value: config.texture },
        time: { value: 0 },
        cameraPosition: { value: new THREE.Vector3() },
        fadeDistance: { value: config.fadeDistance },
        maxDistance: { value: config.maxDistance },
        lodDistances: { value: new THREE.Vector2(150, 300) },
        viewMatrix: { value: new THREE.Matrix4() }
      },
      vertexShader: BILLBOARD_VERTEX_SHADER,
      fragmentShader: BILLBOARD_FRAGMENT_SHADER,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true
    });

    // Create mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false; // Disable frustum culling for instanced geometry
    this.scene.add(this.mesh);
  }

  // Add instances for a chunk
  addInstances(instances: Array<{position: THREE.Vector3, scale: THREE.Vector3, rotation: number}>): number[] {
    const allocatedIndices: number[] = [];
    const startCount = this.activeCount;

    for (const instance of instances) {
      let index = -1;

      // First, try to find a free slot (scale = 0)
      for (let i = 0; i < this.activeCount; i++) {
        if (this.scales[i * 2] === 0 && this.scales[i * 2 + 1] === 0) {
          index = i;
          break;
        }
      }

      // If no free slot, use new index
      if (index === -1) {
        if (this.activeCount >= this.maxInstances) {
          // Don't warn for every instance, just once per batch
          if (allocatedIndices.length === 0) {
            console.warn(`⚠️ GPU Billboard: Max instances reached (${this.activeCount}/${this.maxInstances})`);
          }
          break;
        }
        index = this.activeCount;
        this.activeCount++;
      }
      const i3 = index * 3;
      const i2 = index * 2;

      // Set position
      this.positions[i3] = instance.position.x;
      this.positions[i3 + 1] = instance.position.y;
      this.positions[i3 + 2] = instance.position.z;

      // Set scale
      this.scales[i2] = instance.scale.x;
      this.scales[i2 + 1] = instance.scale.y;

      // Set rotation
      this.rotations[index] = instance.rotation;

      allocatedIndices.push(index);
    }

    // Update attributes
    this.positionAttribute.needsUpdate = true;
    this.scaleAttribute.needsUpdate = true;
    this.rotationAttribute.needsUpdate = true;

    // Update instance count for rendering
    this.geometry.instanceCount = this.activeCount;

    const addedCount = this.activeCount - startCount;
    if (addedCount > 0) {
      console.log(`✅ GPU Vegetation allocated ${addedCount} instances (${startCount} → ${this.activeCount} / ${this.maxInstances})`);
    }

    return allocatedIndices;
  }

  // Remove instances by indices
  removeInstances(indices: number[]): void {
    // Hide instances by setting scale to 0 instead of swapping
    // This preserves index integrity for chunk tracking
    for (const index of indices) {
      if (index >= this.activeCount) continue;

      const i2 = index * 2;
      // Set scale to 0 to hide the instance
      this.scales[i2] = 0;
      this.scales[i2 + 1] = 0;
    }

    // Update attributes
    this.scaleAttribute.needsUpdate = true;

    console.log(`🔻 GPU Vegetation: Hid ${indices.length} instances`);
  }

  // Get instance positions for area clearing
  getInstancePositions(): Float32Array {
    return this.positions;
  }

  // Reset all instances (for full cleanup)
  reset(): void {
    this.activeCount = 0;
    this.geometry.instanceCount = 0;
    this.positionAttribute.needsUpdate = true;
    this.scaleAttribute.needsUpdate = true;
    this.rotationAttribute.needsUpdate = true;
  }

  // Update uniforms (called every frame)
  update(camera: THREE.Camera, time: number): void {
    this.material.uniforms.cameraPosition.value.copy(camera.position);
    this.material.uniforms.time.value = time;
    if (camera instanceof THREE.PerspectiveCamera) {
      this.material.uniforms.viewMatrix.value.copy(camera.matrixWorldInverse);
    }
  }

  // Update with explicit world position (for VR)
  updateWithWorldPosition(camera: THREE.Camera, worldPosition: THREE.Vector3, time: number): void {
    this.material.uniforms.cameraPosition.value.copy(worldPosition);
    this.material.uniforms.time.value = time;
    if (camera instanceof THREE.PerspectiveCamera) {
      this.material.uniforms.viewMatrix.value.copy(camera.matrixWorldInverse);
    }
  }

  // Get current instance count
  getInstanceCount(): number {
    return this.activeCount;
  }

  // Dispose resources
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.mesh);
  }
}

// Manager for multiple vegetation types
export class GPUBillboardSystem {
  private vegetationTypes: Map<string, GPUBillboardVegetation> = new Map();
  private chunkInstances: Map<string, Map<string, number[]>> = new Map();
  private scene: THREE.Scene;
  private assetLoader: AssetLoader;

  constructor(scene: THREE.Scene, assetLoader: AssetLoader) {
    this.scene = scene;
    this.assetLoader = assetLoader;
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing GPU Billboard System...');

    // Initialize each vegetation type with GPU instancing
    const configs: Array<[string, GPUVegetationConfig]> = [
      ['fern', {
        maxInstances: 100000,  // Reduced from 200k
        texture: this.assetLoader.getTexture('Fern')!,
        width: 1.5,
        height: 2.0,
        fadeDistance: 200,  // Reduced fade distance
        maxDistance: 250
      }],
      ['elephantEar', {
        maxInstances: 30000,  // Reduced from 50k
        texture: this.assetLoader.getTexture('ElephantEarPlants')!,
        width: 2.5,
        height: 3.0,
        fadeDistance: 250,
        maxDistance: 300
      }],
      ['fanPalm', {
        maxInstances: 25000,  // Reduced from 40k
        texture: this.assetLoader.getTexture('FanPalmCluster')!,
        width: 3,
        height: 4,
        fadeDistance: 300,
        maxDistance: 350
      }],
      ['coconut', {
        maxInstances: 20000,  // Reduced from 30k
        texture: this.assetLoader.getTexture('CoconutPalm')!,
        width: 5,
        height: 7,
        fadeDistance: 350,
        maxDistance: 400
      }],
      ['areca', {
        maxInstances: 30000,  // Reduced from 50k
        texture: this.assetLoader.getTexture('ArecaPalmCluster')!,
        width: 4,
        height: 6,
        fadeDistance: 300,
        maxDistance: 350
      }],
      ['dipterocarp', {
        maxInstances: 10000,
        texture: this.assetLoader.getTexture('DipterocarpGiant')!,
        width: 15,
        height: 20,
        fadeDistance: 500,
        maxDistance: 600
      }],
      ['banyan', {
        maxInstances: 10000,
        texture: this.assetLoader.getTexture('TwisterBanyan')!,
        width: 14,
        height: 18,
        fadeDistance: 500,
        maxDistance: 600
      }]
    ];

    for (const [type, config] of configs) {
      if (config.texture) {
        const vegetation = new GPUBillboardVegetation(this.scene, config);
        this.vegetationTypes.set(type, vegetation);
        console.log(`✅ GPU Billboard ${type}: ${config.maxInstances} max instances`);
      }
    }

    console.log('✅ GPU Billboard System initialized');
  }

  // Add instances for a chunk
  addChunkInstances(
    chunkKey: string,
    type: string,
    instances: Array<{position: THREE.Vector3, scale: THREE.Vector3, rotation: number}>
  ): void {
    const vegetation = this.vegetationTypes.get(type);
    if (!vegetation) return;

    const indices = vegetation.addInstances(instances);

    if (!this.chunkInstances.has(chunkKey)) {
      this.chunkInstances.set(chunkKey, new Map());
    }

    this.chunkInstances.get(chunkKey)!.set(type, indices);
  }

  // Remove all instances for a chunk
  removeChunkInstances(chunkKey: string): void {
    const chunkData = this.chunkInstances.get(chunkKey);
    if (!chunkData) return;

    let totalRemoved = 0;
    chunkData.forEach((indices, type) => {
      const vegetation = this.vegetationTypes.get(type);
      if (vegetation) {
        vegetation.removeInstances(indices);
        totalRemoved += indices.length;
      }
    });

    this.chunkInstances.delete(chunkKey);
    console.log(`🗑️ GPU: Removed ${totalRemoved} vegetation instances for chunk ${chunkKey}`);
  }

  // Update all vegetation (called every frame)
  update(camera: THREE.Camera, deltaTime: number): void {
    const time = performance.now() * 0.001; // Convert to seconds

    this.vegetationTypes.forEach(vegetation => {
      vegetation.update(camera, time);
    });
  }

  // Update with explicit world position (for VR)
  updateWithWorldPosition(camera: THREE.Camera, worldPosition: THREE.Vector3, deltaTime: number): void {
    const time = performance.now() * 0.001; // Convert to seconds

    this.vegetationTypes.forEach(vegetation => {
      vegetation.updateWithWorldPosition(camera, worldPosition, time);
    });
  }

  // Get debug info
  getDebugInfo(): { [key: string]: number } {
    const info: { [key: string]: number } = {};

    this.vegetationTypes.forEach((vegetation, type) => {
      info[`${type}Active`] = vegetation.getInstanceCount();
    });

    info.chunksTracked = this.chunkInstances.size;

    // Log chunk keys for debugging
    if (this.chunkInstances.size > 20) {
      const chunkKeys = Array.from(this.chunkInstances.keys());
      console.warn(`⚠️ GPU: Tracking ${this.chunkInstances.size} chunks:`, chunkKeys.slice(0, 10), '...');
    }

    return info;
  }

  /**
   * Clear vegetation instances in a specific area
   */
  clearInstancesInArea(centerX: number, centerZ: number, radius: number): void {
    console.log(`🗑️ GPU: Clearing vegetation in ${radius}m radius around (${centerX}, ${centerZ})`);

    let totalCleared = 0;

    // Go through each vegetation type
    this.vegetationTypes.forEach((vegetation, type) => {
      const indicesToRemove: number[] = [];

      // Check each instance position
      const positions = vegetation.getInstancePositions(); // We'll need to implement this
      for (let i = 0; i < positions.length; i += 3) { // x, y, z
        const x = positions[i];
        const z = positions[i + 2];

        const distance = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
        if (distance <= radius) {
          indicesToRemove.push(i / 3); // Convert back to instance index
        }
      }

      if (indicesToRemove.length > 0) {
        vegetation.removeInstances(indicesToRemove);
        totalCleared += indicesToRemove.length;
        console.log(`🗑️ GPU: Removed ${indicesToRemove.length} ${type} instances`);
      }
    });

    console.log(`🗑️ GPU: Total vegetation instances cleared: ${totalCleared}`);
  }

  // Dispose all resources
  dispose(): void {
    this.vegetationTypes.forEach(vegetation => vegetation.dispose());
    this.vegetationTypes.clear();
    this.chunkInstances.clear();
  }
}