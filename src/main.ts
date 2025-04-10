import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css'

// Log Three.js version
console.log('Three.js version:', THREE.REVISION);

// Create a scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// Create a camera
const camera = new THREE.PerspectiveCamera(
  75, // Field of view
  window.innerWidth / window.innerHeight, // Aspect ratio
  0.1, // Near clipping plane
  1000 // Far clipping plane
);
camera.position.z = 5;

// Create a renderer with antialiasing
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Add orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth camera movement
controls.dampingFactor = 0.05; // Adjust damping factor for smoother control
controls.enableZoom = true;    // Enable zooming
controls.enablePan = true;     // Enable panning

// Add lights
const ambientLight = new THREE.AmbientLight(0x404040); // soft white light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Create a cube
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshPhongMaterial({ 
  color: 0x44aa88,
  shininess: 100,
  flatShading: true
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Handle window resize
window.addEventListener('resize', () => {
  // Update camera aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  
  // Update renderer size
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Rotate the cube
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  
  // Update controls for smooth camera movement
  controls.update();
  
  // Render the scene
  renderer.render(scene, camera);
}

// Start the animation loop
animate();
