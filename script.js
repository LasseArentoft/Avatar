// TOP OF script.js
// Local ES Module Imports with CORRECTED CASE-SENSITIVITY for common Three.js examples folder names
import * as THREE from './JS/Three/Build/three.module.js';
import { GLTFLoader } from './JS/Three/examples/Jsm/Loaders/GLTFLoader.js'; // **CRITICAL FIX: Removed stray '='**
import { OrbitControls } from './JS/Three/examples/Jsm/controls/OrbitControls.js'; // 'controls' is lowercase
import { BufferGeometryUtils } from './JS/Three/examples/Jsm/utils/BufferGeometryUtils.js'; // 'utils' is lowercase

let mixer;
const clock = new THREE.Clock();
let faceMesh = null;
let headMeshBlendShapeNames = null;
let controls;
let jawOpenIndex = -1; 

// Variables for smooth blend shape transitions
const currentBlendShapeInfluences = {}; 
const targetBlendShapeInfluences = {};  
const blendShapeLerpFactor = 0.25; // Adjusted for faster transitions

// Variables for teeth and tongue movement, now driven by their own blend shapes
let teethMesh = null;
let teethBlendShapeNames = null;
let tongueMesh = null;
let tongueBlendShapeNames = null;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight); 

scene.background = new THREE.Color(0x87ceeb); // Sky blue

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0, 10, 5);
scene.add(directionalLight);

// The red cube was for initial debugging, you can remove these lines if you want,
// but they don't harm anything now.
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color
const cube = new THREE.Mesh(geometry, material);
cube.position.set(0, 0.5, 0);
scene.add(cube);
console.log("Added a red cube to the scene.");

// --- IMPORTANT: Append canvas to the specific section ---
document.getElementById('avatar-section').appendChild(renderer.domElement); 
// --- END IMPORTANT CHANGE ---

const loader = new GLTFLoader();

loader.load(
    'lasseavatarv2.glb', 
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
            action.play(); 
            console.log('Animation clip found:', clip.name || 'Unnamed clip', ' - NOW PLAYING');
        } else {
            console.log('No animations found in the model. Cannot play pre-baked animations.');
        }

        avatar.traverse(function (child) {
            if (child.isMesh) { 
                console.log('Found mesh:', child.name); 
                if (child.name === 'Head_Mesh' && child.morphTargetInfluences && child.morphTargetInfluences.length > 0) {
                    faceMesh = child;
                    headMeshBlendShapeNames = child.morphTargetDictionary;
                    console.log('Reference to Head_Mesh stored for lip-sync.');
                    for (const name in headMeshBlendShapeNames) {
                        currentBlendShapeInfluences[name] = 0;
                        targetBlendShapeInfluences[name] = 0;
                    }
                    if (headMeshBlendShapeNames['jawOpen'] !== undefined) {
                        jawOpenIndex = headMeshBlendShapeNames['jawOpen'];
                        console.log(`'jawOpen' blend shape index: ${jawOpenIndex}`);
                    } else {
                        console.warn("'jawOpen' blend shape not found in dictionary.");
                    }
                }
                
                // Handle Teeth_Mesh blend shapes 
                if (child.name === 'Teeth_Mesh' && child.morphTargetInfluences && child.morphTargetInfluences.length > 0) {
                    teethMesh = child;
                    teethBlendShapeNames = child.morphTargetDictionary;
                    console.log('Reference to Teeth_Mesh stored with its blend shapes.');
                }
                // Handle Tongue_Mesh blend shapes 
                if (child.name === 'Tongue_Mesh' && child.morphTargetInfluences && child.morphTargetInfluences.length > 0) {
                    tongueMesh = child;
                    tongueBlendShapeNames = child.morphTargetDictionary;
                    console.log('Reference to Tongue_Mesh stored with its blend shapes.');
                }
            }
        });

        console.log('Debugging: faceMesh variable is', faceMesh);
        console.log('Debugging: headMeshBlendShapeNames variable is', headMeshBlendShapeNames);
        console.log('Debugging: jawOpenIndex is', jawOpenIndex);
        console.log('Debugging: teethMesh variable is', teethMesh);
        console.log('Debugging: tongueMesh variable is', tongueMesh);
        console.log('Debugging: teethBlendShapeNames variable is', teethBlendShapeNames);
        console.log('Debugging: tongueBlendShapeNames variable is', tongueBlendShapeNames);
        
        renderer.render(scene, camera);
        console.log("Forced initial render after model load.");

        animate();
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
    
    if (faceMesh && faceMesh.morphTargetInfluences && headMeshBlendShapeNames) {
        if (!isSpeaking) {
            // Idle breathing animation
            const idleBreathAmount = (Math.sin(clock.getElapsedTime() * 2) * 0.005) + 0.005; 
            targetBlendShapeInfluences['jawOpen'] = idleBreathAmount;
            targetBlendShapeInfluences['mouthOpen'] = idleBreathAmount * 0.5;
            targetBlendShapeInfluences['viseme_sil'] = 0.0; 
        }

        // Apply lerping to head blend shapes
        for (const name in targetBlendShapeInfluences) {
            const index = headMeshBlendShapeNames[name];
            if (index !== undefined && faceMesh.morphTargetInfluences[index] !== undefined) {
                currentBlendShapeInfluences[name] = THREE.MathUtils.lerp(
                    currentBlendShapeInfluences[name],
                    targetBlendShapeInfluences[name],
                    blendShapeLerpFactor
                );
                faceMesh.morphTargetInfluences[index] = currentBlendShapeInfluences[name];
            }
        }

        // Drive teeth and tongue using their own blend shapes, if they exist 
        if (headMeshBlendShapeNames['jawOpen'] !== undefined) {
            const jawOpenInfluence = currentBlendShapeInfluences['jawOpen']; 

            if (teethMesh && teethBlendShapeNames) {
                let teethJawOpenIndex = teethBlendShapeNames['jawOpen'];
                if (teethJawOpenIndex === undefined) {
                    teethJawOpenIndex = teethBlendShapeNames['mouthOpen']; // Fallback
                }
                if (teethJawOpenIndex === undefined) {
                    teethJawOpenIndex = teethBlendShapeNames['viseme_sil']; // Another fallback
                }

                if (teethJawOpenIndex !== undefined && teethMesh.morphTargetInfluences[teethJawOpenIndex] !== undefined) {
                     teethMesh.morphTargetInfluences[teethJawOpenIndex] = jawOpenInfluence; // Apply head's jawOpen
                } else {
                    console.warn("Teeth_Mesh does not have a suitable blend shape for jaw movement (jawOpen/mouthOpen/viseme_sil).");
                }
            }

            if (tongueMesh && tongueBlendShapeNames) {
                let tongueJawOpenIndex = tongueBlendShapeNames['jawOpen'];
                if (tongueJawOpenIndex === undefined) {
                    tongueJawOpenIndex = tongueBlendShapeNames['mouthOpen']; // Fallback
                }
                if (tongueJawOpenIndex === undefined) {
                    tongueJawOpenIndex = tongueBlendShapeNames['viseme_sil']; // Another fallback
                }

                if (tongueJawOpenIndex !== undefined && tongueMesh.morphTargetInfluences[tongueJawOpenIndex] !== undefined) {
                    tongueMesh.morphTargetInfluences[tongueJawOpenIndex] = jawOpenInfluence; // Apply head's jawOpen
                } else {
                    console.warn("Tongue_Mesh does not have a suitable blend shape for jaw movement (jawOpen/mouthOpen/viseme_sil).");
                }
            }
        }
    }

    if (controls) {
        controls.update();
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Refined Viseme Definitions based on available blend shapes and common phonetic interpretations
const visemeDefinitions = {
    'sil': { 'viseme_sil': 1.0, 'jawOpen': 0.0, 'mouthOpen': 0.0 }, // Silence/resting
    'A': { 'mouthOpen': 0.7, 'jawOpen': 0.6 }, // Broad 'a' sound
    'E': { 'mouthOpen': 0.5, 'jawOpen': 0.4 }, // Mid-open 'e' sound
    'I': { 'jawOpen': 0.3, 'jawOpen': 0.2 }, // Narrow 'i' sound
    'O': { 'mouthOpen': 0.6, 'jawOpen': 0.5 }, // Rounded 'o' sound (no specific 'mouthFunnel' on your model)
    'U': { 'mouthOpen': 0.3, 'jawOpen': 0.4 }, // Pursued 'u' sound (no specific 'mouthFunnel' on your model)
    
    'M': { 'viseme_PP': 1.0, 'jawOpen': 0.05 }, // P, B, M - lips closed, slight jaw hint
    'F': { 'viseme_FF': 1.0, 'jawOpen': 0.1 }, // F, V - upper teeth on lower lip
    'S': { 'jawOpen': 0.2, 'mouthOpen': 0.1 }, // S, Z - slight mouth opening (no specific viseme_SS)
    'CH': { 'jawOpen': 0.3, 'mouthOpen': 0.2 }, // CH, J, SH - slightly pursed/open (no specific viseme_CH)
    'TH': { 'viseme_TH': 1.0, 'jawOpen': 0.15 }, // TH - tongue between teeth
    'R': { 'jawOpen': 0.3, 'mouthOpen': 0.2 }, // R - general open, slightly rounded (no specific viseme_RR)
    'K': { 'jawOpen': 0.1, 'mouthOpen': 0.05 }, // K, G, NG - minimal jaw open (no specific viseme_kk)
    
    'consonant_general': { 'jawOpen': 0.2, 'mouthOpen': 0.1 },
    'vowel_general': { 'mouthOpen': 0.6, 'jawOpen': 0.5 }
};

function applyViseme(visemeKey) {
    // Reset all targets before applying the new viseme
    for (const name in targetBlendShapeInfluences) {
        targetBlendShapeInfluences[name] = 0;
    }

    const viseme = visemeDefinitions[visemeKey];
    if (viseme) {
        console.log(`Applying viseme: ${visemeKey}`);
        for (const blendShapeName in viseme) {
            if (targetBlendShapeInfluences[blendShapeName] !== undefined) {
                targetBlendShapeInfluences[blendShapeName] = viseme[blendShapeName];
            } else {
                console.warn(`Blend shape '${blendShapeName}' for viseme '${visemeKey}' not found in targetInfluences.`);
            }
        }
    } else {
        console.warn(`Viseme definition for '${visemeKey}' not found.`);
        targetBlendShapeInfluences['viseme_sil'] = 1.0; 
    }
}


function resetBlendShapes() {
    console.log('Attempting to reset all lip-sync blend shapes.'); 
    for (const name in targetBlendShapeInfluences) {
        targetBlendShapeInfluences[name] = 0;
    }
    console.log('All lip-sync blend shapes targets set to 0. Animation will smooth to closed.'); 
}

let isSpeaking = false;
let currentUtterance = null;

function getDanishVoice() {
    const voices = speechSynthesis.getVoices();
    return voices.find(voice => voice.lang === 'da-DK' && voice.name.includes('fem')) ||
           voices.find(voice => voice.lang === 'da-DK') ||
           null;
}

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

    const danishVoice = getDanishVoice();
    if (danishVoice) {
        utterance.voice = danishVoice;
        console.log(`Using voice: ${danishVoice.name} (${danishVoice.lang})`);
    } else {
        console.warn("No Danish voice found, using default. Check console for available voices.");
    }
    utterance.rate = 1.0; 
    utterance.pitch = 1.0; 

    utterance.onstart = () => {
        console.log('Speech started event fired. Setting initial mouth pose.');
        isSpeaking = true;
        applyViseme('A'); // Start with a general open mouth
    };

    utterance.onend = () => {
        console.log('Speech ended event fired. Resetting all blend shapes.');
        isSpeaking = false;
        applyViseme('sil'); // Go to silence viseme
        setTimeout(() => resetBlendShapes(), 150); // Ensure full reset to 0 after a short delay
    };

    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event.error.toString()); 
        isSpeaking = false;
        resetBlendShapes();
    };

    utterance.onboundary = (event) => {
        if (event.name === 'word') {
            const word = text.substring(event.charIndex, event.charIndex + event.charLength).toLowerCase();

            if (word.length === 0) {
                 applyViseme('sil');
                 return;
            }

            const firstChar = word[0];
            const firstTwoChars = word.substring(0, 2);
            const firstThreeChars = word.substring(0, 3);

            // Prioritize specific visemes based on common initial sounds
            if (firstChar.match(/[bpmæøå]/)) { // Added ÆØÅ for Danish, assuming they map to closed-lip sounds
                applyViseme('M'); // P, B, M
            } else if (firstChar.match(/[fv]/) || firstTwoChars === 'w') { 
                applyViseme('F'); // F, V, W
            } else if (firstChar.match(/[sz]/)) { 
                applyViseme('S'); // S, Z (no specific viseme_SS, using jaw/mouth open)
            } else if (firstTwoChars.match(/^(ch|sh|j)/)) { 
                applyViseme('CH'); // CH, J, SH (no specific viseme_CH, using jaw/mouth open)
            } else if (firstTwoChars === 'th' || firstChar.match(/[tdn]/)) { 
                applyViseme('TH'); // TH, T, D, N
            } else if (firstChar === 'r') { 
                applyViseme('R'); // R (no specific viseme_RR, using jaw/mouth open)
            } else if (firstChar === 'k' || firstChar === 'g' || firstThreeChars === 'ng') { 
                applyViseme('K'); // K, G, NG (no specific viseme_kk, using jaw/mouth open)
            }
            // Vowel sounds (fallback if no specific consonant match)
            else if (firstChar.match(/[aeiouyøå]/)) {
                if (firstChar.match(/[ouå]/) || firstTwoChars.match(/^(oo)/)) { 
                    applyViseme('U'); // O, U, Å
                } else if (firstChar === 'a') {
                    applyViseme('A');
                } else if (firstChar === 'e') {
                    applyViseme('E');
                } else if (firstChar === 'i' || firstChar === 'y') {
                    applyViseme('I');
                } else {
                    applyViseme('vowel_general'); 
                }
            } else {
                applyViseme('consonant_general'); // Any other consonant
            }

        } else if (event.name === 'sentence' || event.name === 'mark') {
            applyViseme('sil'); // Ensure silence at sentence end or punctuation
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
        console.log("Speech voices changed/loaded. Available voices:");
        const voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
            console.warn("No speech synthesis voices available on this browser/system.");
        } else {
            voices.forEach(voice => {
                console.log(`- ${voice.name} (${voice.lang}) - default: ${voice.default}`);
            });
        }
    };
    if (speechSynthesis.getVoices().length > 0) {
        speechSynthesis.onvoiceschanged();
    }
});