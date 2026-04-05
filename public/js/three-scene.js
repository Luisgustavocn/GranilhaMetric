// ========================================================================
// CENA THREE.JS
// ========================================================================

// Estado compartilhado entre arquivos (sempre usar window.*)
window.scene = window.scene || null;
window.camera = window.camera || null;
window.renderer = window.renderer || null;
window.cargoGroup = window.cargoGroup || null;
window.instanceGroups = window.instanceGroups || {};

// Cache para geometrias e materiais (pode ficar local aqui)
let geometryCache = new Map();
let materialCache = new Map();

function initScene() {
    const container = document.getElementById('canvas-container');
    if (!container) {
        console.warn('canvas-container não encontrado.');
        return;
    }

    // Garantir dimensões mínimas (evita renderer 0x0 quando CSS não carregou)
    if (!container.style.height) {
        container.style.height = '600px';
    }

    const width = container.clientWidth || Math.max(320, window.innerWidth);
    const height = container.clientHeight || 600;
    
    // Criar cena Three.js
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    window.scene = scene;

    // Debug helpers (garante referência visual)
    scene.add(new THREE.AxesHelper(2));
    scene.add(new THREE.GridHelper(20, 20));
    
    // Criar camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(15, 10, 15);
    camera.lookAt(0, 0, 0);
    window.camera = camera;
    
    // Criar renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    window.renderer = renderer;
    
    // Iluminação
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Cubo de teste (se isso não aparecer, o problema é canvas/câmera)
    const testCube = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshStandardMaterial({ color: 0xff00ff })
    );
    testCube.position.set(0, 0.4, 0);
    scene.add(testCube);
    
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
    const floorThickness = 0.02;
    
    // Chão
    const floorGeometry = new THREE.BoxGeometry(length, floorThickness, width);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -floorThickness / 2;
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
        const camera = window.camera;
        if (!camera) return;
        camera.position.x = Math.sin(targetX * Math.PI) * radius;
        camera.position.z = Math.cos(targetX * Math.PI) * radius;
        camera.position.y = 10 + targetY * 5;
        camera.lookAt(0, 0, 0);
    };
}

function animate() {
    requestAnimationFrame(animate);

    const scene = window.scene;
    const camera = window.camera;
    const renderer = window.renderer;
    if (!scene || !camera || !renderer) return;

    if (scene.userData.updateCamera) {
        scene.userData.updateCamera();
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    const camera = window.camera;
    const renderer = window.renderer;
    if (!camera || !renderer) return;

    const width = container?.clientWidth || Math.max(320, window.innerWidth);
    const height = container?.clientHeight || 600;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function resetView() {
    window.currentRenderToken = (window.currentRenderToken || 0) + 1;
    showLoading(false);
    const camera = window.camera;
    if (camera) {
        camera.position.set(15, 10, 15);
        camera.lookAt(0, 0, 0);
    }
    
    const scene = window.scene;
    if (scene && window.cargoGroup) {
        scene.remove(window.cargoGroup);
        window.cargoGroup = null;
    }
    
    // Resetar estruturas
    clientBlocks.length = 0;
    stacks.length = 0;
    stacksByClient.clear();
    stacksByProduct.clear();
    window.instanceGroups = {};
    
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
    const cargoGroup = window.cargoGroup;
    if (!cargoGroup) return;

    const instanceGroups = window.instanceGroups;
    if (!instanceGroups[instanceKey]) {
        const geometry = getOrCreateGeometry(position.width, position.height, position.depth);
        const material = getOrCreateMaterial(item.color || 0x4287f5);
        const instancedMesh = createInstancedMesh(geometry, material, 256);
        
        instanceGroups[instanceKey] = {
            mesh: instancedMesh,
            instances: [],
            count: 0,
            capacity: 256,
            geometry,
            material
        };
        
        cargoGroup.add(instancedMesh);
    }
    
    // Adicionar instância
    const group = instanceGroups[instanceKey];
    if (group.count >= group.capacity) {
        growInstanceGroup(instanceKey, cargoGroup);
    }

    const instanceId = group.count;
    
    const matrix = new THREE.Matrix4();
    matrix.setPosition(position.x, position.y, position.z);
    group.mesh.setMatrixAt(instanceId, matrix);
    group.mesh.count = instanceId + 1;
    
    group.instances.push({
        item: item,
        position: position,
        instanceId: instanceId
    });
    
    group.count++;
    group.mesh.instanceMatrix.needsUpdate = true;
    return true;
}

function createInstancedMesh(geometry, material, capacity) {
    const instancedMesh = new THREE.InstancedMesh(geometry, material, capacity);
    instancedMesh.count = 0;
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    return instancedMesh;
}

function growInstanceGroup(instanceKey, cargoGroup) {
    const group = window.instanceGroups[instanceKey];
    if (!group) return;

    const nextCapacity = Math.max(group.capacity * 2, group.capacity + 256);
    const nextMesh = createInstancedMesh(group.geometry, group.material, nextCapacity);
    const matrix = new THREE.Matrix4();

    for (let index = 0; index < group.count; index++) {
        group.mesh.getMatrixAt(index, matrix);
        nextMesh.setMatrixAt(index, matrix);
    }

    nextMesh.count = group.count;
    nextMesh.instanceMatrix.needsUpdate = true;

    cargoGroup.remove(group.mesh);
    group.mesh.dispose?.();
    cargoGroup.add(nextMesh);

    group.mesh = nextMesh;
    group.capacity = nextCapacity;
}
