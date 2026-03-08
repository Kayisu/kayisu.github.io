import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('stars');

// Scene Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
camera.position.set(0, 15, 40);
camera.lookAt(0, 0, 0);

// Add OrbitControls for interactive 3D navigation
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 150;

// Global State
const planets = [];

// Colors & Materials (Sleek, monochrome)
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); // Pure white sun

// Base properties for planet materials
const materialProps = {
    roughness: 0.8,
    metalness: 0.2
};
const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.5 }); // Very subtle orbits

// Add Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Brighter ambient light to see planets
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 2, 100); // Light from the sun
scene.add(pointLight);

// 1. Create the Sun
const sunGeo = new THREE.SphereGeometry(3, 32, 32);
const sun = new THREE.Mesh(sunGeo, sunMaterial);
scene.add(sun);

// Helper function to create planets and their orbit rings
function createPlanet(radius, distance, speed, colorHex) {
    // Planet mesh with unique color
    const planetMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        ...materialProps
    });
    const geo = new THREE.SphereGeometry(radius, 32, 32);
    const mesh = new THREE.Mesh(geo, planetMat);
    
    // Group to handle the orbit rotation easily
    const orbitGroup = new THREE.Group();
    orbitGroup.add(mesh);
    
    // Position the planet out from the center
    mesh.position.x = distance;
    
    // Add the orbit ring line
    const orbitPathGeo = new THREE.RingGeometry(distance, distance + 0.05, 64);
    const orbitEdges = new THREE.EdgesGeometry(orbitPathGeo);
    const orbitLine = new THREE.LineLoop(orbitEdges, orbitMaterial);
    orbitLine.rotation.x = Math.PI / 2; // Lay flat
    scene.add(orbitLine);
    
    scene.add(orbitGroup);
    
    planets.push({
        group: orbitGroup,
        mesh: mesh,
        speed: speed
    });
}

// 2. Create planets
// Radius, Distance from sun, Orbit speed, Color
createPlanet(0.8, 8, 0.005, 0x8c7c6e);  // Mercury-ish (muted brownish grey)
createPlanet(1.2, 14, 0.003, 0x5a7684); // Earth-ish (muted steel blue)
createPlanet(1.5, 21, 0.002, 0x9b5d4e); // Mars-ish (muted rust red)
createPlanet(0.9, 28, 0.001, 0x7a8b99); // Neptune-ish (muted pale blue/grey)

// 3. Create background stars (3D points)
const starsGeo = new THREE.BufferGeometry();
const starsCount = 1500;
const posArray = new Float32Array(starsCount * 3);
const alphaArray = new Float32Array(starsCount);

for(let i = 0; i < starsCount * 3; i+=3) {
    // Random positions in a large sphere
    const r = 100 + Math.random() * 200;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    
    posArray[i] = r * Math.sin(phi) * Math.cos(theta); // x
    posArray[i+1] = r * Math.sin(phi) * Math.sin(theta); // y
    posArray[i+2] = r * Math.cos(phi); // z
    
    alphaArray[i/3] = Math.random();
}

starsGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
starsGeo.setAttribute('alpha', new THREE.BufferAttribute(alphaArray, 1));

// Shader material for twinkling stars
const starsMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 }
    },
    vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
            vAlpha = alpha;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (1.5 / -mvPosition.z) * 150.0;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform float time;
        varying float vAlpha;
        void main() {
            // Twinkle math
            float twinkle = sin(time * 2.0 + vAlpha * 10.0) * 0.5 + 0.5;
            float finalAlpha = vAlpha * 0.5 + twinkle * 0.5;
            
            // Circular particle
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            
            gl_FragColor = vec4(1.0, 1.0, 1.0, finalAlpha * 0.8);
        }
    `,
    transparent: true,
    depthWrite: false
});

const starParticles = new THREE.Points(starsGeo, starsMaterial);
scene.add(starParticles);

// Add a slight tilt to the whole scene for better 3D effect
scene.rotation.x = 0.2;
scene.rotation.z = 0.1;

// Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Rotate planets
    planets.forEach(planet => {
        planet.group.rotation.y += planet.speed;
        planet.mesh.rotation.y += 0.01; // Spin planet on axis
    });
    
    // Very slowly rotate the entire universe (stars + tilt)
    scene.rotation.y = elapsedTime * 0.02;

    // Update star shader time
    starsMaterial.uniforms.time.value = elapsedTime;

    // Update controls (required for damping)
    controls.update();

    renderer.render(scene, camera);
}


// Window Resize Handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

animate();
