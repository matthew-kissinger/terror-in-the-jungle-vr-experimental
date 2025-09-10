import * as THREE from 'three';

// Billboard vertex shader
const billboardVertexShader = `
attribute vec3 position;
attribute vec2 uv;
attribute mat4 instanceMatrix;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;

varying vec2 vUv;

void main() {
  vUv = uv;
  
  // Extract instance position from instance matrix
  vec3 instancePos = vec3(instanceMatrix[3]);
  
  // Calculate billboard rotation to face camera
  vec3 toCamera = cameraPosition - instancePos;
  toCamera.y = 0.0; // Cylindrical billboard (only rotate on Y axis)
  toCamera = normalize(toCamera);
  
  // Build rotation matrix
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(up, toCamera));
  mat3 billboardMatrix = mat3(right, up, toCamera);
  
  // Apply billboard rotation to vertex position
  vec3 billboardPos = billboardMatrix * position;
  
  // Apply instance transformation (position and scale)
  vec4 worldPos = instanceMatrix * vec4(billboardPos, 1.0);
  
  gl_Position = projectionMatrix * modelViewMatrix * worldPos;
}
`;

// Billboard fragment shader
const billboardFragmentShader = `
uniform sampler2D map;
varying vec2 vUv;

void main() {
  vec4 texColor = texture2D(map, vUv);
  if (texColor.a < 0.1) discard; // Alpha test for pixel-perfect transparency
  gl_FragColor = texColor;
}
`;

export class BillboardShaderMaterial extends THREE.ShaderMaterial {
  constructor(texture: THREE.Texture) {
    // Configure texture for pixel-perfect rendering
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.flipY = true;
    texture.generateMipmaps = false;

    super({
      vertexShader: billboardVertexShader,
      fragmentShader: billboardFragmentShader,
      uniforms: {
        map: { value: texture },
        cameraPosition: { value: new THREE.Vector3() }
      },
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
  }

  /**
   * Update the camera position uniform for billboard calculations
   * This should be called once per frame
   */
  updateCamera(camera: THREE.Camera): void {
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    this.uniforms.cameraPosition.value.copy(cameraPosition);
  }

  /**
   * Set the texture map
   */
  setTexture(texture: THREE.Texture): void {
    // Configure texture for pixel-perfect rendering
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.flipY = true;
    texture.generateMipmaps = false;

    this.uniforms.map.value = texture;
  }

  /**
   * Get the current texture
   */
  getTexture(): THREE.Texture {
    return this.uniforms.map.value;
  }
}