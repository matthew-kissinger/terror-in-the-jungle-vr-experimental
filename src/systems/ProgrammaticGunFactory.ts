import * as THREE from 'three';

/**
 * Programmatically builds a low-poly rifle using simple boxes and cylinders.
 * Geometry is lightweight and suitable for a first-person overlay.
 */
export class ProgrammaticGunFactory {
  static createRifle(material?: THREE.Material): THREE.Group {
    const group = new THREE.Group();

    const defaultMaterial = material || new THREE.MeshBasicMaterial({ color: 0x2b2b2b });

    // Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.2), defaultMaterial);
    receiver.position.set(0, 0, 0);
    group.add(receiver);

    // Handguard
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.18), new THREE.MeshBasicMaterial({ color: 0x333333 }));
    handguard.position.set(0.75, 0, 0);
    group.add(handguard);

    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), new THREE.MeshBasicMaterial({ color: 0x202020 }));
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(1.25, 0, 0);
    group.add(barrel);

    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.18), new THREE.MeshBasicMaterial({ color: 0x252525 }));
    stock.position.set(-0.6, -0.03, 0);
    stock.rotation.z = -0.05;
    group.add(stock);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.18), new THREE.MeshBasicMaterial({ color: 0x1f1f1f }));
    grip.position.set(0.1, -0.2, 0);
    grip.rotation.z = 0.35;
    group.add(grip);

    // Rear sight
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.12), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    rearSight.position.set(-0.1, 0.12, 0);
    group.add(rearSight);

    // Front sight
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.12), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    frontSight.position.set(1.0, 0.1, 0);
    group.add(frontSight);

    // Muzzle point helper (for tracers) - before rotations
    const muzzle = new THREE.Object3D();
    muzzle.name = 'muzzle';
    muzzle.position.set(1.7, 0, 0); // near end of barrel
    group.add(muzzle);

    // Don't apply rotations here - they will be handled in FirstPersonWeapon
    // Just ensure the gun model is oriented with barrel along +X axis

    // Scale for better visibility
    group.scale.set(0.75, 0.75, 0.75);
    return group;
  }
}


