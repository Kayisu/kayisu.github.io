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
controls.enablePan = true; // Allow panning for free navigation
controls.minDistance = 2;
controls.maxDistance = 300; // Extended to see outer planets
controls.panSpeed = 1.2;

// Raycaster for click detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Global State
const planets = [];
const interactables = []; // Meshes we can click
let globalSpeedMultiplier = 1; // 0=Pause, 1=Play, 5=Fast, 20=Fastest

// --- Camera Animation State ---
let cameraFollowTarget = null;   // Name of the planet to track (e.g., 'earth')
let cameraZoomDistance = 10;     // How far to stay from the target
let isCameraAnimating = false;
const CAMERA_LERP_SPEED = 0.06;

// --- WASD Movement State ---
const keysPressed = {};
const KEYBOARD_MOVE_SPEED = 0.5;

// Texture Loader
const textureLoader = new THREE.TextureLoader();

// Sun: use locally hosted sun texture
const sunMaterial = new THREE.MeshBasicMaterial({ 
    map: textureLoader.load('./textures/sun.jpg'),
    color: 0xfff4c2
});

// Base properties for planet materials
const materialProps = {
    roughness: 0.7,
    metalness: 0.1
};
const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.5 }); // Very subtle orbits

// Add Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Brighter ambient to illuminate planets
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffddaa, 3, 150); // Light from the sun
scene.add(pointLight);

// 1. Create the Sun
const sunGeo = new THREE.SphereGeometry(3, 32, 32);
const sun = new THREE.Mesh(sunGeo, sunMaterial);
sun.userData = { name: 'sun', type: 'star', desc: 'The heart of the solar system. A massive burning ball of hydrogen and helium.' };
scene.add(sun);
interactables.push(sun);

// Helper function to create planets and their orbit rings
function createPlanet(name, radius, distance, colorHex, textureUrl, type, desc, hasRing=false) {
    // Kepler's Third Law Approximation: Velocity ~ 1 / sqrt(distance)
    // Scaled by 0.015 for a relaxing base speed
    const speed = (1 / Math.sqrt(distance)) * 0.015;

    // Use MeshBasicMaterial when texture is provided (always fully lit)
    // Use MeshStandardMaterial for flat color fallback (nicer with lighting)
    let planetMat;
    if (textureUrl) {
        planetMat = new THREE.MeshBasicMaterial({
            map: textureLoader.load(textureUrl)
        });
    } else {
        planetMat = new THREE.MeshStandardMaterial({
            color: colorHex,
            ...materialProps
        });
    }
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
        distance: distance,
        radius: radius
    });
}

// 2. Create 8+1 planets (Radius, Distance, Color, Type, Desc)
// Distances are scaled for aesthetics, but speeds are calculated dynamically based on distance
// All textures are locally hosted in /textures/ for reliability
createPlanet('mercury', 0.4, 6, 0x8a7761, './textures/mercury.jpg', 'Terrestrial', 'The smallest and innermost planet, blistering hot during the day.');
createPlanet('venus', 0.8, 10, 0xd4a96a, './textures/venus.jpg', 'Terrestrial', 'A dense, toxic atmosphere traps heat in a runaway greenhouse effect.');
createPlanet('earth', 0.9, 15, 0x5a7684, './textures/earth.jpg', 'Terrestrial', 'Our home world. The only known planet to harbor life.');
createPlanet('mars', 0.7, 21, 0x9b5d4e, './textures/mars.jpg', 'Terrestrial', 'The Red Planet, known for its iron oxide surface and ancient river valleys.');
createPlanet('jupiter', 2.0, 32, 0xc9a87c, './textures/jupiter.jpg', 'Gas Giant', 'The largest planet, featuring a Great Red Spot and dozens of moons.');
createPlanet('saturn', 1.7, 45, 0xe2cfb5, './textures/saturn.jpg', 'Gas Giant', 'Adorned with a dazzling, complex system of icy rings.', true);
createPlanet('uranus', 1.2, 58, 0x9ed8d8, './textures/uranus.jpg', 'Ice Giant', 'Rolls on its side as it orbits, appearing as a pale blue dot.');
createPlanet('neptune', 1.1, 70, 0x2e5fb5, './textures/neptune.jpg', 'Ice Giant', 'A dark, cold, and very windy world in the outer solar system.');
createPlanet('pluto', 0.3, 85, 0xbcb5a7, './textures/pluto.jpg', 'Dwarf Planet', 'A beloved dwarf planet floating in the Kuiper Belt.');

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
    const delta = clock.getDelta();

    // Rotate planets based on global speed
    planets.forEach(planet => {
        planet.group.rotation.y += (planet.speed * globalSpeedMultiplier);
        planet.mesh.rotation.y += (0.01 * globalSpeedMultiplier); // Spin planet on axis
    });
    
    // Very slowly rotate the entire universe (stars + tilt)
    scene.rotation.y += (0.0005 * globalSpeedMultiplier);

    // Update star shader time
    starsMaterial.uniforms.time.value = elapsedTime;

    // --- Camera Animation (Smooth Zoom, tracks moving planets) ---
    if (cameraFollowTarget) {
        const targetPos = getPlanetWorldPos(cameraFollowTarget);
        if (targetPos) {
            if (isCameraAnimating) {
                // Zoom phase: move camera towards desired position
                const direction = new THREE.Vector3().subVectors(camera.position, targetPos).normalize();
                const desiredCamPos = new THREE.Vector3().copy(targetPos).addScaledVector(direction, cameraZoomDistance);
                
                camera.position.lerp(desiredCamPos, CAMERA_LERP_SPEED);
                controls.target.lerp(targetPos, CAMERA_LERP_SPEED);
                
                if (camera.position.distanceTo(desiredCamPos) < 0.5) {
                    isCameraAnimating = false;
                }
            } else {
                // Post-zoom: keep controls.target locked on the planet so it stays centered
                controls.target.lerp(targetPos, 0.1);
            }
        }
    }

    // --- WASD Keyboard Navigation ---
    if (!isCameraAnimating) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0; // Keep movement horizontal
        forward.normalize();
        
        const right = new THREE.Vector3();
        right.crossVectors(forward, camera.up).normalize();
        
        if (keysPressed['w'] || keysPressed['W']) {
            camera.position.addScaledVector(forward, KEYBOARD_MOVE_SPEED);
            controls.target.addScaledVector(forward, KEYBOARD_MOVE_SPEED);
        }
        if (keysPressed['s'] || keysPressed['S']) {
            camera.position.addScaledVector(forward, -KEYBOARD_MOVE_SPEED);
            controls.target.addScaledVector(forward, -KEYBOARD_MOVE_SPEED);
        }
        if (keysPressed['a'] || keysPressed['A']) {
            camera.position.addScaledVector(right, -KEYBOARD_MOVE_SPEED);
            controls.target.addScaledVector(right, -KEYBOARD_MOVE_SPEED);
        }
        if (keysPressed['d'] || keysPressed['D']) {
            camera.position.addScaledVector(right, KEYBOARD_MOVE_SPEED);
            controls.target.addScaledVector(right, KEYBOARD_MOVE_SPEED);
        }
    }

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

const exploreBtn = document.getElementById('explore-btn');
const exploreName = document.getElementById('explore-name');

const detailView = document.getElementById('planet-detail-view');
const detailTitle = document.getElementById('detail-title');
const detailDesc = document.getElementById('detail-desc');
const backToSolarBtn = document.getElementById('back-to-solar-btn');

let currentSelectedPlanet = null; // Used for the info panel before routing

function navigateTo(path) {
    window.history.pushState({}, '', path);
    handleRoute();
}

function handleRoute() {
    const path = window.location.pathname;
    
    if (path.startsWith('/planet/') || path === '/star/sun') {
        // We are on a dedicated planet page
        const parts = path.split('/');
        const targetName = parts[parts.length - 1].toLowerCase();
        
        const targetObj = interactables.find(obj => obj.userData.name === targetName);
        if (targetObj) {
            // Hide main UI and show dedicated view
            uiPanel.classList.add('hidden');
            document.getElementById('stars').style.visibility = 'hidden';
            
            detailTitle.textContent = targetObj.userData.name;
            detailDesc.textContent = targetObj.userData.desc;
            detailView.classList.remove('hidden');
        }
    } else {
        // We are on the root homepage
        document.getElementById('stars').style.visibility = 'visible';
        detailView.classList.add('hidden');
        uiPanel.classList.add('hidden');
        currentSelectedPlanet = null;
    }
}

// Handle browser back/forward buttons
window.addEventListener('popstate', handleRoute);

// Handle clicking close on the info panel — stop tracking
closeBtn.addEventListener('click', () => {
    uiPanel.classList.add('hidden');
    currentSelectedPlanet = null;
    cameraFollowTarget = null; // Stop tracking
    isCameraAnimating = false;
});

// Handle clicking "Explore" inside the info panel
exploreBtn.addEventListener('click', () => {
    if (currentSelectedPlanet) {
        const route = currentSelectedPlanet === 'sun' ? '/star/sun' : `/planet/${currentSelectedPlanet}`;
        navigateTo(route);
    }
});

// Handle clicking "Back to Solar System" from the dedicated view
backToSolarBtn.addEventListener('click', () => {
    navigateTo('/');
});

// --- Camera helper: get world position of a planet mesh ---
function getPlanetWorldPos(name) {
    const target = name === 'sun' ? sun : planets.find(p => p.mesh.userData.name === name)?.mesh;
    if (!target) return null;
    // Force FULL scene graph matrix update for accurate world position
    scene.updateMatrixWorld(true);
    const pos = new THREE.Vector3();
    target.getWorldPosition(pos);
    return pos;
}

function getPlanetRadius(name) {
    if (name === 'sun') return 3;
    const planet = planets.find(p => p.mesh.userData.name === name);
    return planet ? planet.radius : 1;
}

// Smooth zoom to a named celestial body
function smoothZoomTo(name) {
    const worldPos = getPlanetWorldPos(name);
    if (!worldPos) return;
    
    const radius = getPlanetRadius(name);
    cameraZoomDistance = radius * 5 + 2; // Zoom to N radii away
    cameraFollowTarget = name;
    isCameraAnimating = true;
}

// Open Info Panel logic (trigger by raycast or search) + ZOOM
function openInfoPanel(name) {
    const targetObj = interactables.find(obj => obj.userData.name === name);
    if (targetObj) {
        currentSelectedPlanet = name;
        uiName.textContent = targetObj.userData.name;
        uiType.textContent = targetObj.userData.type;
        uiDesc.textContent = targetObj.userData.desc;
        exploreName.textContent = targetObj.userData.name;
        uiPanel.classList.remove('hidden');
        
        // Smooth zoom to the planet
        smoothZoomTo(name);
    }
}

// Raycasting: Single click on 3D objects → open info + zoom
window.addEventListener('click', (event) => {
    // Exclude clicks on UI elements
    if (event.target.closest('#planet-info-panel') || event.target.closest('.content') || event.target.closest('.sim-controls') || event.target.closest('.profile-toggle-btn')) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactables);

    if (intersects.length > 0) {
        const clickedObj = intersects[0].object;
        const name = clickedObj.userData.name;
        openInfoPanel(name);
    }
});

// Double-click: Lock camera focus on a planet
window.addEventListener('dblclick', (event) => {
    if (event.target.closest('#planet-info-panel') || event.target.closest('.content') || event.target.closest('.sim-controls')) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactables);

    if (intersects.length > 0) {
        const clickedObj = intersects[0].object;
        const name = clickedObj.userData.name;
        smoothZoomTo(name);
        openInfoPanel(name);
    }
});

// WASD Keyboard listeners
window.addEventListener('keydown', (e) => {
    // Don't capture if typing in search
    if (document.activeElement === searchInput) return;
    keysPressed[e.key] = true;
});
window.addEventListener('keyup', (e) => {
    keysPressed[e.key] = false;
});

// Run route handler on load
handleRoute();

// --- Advanced Controls (Phase 6) ---
// Profile Auto-hide logic
const mainContent = document.getElementById('main-content');
const toggleBtn = document.getElementById('profile-toggle-btn');
const toggleIcon = document.getElementById('toggle-icon');
let hideTimeout;
let isProfileLockedHidden = false;

function resetHideTimer() {
    if (isProfileLockedHidden) return; // don't show if manually closed
    
    mainContent.classList.remove('hidden');
    toggleIcon.className = 'fas fa-eye';
    
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
        mainContent.classList.add('hidden');
    }, 2000); // hide after 2 seconds of no mouse movement
}

// Reset timer on mouse move over the document
document.addEventListener('mousemove', resetHideTimer);

// Manual toggle
toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent raycasting or other clicks
    if (mainContent.classList.contains('hidden') || isProfileLockedHidden) {
        // Show
        isProfileLockedHidden = false;
        resetHideTimer();
    } else {
        // Manually hide
        isProfileLockedHidden = true;
        mainContent.classList.add('hidden');
        toggleIcon.className = 'fas fa-eye-slash';
        clearTimeout(hideTimeout);
    }
});

// Start hidden timer on load
resetHideTimer();


// Speed Controls
const speedBtns = document.querySelectorAll('.speed-btn');
speedBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Remove active class from all
        speedBtns.forEach(b => b.classList.remove('active'));
        
        // Add active to clicked
        btn.classList.add('active');
        
        // Set new speed
        globalSpeedMultiplier = parseFloat(btn.getAttribute('data-speed'));
    });
});

// Arama Motoru (Search Bar)
const searchInput = document.getElementById('planet-search');
const searchResults = document.getElementById('search-results');
const searchableObjects = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    searchResults.innerHTML = '';
    
    if (query.length === 0) {
        searchResults.classList.add('hidden');
        return;
    }
    
    const matches = searchableObjects.filter(name => name.includes(query));
    
    if (matches.length > 0) {
        searchResults.classList.remove('hidden');
        matches.forEach(match => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.textContent = match.charAt(0).toUpperCase() + match.slice(1);
            
            // Open Info Panel on search select + zoom (do not navigate immediately)
            div.addEventListener('mousedown', () => { // mousedown fires before blur
                openInfoPanel(match); // This now also zooms
                searchInput.value = '';
                searchResults.classList.add('hidden');
            });
            
            searchResults.appendChild(div);
        });
    } else {
        searchResults.classList.add('hidden');
    }
});

// Hide results when losing focus
searchInput.addEventListener('blur', () => {
    // Delay slightly so mousedown on results can fire
    setTimeout(() => { searchResults.classList.add('hidden'); }, 150);
});

// Focus prevention
searchInput.addEventListener('click', (e) => e.stopPropagation());

// Window Resize Handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

animate();
