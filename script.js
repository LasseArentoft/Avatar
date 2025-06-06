import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let mixer;
const clock = new THREE.Clock();
let faceMesh = null;
let headMeshBlendShapeNames = null;
let controls;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth / window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.background = new THREE.Color(0x87ceeb);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0, 10, 5);
scene.add(directionalLight);

const loader = new GLTFLoader();

// NEW: Updated model filename to 'lasseavatarv2.glb'
loader.load(
    'Lasseavatarv2.glb',
    function (gltf) {
        const avatar = gltf.scene;
        scene.add(avatar);

        camera.position.set(0, 1.5, 3);
        camera.lookAt(avatar.position);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.screenSpacePanning = false;
        controls.minDistance = 0.5;
        controls.maxDistance = 10;
        controls.target.set(0, 1.5, 0);
        controls.update();

        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(avatar);
            const clip = gltf.animations[0];
            const action = mixer.clipAction(clip);
            // action.play(); // COMMENTED OUT FOR TESTING BLEND SHAPES
            console.log('Animation clip found:', clip.name || 'Unnamed clip', ' - NOT PLAYING FOR BLEND SHAPE TEST');
        } else {
            console.log('No animations found in the model. Cannot play pre-baked animations.');
        }

        avatar.traverse(function (child) {
            if (child.isMesh && child.morphTargetInfluences && child.morphTargetInfluences.length > 0) {
                console.log('Found mesh with blend shapes (morph targets)!');
                console.log('Mesh Name:', child.name);
                console.log('Blend Shape Names:', child.morphTargetDictionary);

                if (child.name === 'Head_Mesh') {
                    faceMesh = child;
                    headMeshBlendShapeNames = child.morphTargetDictionary;
                    console.log('Reference to Head_Mesh stored for lip-sync.');
                }
            }
        });

        console.log('Debugging: faceMesh variable is', faceMesh); //
        console.log('Debugging: headMeshBlendShapeNames variable is', headMeshBlendShapeNames); //

        if (!faceMesh) {
            console.log('Head_Mesh with blend shapes not found. Lip-sync might be difficult.');
        } else {
            if (headMeshBlendShapeNames['jawOpen'] !== undefined) {
                const jawOpenIndex = headMeshBlendShapeNames['jawOpen'];
                faceMesh.morphTargetInfluences[jawOpenIndex] = 0.5;
                console.log('Direct test: Attempted to open jawOpen blend shape to 0.5'); //

                setTimeout(() => {
                    faceMesh.morphTargetInfluences[jawOpenIndex] = 0;
                    console.log('Direct test: Closed jawOpen blend shape.'); //
                }, 3000);
            } else {
                console.warn("Direct test: 'jawOpen' blend shape not found in dictionary.");
            }
        }
    },
    function (xhr) {
        if (xhr.total > 0) {
            console.log((xhr.loaded / xhr.total * 100).toFixed(2) + '% loaded');
        } else {
            console.log('Model loading progress (total size unknown)');
        }
    },
    function (error) {
        console.error('An error occurred loading the GLB model:', error);
    }
);

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    // if (mixer) { // Mixer update might conflict with blend shapes, so temporarily commenting out
    //     mixer.update(delta);
    // }
    
    if (controls) {
        controls.update();
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const lipSyncVisemeMap = {
    'mouthOpen': 'jawOpen',
    'mouthClose': 'mouthClose',
    'mouthFunnel': 'mouthFunnel',
    'mouthPucker': 'mouthPucker',
    'viseme_FF': 'viseme_FF',
    'viseme_TH': 'viseme_TH',
    'viseme_SS': 'viseme_SS',
    'viseme_CH': 'viseme_CH',
    'viseme_RR': 'viseme_RR',
    'viseme_sil': 'viseme_sil',
    'viseme_PP': 'viseme_PP',
    'viseme_DD': 'viseme_DD',
    'viseme_kk': 'viseme_kk',
    'defaultOpen': 'jawOpen',
    'defaultClose': 'mouthClose'
};

function resetBlendShapes() {
    if (faceMesh && faceMesh.morphTargetInfluences && headMeshBlendShapeNames) {
        for (const key in headMeshBlendShapeNames) {
            const index = headMeshBlendShapeNames[key];
            if (faceMesh.morphTargetInfluences[index] !== undefined) {
                faceMesh.morphTargetInfluences[index] = 0;
            }
        }
    }
}

function activateBlendShape(name, influence = 1.0) {
    if (faceMesh && headMeshBlendShapeNames) {
        const index = headMeshBlendShapeNames[name];
        if (index !== undefined && faceMesh.morphTargetInfluences[index] !== undefined) {
            faceMesh.morphTargetInfluences[index] = influence;
        }
    }
}

let isSpeaking = false;
let currentUtterance = null;

function speak(text) {
    if (!faceMesh || !headMeshBlendShapeNames) {
        console.error("Avatar face mesh or blend shape names not loaded yet.");
        return;
    }

    if (isSpeaking) {
        if (currentUtterance) {
            speechSynthesis.cancel();
        }
        isSpeaking = false;
        resetBlendShapes();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;

    utterance.onstart = () => {
        console.log('Speech started'); //
        isSpeaking = true;
        activateBlendShape(lipSyncVisemeMap['defaultOpen'], 0.5);
    };

    utterance.onend = () => {
        console.log('Speech ended'); //
        isSpeaking = false;
        resetBlendShapes();
    };

    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error); //
        isSpeaking = false;
        resetBlendShapes();
    };

    utterance.onboundary = (event) => {
        if (event.name === 'word' || event.name === 'sentence') {
            activateBlendShape(lipSyncVisemeMap['defaultOpen'], 0.7);
            setTimeout(() => {
                if (isSpeaking) {
                    activateBlendShape(lipSyncVisemeMap['defaultOpen'], 0.5);
                }
            }, 100);
        }
    };

    speechSynthesis.speak(utterance);
}

document.addEventListener('DOMContentLoaded', () => {
    const speakButton = document.createElement('button');
    speakButton.id = 'speakButton';
    speakButton.textContent = 'Få avatar til at tale';
    speakButton.style.position = 'absolute';
    speakButton.style.top = '10px';
    speakButton.style.left = '10px';
    speakButton.style.zIndex = '100';
    document.body.appendChild(speakButton);

    speakButton.addEventListener('click', () => {
        const textToSpeak = "Hej med dig. Jeg er din nye digitale assistent. Hvordan kan jeg hjælpe dig i dag?";
        speak(textToSpeak);
    });

    speechSynthesis.onvoiceschanged = () => {
        console.log("Speech voices changed/loaded.");
    };
});
