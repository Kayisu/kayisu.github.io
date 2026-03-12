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
controls.maxDistance = 250; // Increased to see Pluto

// Raycaster for click detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Global State
const planets = [];
const interactables = []; // Meshes we can click

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
sun.userData = { name: 'sun', type: 'star', desc: 'The heart of the solar system. A massive burning ball of hydrogen and helium.' };
scene.add(sun);
interactables.push(sun);

// Helper function to create planets and their orbit rings
function createPlanet(name, radius, distance, speed, colorHex, type, desc, hasRing=false) {
    // Planet mesh with unique color
    const planetMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        ...materialProps
    });
    const geo = new THREE.SphereGeometry(radius, 32, 32);
    const mesh = new THREE.Mesh(geo, planetMat);
    mesh.userData = { name, type, desc };
    interactables.push(mesh);
    
    // Group to handle the orbit rotation easily
    const orbitGroup = new THREE.Group();
    
    // Position the planet out from the center
    mesh.position.x = distance;
    
    // Optional Saturn ring
    if (hasRing) {
        const ringGeo = new THREE.RingGeometry(radius * 1.4, radius * 2.2, 32);
        const ringMat = new THREE.MeshStandardMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.6});
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        mesh.add(ring); // attach ring to planet
    }

    orbitGroup.add(mesh);

    // Add the orbit ring line
    const orbitPathGeo = new THREE.RingGeometry(distance, distance + 0.05, 128);
    const orbitEdges = new THREE.EdgesGeometry(orbitPathGeo);
    const orbitLine = new THREE.LineLoop(orbitEdges, orbitMaterial);
    orbitLine.rotation.x = Math.PI / 2; // Lay flat
    scene.add(orbitLine);
    
    scene.add(orbitGroup);
    
    planets.push({
        group: orbitGroup,
        mesh: mesh,
        speed: speed,
        distance: distance
    });
}

// 2. Create 8+1 planets (Radius, Distance, Speed, Color, Type, Desc)
// Distances/speeds are scaled for aesthetics, not 100% physically accurate
createPlanet('mercury', 0.4, 6, 0.015, 0x8c7c6e, 'Terrestrial', 'The smallest and innermost planet, blistering hot during the day.');
createPlanet('venus', 0.8, 10, 0.011, 0xe3bb76, 'Terrestrial', 'A dense, toxic atmosphere traps heat in a runaway greenhouse effect.');
createPlanet('earth', 0.9, 15, 0.009, 0x5a7684, 'Terrestrial', 'Our home world. The only known planet to harbor life.');
createPlanet('mars', 0.7, 21, 0.007, 0x9b5d4e, 'Terrestrial', 'The Red Planet, known for its iron oxide surface and ancient river valleys.');
createPlanet('jupiter', 2.0, 32, 0.004, 0xbcaf9b, 'Gas Giant', 'The largest planet, featuring a Great Red Spot and dozens of moons.');
createPlanet('saturn', 1.7, 45, 0.003, 0xe2cfb5, 'Gas Giant', 'Adorned with a dazzling, complex system of icy rings.', true);
createPlanet('uranus', 1.2, 58, 0.002, 0xaed6f1, 'Ice Giant', 'Rolls on its side as it orbits, appearing as a pale blue dot.');
createPlanet('neptune', 1.1, 70, 0.0015, 0x2e86c1, 'Ice Giant', 'A dark, cold, and very windy world in the outer solar system.');
createPlanet('pluto', 0.3, 85, 0.001, 0xdddddd, 'Dwarf Planet', 'A beloved dwarf planet floating in the Kuiper Belt.');

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


// --- Client-Side Routing & Raycasting ---
const uiPanel = document.getElementById('planet-info-panel');
const uiName = document.getElementById('planet-name');
const uiType = document.getElementById('planet-type');
const uiDesc = document.querySelector('.planet-desc');
const closeBtn = document.getElementById('close-btn');

function navigateTo(path) {
    window.history.pushState({}, '', path);
    handleRoute();
}

function handleRoute() {
    const path = window.location.pathname;
    
    if (path.startsWith('/planet/') || path === '/star/sun') {
        const parts = path.split('/');
        const targetName = parts[parts.length - 1].toLowerCase();
        
        // Find data from interactables
        const targetObj = interactables.find(obj => obj.userData.name === targetName);
        if (targetObj) {
            uiName.textContent = targetObj.userData.name;
            uiType.textContent = targetObj.userData.type;
            uiDesc.textContent = targetObj.userData.desc;
            uiPanel.classList.remove('hidden');
        } else {
            uiPanel.classList.add('hidden');
        }
    } else {
        uiPanel.classList.add('hidden');
    }
}

// Handle browser back/forward buttons
window.addEventListener('popstate', handleRoute);

// Handle clicking close
closeBtn.addEventListener('click', () => {
    navigateTo('/');
});

// Raycasting: Click on 3D objects
window.addEventListener('click', (event) => {
    // Exclude clicks on UI elements
    if (event.target.closest('#planet-info-panel') || event.target.closest('.content')) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactables);

    if (intersects.length > 0) {
        const clickedObj = intersects[0].object;
        const name = clickedObj.userData.name;
        if (name === 'sun') {
            navigateTo('/star/sun');
        } else {
            navigateTo(`/planet/${name}`);
        }
    }
});

// Run route handler on load
handleRoute();

// Window Resize Handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

animate();
