import * as THREE from 'three';
import { PixelPerfectUtils } from '../utils/PixelPerfect';

export class SandboxRenderer {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  private spawnLoadingDiv?: HTMLDivElement;
  private crosshair?: HTMLDivElement;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // Disabled for pixel-perfect rendering
      powerPreference: 'high-performance'
    });

    this.setupRenderer();
    this.setupLighting();
  }

  private setupRenderer(): void {
    // Configure for pixel-perfect rendering
    PixelPerfectUtils.configureRenderer(this.renderer);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    document.body.appendChild(this.renderer.domElement);

    // Hide renderer initially
    this.renderer.domElement.style.display = 'none';
  }

  private setupLighting(): void {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0x87CEEB, 0.6);
    this.scene.add(ambientLight);

    // Directional light (sun) with shadows
    const directionalLight = new THREE.DirectionalLight(0xFFE5B4, 0.8);
    directionalLight.position.set(50, 100, 30);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;

    this.scene.add(directionalLight);

    console.log('✨ Lighting setup complete');
  }

  showRenderer(): void {
    this.renderer.domElement.style.display = 'block';
  }

  hideRenderer(): void {
    this.renderer.domElement.style.display = 'none';
  }

  onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  showCrosshair(): void {
    if (this.crosshair) return;

    this.crosshair = document.createElement('div');
    this.crosshair.style.position = 'fixed';
    this.crosshair.style.left = '50%';
    this.crosshair.style.top = '50%';
    this.crosshair.style.transform = 'translate(-50%, -50%)';
    this.crosshair.style.width = '4px';
    this.crosshair.style.height = '4px';
    this.crosshair.style.background = '#ff3333';
    this.crosshair.style.borderRadius = '50%';
    this.crosshair.style.pointerEvents = 'none';
    this.crosshair.style.zIndex = '10';
    document.body.appendChild(this.crosshair);
  }

  showSpawnLoadingIndicator(): void {
    this.spawnLoadingDiv = document.createElement('div');
    this.spawnLoadingDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10003;
      transition: opacity 0.5s ease-out;
    `;

    this.spawnLoadingDiv.innerHTML = `
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .loading-ring {
          width: 60px;
          height: 60px;
          border: 3px solid rgba(74, 124, 78, 0.2);
          border-top: 3px solid #4a7c4e;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .loading-text {
          color: #8fbc8f;
          font-family: 'Courier New', monospace;
          font-size: 18px;
          margin-top: 20px;
          animation: pulse 2s ease-in-out infinite;
        }
        .loading-tip {
          color: #708070;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          margin-top: 10px;
          max-width: 400px;
          text-align: center;
        }
      </style>
      <div class="loading-ring"></div>
      <div class="loading-text">DEPLOYING TO BATTLEFIELD</div>
      <div class="loading-tip">Generating terrain and preparing combat zone...</div>
    `;

    document.body.appendChild(this.spawnLoadingDiv);
  }

  hideSpawnLoadingIndicator(): void {
    if (this.spawnLoadingDiv) {
      this.spawnLoadingDiv.style.opacity = '0';
      setTimeout(() => {
        if (this.spawnLoadingDiv && this.spawnLoadingDiv.parentElement) {
          this.spawnLoadingDiv.parentElement.removeChild(this.spawnLoadingDiv);
          this.spawnLoadingDiv = undefined;
        }
      }, 500);
    }
  }

  getPerformanceStats(): {
    fps: number;
    drawCalls: number;
    triangles: number;
  } {
    return {
      fps: 0, // Will be calculated externally with clock
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles
    };
  }

  dispose(): void {
    // Clean up spawn loading indicator
    if (this.spawnLoadingDiv && this.spawnLoadingDiv.parentElement) {
      this.spawnLoadingDiv.parentElement.removeChild(this.spawnLoadingDiv);
    }

    // Clean up crosshair
    if (this.crosshair && this.crosshair.parentElement) {
      this.crosshair.parentElement.removeChild(this.crosshair);
    }

    // Clean up Three.js resources
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      document.body.removeChild(this.renderer.domElement);
    }
  }
}