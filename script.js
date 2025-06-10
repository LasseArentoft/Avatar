import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. Opsætning af scenen
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true }); // antialias for glattere kanter

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement); // Tilføj 3D-visningen til HTML-siden

// Juster baggrundsfarven på scenen (optional)
scene.background = new THREE.Color(0xa0a0a0); // En lys grå farve

// 2. Tilføj lys til scenen
// Ambient light giver en blød, jævn belysning fra alle retninger
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Hvidt lys, 50% intensitet
scene.add(ambientLight);

// Retningsbestemt lys simulerer sollys
const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // Hvidt lys, 100% intensitet
directionalLight.position.set(0, 10, 5); // Placering af lyskilden
scene.add(directionalLight);

// 3. Indlæs din GLB-avatar
const loader = new GLTFLoader();

// Husk at erstatte "din_avatar.glb" med det præcise navn på din fil!
loader.load(
    'din_avatar.glb', // Stien til din GLB-fil
    function (gltf) {
        // Avataren er nu indlæst. Vi tilføjer den til scenen.
        const avatar = gltf.scene;

        // Juster eventuelt position og størrelse her, hvis din avatar er for stor/lille eller forkert placeret
        // avatar.scale.set(0.1, 0.1, 0.1); // Eksempel: Gør avataren 10 gange mindre
        // avatar.position.set(0, -1, 0); // Eksempel: Flyt avataren nedad

        scene.add(avatar);

        // Juster kameraets position for at se avataren ordentligt
        // Dette kan kræve lidt justering afhængigt af din avatars størrelse
        camera.position.set(0, 1.5, 3); // Position: x, y (højde), z (dybde)
        camera.lookAt(avatar.position); // Få kameraet til at kigge på avataren

        // Du kan gemme en reference til avataren, hvis du vil manipulere den senere
        // window.myAvatar = avatar; // Gør den tilgængelig globalt for debugging
    },
    // Valgfri: Funktionen her køres under indlæsningens fremskridt
    function (xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    },
    // Valgfri: Funktionen her køres, hvis der opstår en fejl
    function (error) {
        console.error('An error occurred loading the GLB model:', error);
    }
);

// 4. Animerings- og render-loop
function animate() {
    requestAnimationFrame(animate); // Kalder funktionen igen ved næste frame

    // Her kan du tilføje animationer eller interaktioner
    // f.eks. rotere avataren:
    // if (window.myAvatar) {
    //     window.myAvatar.rotation.y += 0.005;
    // }

    renderer.render(scene, camera); // Tegn scenen
}

// Start animations-loop'en
animate();

// Håndter vinduesstørrelseændringer, så 3D-visningen altid fylder skærmen
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});