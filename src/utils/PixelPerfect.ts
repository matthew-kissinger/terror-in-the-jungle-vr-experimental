import * as THREE from 'three';

export class PixelPerfectUtils {
  static configureTexture(texture: THREE.Texture): THREE.Texture {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.flipY = true; // Ensure proper billboard orientation
    texture.generateMipmaps = false;
    texture.needsUpdate = true; // Force texture update
    return texture;
  }

  static createPixelPerfectMaterial(texture: THREE.Texture, transparent = true): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      map: this.configureTexture(texture),
      transparent,
      alphaTest: transparent ? 0.5 : 0,  // Higher alpha test to remove outlines
      side: THREE.DoubleSide,
      depthWrite: true  // Ensure proper depth sorting
    });
  }

  static configureRenderer(renderer: THREE.WebGLRenderer): void {
    renderer.setPixelRatio(1); // Force 1:1 pixel ratio for crisp pixels
    // Note: antialiasing is controlled at renderer creation time
  }
}