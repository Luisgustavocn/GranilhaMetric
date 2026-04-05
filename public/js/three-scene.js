// ========================================================================
// CENA THREE.JS
// ========================================================================

let scene, camera, renderer, cargoGroup;
let isLoading = false;
let currentRenderToken = 0;

// Cache para geometrias e materiais
let geometryCache = new Map();
let materialCache = new Map();

// Instanced rendering groups
let instanceGroups = {};

function initScene() {
    const container = document.getElementById('canvas-container');
    
    // Criar cena Three.js
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // Criar camera
    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(15, 10, 15);
    camera.lookAt(0, 0, 0);
    
    // Criar renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    
    // Iluminação
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Criar caminhão
    createTruck();
    
    // Controles
    setupControls();
    
    // Animation loop
    animate();
    window.addEventListener('resize', onWindowResize);
}

function createTruck() {
    const { length, width, height } = TRUCK_DIMENSIONS;
    const truck = new THREE.Group();
    
    // Chão
    const floorGeometry = new THREE.BoxGeometry(length, 0.2, width);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.receiveShadow = true;
    truck.add(floor);
    
    // Paredes
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x666666, transparent: true, opacity: 0.3 });
    
    // Parede traseira
    const rearWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, height, width),
        wallMaterial
    );
    rearWall.position.set(length/2, height/2, 0);
    truck.add(rearWall);
    
    // Paredes laterais
    const sideWallGeometry = new THREE.BoxGeometry(length, height, 0.1);
    const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
    leftWall.position.set(0, height/2, -width/2);
    truck.add(leftWall);
    
    const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
    rightWall.position.set(0, height/2, width/2);
    truck.add(rightWall);
    
    scene.add(truck);
}

function setupControls() {
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    
    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    });
    
    scene.userData.updateCamera = () => {
        targetX += (mouseX - targetX) * 0.05;
        targetY += (mouseY - targetY) * 0.05;
        
        const radius = 20;
        camera.position.x = Math.sin(targetX * Math.PI) * radius;
        camera.position.z = Math.cos(targetX * Math.PI) * radius;
        camera.position.y = 10 + targetY * 5;
        camera.lookAt(0, 0, 0);
    };
}

function animate() {
    requestAnimationFrame(animate);
    
    if (scene.userData.updateCamera) {
        scene.userData.updateCamera();
    }
    
    renderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function resetView() {
    currentRenderToken++;
    showLoading(false);
    camera.position.set(15, 10, 15);
    camera.lookAt(0, 0, 0);
    
    if (cargoGroup) {
        scene.remove(cargoGroup);
        cargoGroup = null;
    }
    
    // Resetar estruturas
    clientBlocks.length = 0;
    stacks.length = 0;
    stacksByClient.clear();
    stacksByProduct.clear();
    instanceGroups = {};
    
    document.getElementById('info-panel').style.display = 'none';
}

// Renderização otimizada
function getOrCreateGeometry(width, height, depth) {
    const key = `${width}x${height}x${depth}`;
    if (!geometryCache.has(key)) {
        geometryCache.set(key, new THREE.BoxGeometry(width, height, depth));
    }
    return geometryCache.get(key);
}

function getOrCreateMaterial(color) {
    if (!materialCache.has(color)) {
        materialCache.set(color, new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.7,
            metalness: 0.2
        }));
    }
    return materialCache.get(color);
}

function createBoxMesh(item, position) {
    // Agrupar por tipo para instancing
    const geometryKey = `${position.width}x${position.height}x${position.depth}`;
    const materialKey = `mat_${item.color || 0x4287f5}`;
    const instanceKey = `${geometryKey}_${materialKey}`;
    
    // Criar grupo de instancias se não existir
    if (!instanceGroups[instanceKey]) {
        const geometry = getOrCreateGeometry(position.width, position.height, position.depth);
        const material = getOrCreateMaterial(item.color || 0x4287f5);
        
        const instancedMesh = new THREE.InstancedMesh(geometry, material, 1000);
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        
        instanceGroups[instanceKey] = {
            mesh: instancedMesh,
            instances: [],
            count: 0
        };
        
        cargoGroup.add(instancedMesh);
    }
    
    // Adicionar instância
    const group = instanceGroups[instanceKey];
    const instanceId = group.count;
    
    if (instanceId >= 1000) {
        return;
    }
    
    const matrix = new THREE.Matrix4();
    matrix.setPosition(position.x, position.y, position.z);
    group.mesh.setMatrixAt(instanceId, matrix);
    
    group.instances.push({
        item: item,
        position: position,
        instanceId: instanceId
    });
    
    group.count++;
    group.mesh.instanceMatrix.needsUpdate = true;
}
