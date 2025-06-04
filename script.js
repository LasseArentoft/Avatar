import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let mixer;
const clock = new THREE.Clock();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.background = new THREE.Color(0x87ceeb);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0, 10, 5);
scene.add(directionalLight);

const loader = new GLTFLoader();

loader.load(
    'model.glb',
    function (gltf) {
        const avatar = gltf.scene;
        scene.add(avatar);

        camera.position.set(0, 1.5, 3);
        camera.lookAt(avatar.position);

        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(avatar);
            const clip = gltf.animations[0];
            const action = mixer.clipAction(clip);
            action.play();
            console.log('Playing animation:', clip.name || 'Unnamed clip');
        } else {
            console.log('No animations found in the model. Cannot play pre-baked animations.');

            // --- NEW: Check for Blend Shapes ---
            avatar.traverse(function (child) {
                if (child.isMesh && child.morphTargetInfluences && child.morphTargetInfluences.length > 0) {
                    console.log('Found mesh with blend shapes (morph targets)!');
                    console.log('Mesh Name:', child.name);
                    console.log('Blend Shape Names:', child.morphTargetDictionary);
                    // You might want to store a reference to this mesh if it's the face
                    // window.faceMesh = child; // Example: Make it globally accessible for testing
                }
            });
            // --- END NEW ---
        }
    },
    function (xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    function (error) {
        console.error('An error occurred loading the GLB model:', error);
    }
);

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (mixer) {
        mixer.update(delta);
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
