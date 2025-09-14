import * as THREE from 'three';

interface Tracer {
  mesh: THREE.Line;
  aliveUntil: number;
}

/**
 * Simple pooled tracer system using THREE.Line (keeps deps minimal).
 * For thicker lines, swap to Line2 later.
 */
export class TracerPool {
  private scene: THREE.Scene;
  private pool: Tracer[] = [];
  private active: Tracer[] = [];
  private maxTracers: number;
  private tracerMaterial: THREE.LineBasicMaterial;
  private glowMaterial: THREE.LineBasicMaterial;

  constructor(scene: THREE.Scene, maxTracers = 64) {
    this.scene = scene;
    this.maxTracers = maxTracers;
    // Make tracers invisible - we only need them for hit detection tracking
    this.tracerMaterial = new THREE.LineBasicMaterial({
      color: 0xffaa00,
      linewidth: 1,
      opacity: 0,  // Fully transparent
      transparent: true
    });
    // Secondary glow material also invisible
    this.glowMaterial = new THREE.LineBasicMaterial({
      color: 0xffff88,
      linewidth: 1,
      opacity: 0,  // Fully transparent
      transparent: true
    });

    for (let i = 0; i < maxTracers; i++) {
      const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
      // Create a group with multiple lines for enhanced visibility
      const group = new THREE.Group();

      // Core tracer line
      const line = new THREE.Line(geometry.clone(), this.tracerMaterial);
      group.add(line);

      // Glow effect line (slightly larger)
      const glowLine = new THREE.Line(geometry.clone(), this.glowMaterial);
      glowLine.scale.set(1.1, 1.1, 1.1);
      group.add(glowLine);

      group.visible = false;
      this.pool.push({ mesh: group as any, aliveUntil: 0 });
      this.scene.add(group);
    }
  }

  spawn(start: THREE.Vector3, end: THREE.Vector3, lifetimeMs = 150): void {
    const tracer = this.pool.pop() || this.active.shift();
    if (!tracer) return;

    // Update all lines in the group
    const group = tracer.mesh as unknown as THREE.Group;
    group.children.forEach((child) => {
      if (child instanceof THREE.Line) {
        const positions = (child.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute;
        positions.setXYZ(0, start.x, start.y, start.z);
        positions.setXYZ(1, end.x, end.y, end.z);
        positions.needsUpdate = true;
      }
    });

    group.visible = true;
    tracer.aliveUntil = performance.now() + lifetimeMs;
    this.active.push(tracer);
  }

  update(): void {
    const now = performance.now();
    for (let i = this.active.length - 1; i >= 0; i--) {
      const tracer = this.active[i];
      const timeLeft = tracer.aliveUntil - now;

      if (timeLeft <= 0) {
        tracer.mesh.visible = false;
        this.active.splice(i, 1);
        if (this.pool.length < this.maxTracers) this.pool.push(tracer);
      } else {
        // Fade out effect for last 50ms
        const fadeTime = 50;
        if (timeLeft < fadeTime) {
          const opacity = timeLeft / fadeTime;
          const group = tracer.mesh as unknown as THREE.Group;
          group.children.forEach((child) => {
            if (child instanceof THREE.Line) {
              (child.material as THREE.LineBasicMaterial).opacity =
                child === group.children[0] ? opacity * 0.9 : opacity * 0.3;
            }
          });
        }
      }
    }
  }

  dispose(): void {
    this.active.forEach(t => this.scene.remove(t.mesh));
    this.pool.forEach(t => this.scene.remove(t.mesh));
    this.active.length = 0;
    this.pool.length = 0;
    this.tracerMaterial.dispose();
    this.glowMaterial.dispose();
  }
}


