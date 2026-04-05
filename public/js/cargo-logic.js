// ========================================================================
// LÓGICA DE CARREGAMENTO DE CARGA
// ========================================================================

// Estruturas de dados
let clientBlocks = [];
let stacks = [];
let stacksByClient = new Map();
let stacksByProduct = new Map();

// Classe Stack
class Stack {
    constructor(clientKey, productKey, x, z, baseWidth, baseDepth) {
        this.clientKey = clientKey;
        this.productKey = productKey;
        this.x = x;
        this.z = z;
        this.baseWidth = baseWidth;
        this.baseDepth = baseDepth;
        this.currentTopY = FLOOR_Y;
        this.items = [];
    }
    
    canPlaceItem(itemWidth, itemDepth, itemHeight) {
        if (itemWidth > this.baseWidth + 0.01 || itemDepth > this.baseDepth + 0.01) {
            return false;
        }
        const requiredY = this.currentTopY + itemHeight;
        if (requiredY > TRUCK_DIMENSIONS.height - 0.05) {
            return false;
        }
        return true;
    }
    
    placeItem(item, itemWidth, itemHeight, itemDepth, rotated = false) {
        const placement = {
            x: this.x,
            y: this.currentTopY + itemHeight / 2,
            z: this.z,
            width: rotated ? itemDepth : itemWidth,
            height: itemHeight,
            depth: rotated ? itemWidth : itemDepth,
            layer: this.currentTopY === FLOOR_Y ? 'fundo_chao' : 'fundo_empilhado',
            stackLevel: this.items.length,
            rotated: rotated
        };
        
        this.items.push({ item, y: this.currentTopY, height: itemHeight });
        this.currentTopY += itemHeight;
        
        return placement;
    }
}

// Classe ClientBlock
class ClientBlock {
    constructor(clientKey, startX, endX) {
        this.clientKey = clientKey;
        this.startX = startX;
        this.endX = endX;
        this.stacks = [];
    }
    
    containsPosition(x, width) {
        const itemLeft = x - width / 2;
        const itemRight = x + width / 2;
        return itemLeft >= this.endX - GAP_STACK && itemRight <= this.startX + GAP_STACK;
    }
}

// Funções principais de carregamento
async function renderCargo() {
    const selectedClient = document.getElementById('client-select').value;
    if (!selectedClient) {
        alert('Por favor, selecione um cliente.');
        return;
    }
    
    const renderToken = ++currentRenderToken;
    showLoading(true);
    
    try {
        await nextFrame();
        const success = await createCargo(selectedClient, renderToken);
        
        if (!success && renderToken === currentRenderToken) {
            alert('Não foi possível organizar toda a carga.');
        }
    } catch (error) {
        console.error(error);
        alert('Não foi possível renderizar a carga.');
    } finally {
        if (renderToken === currentRenderToken) {
            showLoading(false);
        }
    }
}

async function createCargo(clientKey, renderToken) {
    // Limpar visualização anterior
    if (cargoGroup) {
        scene.remove(cargoGroup);
    }
    
    cargoGroup = new THREE.Group();
    
    const clientData = getClientDataForSelection(clientKey);
    if (!clientData) {
        return false;
    }
    
    console.log('🚀 Iniciando carregamento 3D - Nova Lógica');
    
    // Limpar estruturas
    clientBlocks.length = 0;
    stacks.length = 0;
    stacksByClient.clear();
    stacksByProduct.clear();
    instanceGroups = {};
    
    const allPlacements = [];
    
    if (clientKey === 'all') {
        // Múltiplos clientes
        const clientKeys = Object.keys(CLIENT_DATA);
        for (let i = 0; i < clientKeys.length; i++) {
            const key = clientKeys[i];
            const client = CLIENT_DATA[key];
            
            // Criar bloco para cliente
            const startX = REAR_START_X - (i * GAP_CLIENTE);
            const block = new ClientBlock(key, startX, startX - 2);
            clientBlocks.push(block);
            
            // Processar itens do cliente
            const result = processClientItems(key, block);
            allPlacements.push(...result.placements);
            
            await nextFrame();
        }
    } else {
        // Cliente único
        const block = new ClientBlock(clientKey, REAR_START_X, REAR_START_X - 4);
        clientBlocks.push(block);
        
        const result = processClientItems(clientKey, block);
        allPlacements.push(...result.placements);
    }
    
    // Renderizar todos os itens
    scene.add(cargoGroup);
    
    for (let i = 0; i < allPlacements.length; i += 50) {
        const batchEnd = Math.min(i + 50, allPlacements.length);
        
        for (let j = i; j < batchEnd; j++) {
            const { item, position } = allPlacements[j];
            createBoxMesh(item, position);
        }
        
        await nextFrame();
    }
    
    console.log(`✅ Carregamento concluído: ${allPlacements.length} itens`);
    
    // Mostrar informações
    showInfoPanel(clientData, allPlacements.length, allPlacements.length, {}, clientKey === 'all' ? 'multi' : 'single');
    
    return allPlacements.length > 0;
}

function processClientItems(clientKey, clientBlock) {
    const client = CLIENT_DATA[clientKey];
    console.log(`\n🚀 Processando cliente: ${client.name}`);
    console.log(`   Lógica: Por produto → Máxima altura → Rotação permitida`);
    
    const allPlacements = [];
    
    // Agrupar itens por tipo de produto
    const productsMap = new Map();
    client.items.forEach((item, itemIndex) => {
        const productKey = `${clientKey}:${item.name}`;
        if (!productsMap.has(productKey)) {
            productsMap.set(productKey, {
                name: item.name,
                dimensions: item.dimensions,
                color: getOrderColor(clientKey),
                clientKey: clientKey,
                clientName: client.name,
                sourceIndex: itemIndex,
                totalQuantity: item.quantity
            });
        }
    });
    
    console.log(`📦 Produtos encontrados: ${productsMap.size}`);
    
    // Processar cada tipo de produto completamente
    for (const [productKey, product] of productsMap) {
        console.log(`\n🎯 Carregando produto: ${product.name} (${product.totalQuantity} unidades)`);
        
        const productPlacements = loadProductType(product, clientBlock);
        
        if (productPlacements.length > 0) {
            allPlacements.push(...productPlacements);
            console.log(`✅ ${product.name}: ${productPlacements.length}/${product.totalQuantity} carregados`);
        } else {
            console.log(`❌ ${product.name}: Nenhuma unidade coube`);
        }
    }
    
    console.log(`\n📊 Resumo do cliente ${client.name}:`);
    console.log(`   ✅ Total carregado: ${allPlacements.length} itens`);
    
    return { placements: allPlacements };
}

function loadProductType(product, clientBlock) {
    const placements = [];
    const orientations = [
        { width: product.dimensions[0], depth: product.dimensions[2], rotated: false },
        { width: product.dimensions[2], depth: product.dimensions[0], rotated: true }
    ];
    
    // Tentar cada orientação
    for (const orientation of orientations) {
        console.log(`   🔄 Testando orientação: ${orientation.width.toFixed(2)}x${orientation.depth.toFixed(2)}${orientation.rotated ? ' (rotated)' : ''}`);
        
        const orientationPlacements = loadProductWithOrientation(product, orientation, clientBlock);
        
        if (orientationPlacements.length > 0) {
            placements.push(...orientationPlacements);
            console.log(`   ✅ Orientação bem-sucedida: ${orientationPlacements.length} unidades`);
            break;
        }
    }
    
    return placements;
}

function loadProductWithOrientation(product, orientation, clientBlock) {
    const placements = [];
    let loadedCount = 0;
    const maxQuantity = product.totalQuantity;
    
    // Buscar posições disponíveis
    const availablePositions = findAvailablePositions(clientBlock, orientation.width, orientation.depth);
    
    console.log(`   📍 Posições disponíveis: ${availablePositions.length}`);
    
    for (const position of availablePositions) {
        if (loadedCount >= maxQuantity) break;
        
        // Criar nova pilha
        const stack = createStackAtPosition(product, position, orientation);
        if (stack) {
            // Empilhar máximo possível
            const stackedItems = stackItemsInPosition(product, stack, orientation, maxQuantity - loadedCount);
            
            placements.push(...stackedItems);
            loadedCount += stackedItems.length;
            
            console.log(`   📦 Pilha em (${position.x.toFixed(2)}, ${position.z.toFixed(2)}): ${stackedItems.length} unidades`);
        }
    }
    
    return placements;
}

function findAvailablePositions(clientBlock, itemWidth, itemDepth) {
    const positions = [];
    const gap = GAP_STACK;
    
    // Busca sistemática
    const startX = clientBlock.startX;
    const startZ = MIN_Z_EDGE;
    
    let currentX = startX - itemWidth/2;
    while (currentX >= clientBlock.endX + itemWidth/2) {
        let currentZ = startZ;
        
        while (currentZ <= MAX_Z_EDGE - itemDepth/2) {
            if (isValidPosition(currentX, currentZ, itemWidth, itemDepth, clientBlock, gap)) {
                positions.push({ x: currentX, z: currentZ });
            }
            currentZ += itemDepth + gap;
        }
        
        currentX -= itemWidth + gap;
    }
    
    return positions;
}

function isValidPosition(x, z, itemWidth, itemDepth, clientBlock, gap) {
    // Verificar limites
    const itemLeft = x - itemWidth / 2;
    const itemRight = x + itemWidth / 2;
    const itemFront = z - itemDepth / 2;
    const itemBack = z + itemDepth / 2;
    
    if (itemLeft < clientBlock.endX - gap || itemRight > clientBlock.startX + gap ||
        itemFront < MIN_Z_EDGE - gap || itemBack > MAX_Z_EDGE + gap) {
        return false;
    }
    
    // Verificar colisão
    for (const stack of stacks) {
        if (!clientBlock.containsPosition(stack.x, stack.baseWidth)) {
            continue;
        }
        
        const stackLeft = stack.x - stack.baseWidth / 2;
        const stackRight = stack.x + stack.baseWidth / 2;
        const stackFront = stack.z - stack.baseDepth / 2;
        const stackBack = stack.z + stack.baseDepth / 2;
        
        const xOverlap = !(itemRight <= stackLeft + gap || itemLeft >= stackRight - gap);
        const zOverlap = !(itemBack <= stackFront + gap || itemFront >= stackBack - gap);
        
        if (xOverlap && zOverlap) {
            return false;
        }
    }
    
    return true;
}

function createStackAtPosition(product, position, orientation) {
    const productKey = `${product.clientKey}:${product.name}`;
    const stack = new Stack(
        product.clientKey,
        productKey,
        position.x,
        position.z,
        orientation.width,
        orientation.depth
    );
    
    // Adicionar às estruturas
    stacks.push(stack);
    
    if (!stacksByClient.has(product.clientKey)) {
        stacksByClient.set(product.clientKey, []);
    }
    stacksByClient.get(product.clientKey).push(stack);
    
    if (!stacksByProduct.has(productKey)) {
        stacksByProduct.set(productKey, []);
    }
    stacksByProduct.get(productKey).push(stack);
    
    clientBlock.stacks.push(stack);
    
    return stack;
}

function stackItemsInPosition(product, stack, orientation, maxItems) {
    const placements = [];
    let itemCount = 0;
    
    while (itemCount < maxItems) {
        if (!stack.canPlaceItem(orientation.width, orientation.depth, orientation.height)) {
            break;
        }
        
        // Criar item
        const item = {
            name: product.name,
            dimensions: [...product.dimensions],
            color: product.color,
            clientKey: product.clientKey,
            clientName: product.clientName,
            sourceIndex: product.sourceIndex,
            type: 'box',
            weight: 1,
            footprint: product.dimensions[0] * product.dimensions[2],
            volume: product.dimensions[0] * product.dimensions[1] * product.dimensions[2],
            stackable: true,
            fragile: false
        };
        
        // Colocar item na pilha
        const placement = stack.placeItem(
            item,
            orientation.width,
            orientation.height,
            orientation.depth,
            orientation.rotated
        );
        
        if (placement) {
            placements.push({ item, position: placement, method: 'empilhado' });
            itemCount++;
            
            // Verificar limite de altura
            if (placement.y + orientation.height/2 > TRUCK_DIMENSIONS.height - 0.05) {
                break;
            }
        } else {
            break;
        }
    }
    
    return placements;
}
