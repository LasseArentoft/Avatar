import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let mixer;
const clock = new THREE.Clock();
let faceMesh = null; // Declare faceMesh globally
let headMeshBlendShapeNames = null; // Store the blend shape dictionary globally

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
    'lasseavatarv2.glb',
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
        }

        // --- Store reference to Head_Mesh and its blend shapes ---
        avatar.traverse(function (child) {
            if (child.isMesh && child.morphTargetInfluences && child.morphTargetInfluences.length > 0) {
                console.log('Found mesh with blend shapes (morph targets)!');
                console.log('Mesh Name:', child.name);
                console.log('Blend Shape Names:', child.morphTargetDictionary);

                if (child.name === 'Head_Mesh') { // Assuming 'Head_Mesh' is the one with facial blend shapes
                    faceMesh = child;
                    headMeshBlendShapeNames = child.morphTargetDictionary;
                    console.log('Reference to Head_Mesh stored for lip-sync.');
                }
            }
        });
        if (!faceMesh) {
            console.log('Head_Mesh with blend shapes not found. Lip-sync might be difficult.');
        }
        // --- End Store reference ---

        // Du kan gemme en reference til avataren, hvis du vil manipulere den senere
        // window.myAvatar = avatar; // Gør den tilgængelig globalt for debugging
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

// --- NEW: Text-to-Speech (TTS) and Lip-Sync Functionality ---

// A simple map of common phoneme-like sounds to your visemes
// This is a simplified mapping as browser TTS doesn't give precise phonemes.
// We'll primarily use mouthOpen for basic speech and maybe one or two other shapes.
const lipSyncVisemeMap = {
    'mouthOpen': 'jawOpen', // Good for general open mouth sounds like A, O, E
    'mouthClose': 'mouthClose', // For M, B, P sounds
    'mouthFunnel': 'mouthFunnel', // For U, O sounds
    'mouthPucker': 'mouthPucker', // For U, W sounds
    'viseme_FF': 'viseme_FF', // For F, V sounds
    'viseme_TH': 'viseme_TH', // For Th sounds
    'viseme_SS': 'viseme_SS', // For S, Z sounds
    'viseme_CH': 'viseme_CH', // For Ch, J sounds
    'viseme_RR': 'viseme_RR', // For R sounds
    'viseme_sil': 'viseme_sil', // For silence
    'viseme_PP': 'viseme_PP', // For P sounds
    'viseme_DD': 'viseme_DD', // For D, N sounds
    'viseme_kk': 'viseme_kk', // For K, G sounds
    // Generic open mouth fallback if specific viseme not found
    'defaultOpen': 'jawOpen',
    // Generic closed mouth fallback
    'defaultClose': 'mouthClose'
};

// Function to reset all blend shapes to 0 (neutral pose)
function resetBlendShapes() {
    if (faceMesh && faceMesh.morphTargetInfluences) {
        for (const key in headMeshBlendShapeNames) {
            const index = headMeshBlendShapeNames[key];
            if (faceMesh.morphTargetInfluences[index] !== undefined) {
                faceMesh.morphTargetInfluences[index] = 0;
            }
        }
    }
}

// Function to activate a specific blend shape
function activateBlendShape(name, influence = 1.0) {
    if (faceMesh && headMeshBlendShapeNames) {
        const index = headMeshBlendShapeNames[name];
        if (index !== undefined && faceMesh.morphTargetInfluences[index] !== undefined) {
            faceMesh.morphTargetInfluences[index] = influence;
        } else {
            // console.warn(`Blend shape '${name}' not found.`);
        }
    }
}

// Global variable to keep track of speaking state
let isSpeaking = false;
let currentUtterance = null; // To keep track of the current speech synthesis

function speak(text) {
    if (!faceMesh || !headMeshBlendShapeNames) {
        console.error("Avatar face mesh or blend shape names not loaded yet.");
        return;
    }

    if (isSpeaking) {
        // Stop current speech if any
        if (currentUtterance) {
            speechSynthesis.cancel();
        }
        isSpeaking = false;
        resetBlendShapes(); // Reset face immediately
    }

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;

    // Optional: Choose a voice
    // You can get a list of voices via speechSynthesis.getVoices()
    // For Danish, you might look for a voice like "Karen" or "Sara"
    // utterance.voice = speechSynthesis.getVoices().find(voice => voice.lang === 'da-DK' && voice.name === 'Sara');

    utterance.onstart = () => {
        console.log('Speech started');
        isSpeaking = true;
        // Apply a general "mouth open" for the duration of speech
        activateBlendShape(lipSyncVisemeMap['defaultOpen'], 0.5); // Slightly open mouth
    };

    utterance.onend = () => {
        console.log('Speech ended');
        isSpeaking = false;
        resetBlendShapes(); // Reset face to neutral
    };

    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error);
        isSpeaking = false;
        resetBlendShapes();
    };

    // The 'onboundary' event can give us some basic timing for words/sentences.
    // We'll use this to briefly "open" the mouth for each word.
    utterance.onboundary = (event) => {
        if (event.name === 'word' || event.name === 'sentence') {
            // For a basic mouth animation without precise phoneme data
            // We'll briefly open and close the mouth
            activateBlendShape(lipSyncVisemeMap['defaultOpen'], 0.7); // Open more for a word
            setTimeout(() => {
                // If still speaking and not at the end of the word, return to slight open
                if (isSpeaking) {
                    activateBlendShape(lipSyncVisemeMap['defaultOpen'], 0.5);
                }
            }, 100); // Keep mouth open for 100ms for each word/sentence boundary
        }
    };

    speechSynthesis.speak(utterance);
}

// --- Example Usage (add a button or call this function) ---
// For testing, let's add a simple button to trigger speech
// You'll need to add a button to your index.html: <button id="speakButton">Speak</button>

document.addEventListener('DOMContentLoaded', () => {
    const speakButton = document.createElement('button');
    speakButton.id = 'speakButton';
    speakButton.textContent = 'Få avatar til at tale'; // "Make avatar speak" in Danish
    speakButton.style.position = 'absolute';
    speakButton.style.top = '10px';
    speakButton.style.left = '10px';
    speakButton.style.zIndex = '100'; // Ensure it's above the canvas
    document.body.appendChild(speakButton);

    speakButton.addEventListener('click', () => {
        // You can change this text to whatever you want the avatar to say
        const textToSpeak = "Hej med dig. Jeg er din nye digitale assistent. Hvordan kan jeg hjælpe dig i dag?";
        speak(textToSpeak);
    });

    // To ensure voices are loaded, sometimes getVoices needs a slight delay or an event listener
    speechSynthesis.onvoiceschanged = () => {
        console.log("Speech voices changed/loaded.");
        // You can now access speechSynthesis.getVoices()
    };
});
