// ========================================================================
// LÓGICA DE CARREGAMENTO DE CARGA
// ========================================================================

// Estruturas de dados
let clientBlocks = [];
let stacks = [];
let stacksByClient = new Map();
let stacksByProduct = new Map();

// Exportar variáveis para uso global
window.clientBlocks = clientBlocks;
window.stacks = stacks;
window.stacksByClient = stacksByClient;
window.stacksByProduct = stacksByProduct;

// Classe Stack
class Stack {
    constructor(clientKey, productKey, x, z, baseWidth, baseDepth, baseY = FLOOR_Y) {
        this.clientKey = clientKey;
        this.productKey = productKey;
        this.x = x;
        this.z = z;
        this.baseWidth = baseWidth;
        this.baseDepth = baseDepth;
        this.baseY = baseY;
        this.currentTopY = baseY;
        this.items = [];
    }
    
    canPlaceItem(itemWidth, itemDepth, itemHeight) {
        if (itemWidth > this.baseWidth + 0.01 || itemDepth > this.baseDepth + 0.01) {
            return false;
        }
        const requiredY = this.currentTopY + itemHeight;
        if (requiredY > TRUCK_DIMENSIONS.height - TOP_CLEARANCE) {
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
            layer: this.baseY <= FLOOR_Y + 1e-6 ? 'fundo_chao' : 'fundo_empilhado',
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
        this.searchCursor = null;
        this.boundaryStacks = [];
    }
    
    containsPosition(x, width) {
        const itemLeft = x - width / 2;
        const itemRight = x + width / 2;
        return itemLeft >= this.endX - GAP_STACK && itemRight <= this.startX + GAP_STACK;
    }
}

// Exportar classes para uso global
window.Stack = Stack;
window.ClientBlock = ClientBlock;

// Funções principais de carregamento
async function renderCargo() {
    const selectedClient = document.getElementById('client-select').value;
    if (!selectedClient) {
        alert('Por favor, selecione um cliente.');
        return;
    }
    
    window.currentRenderToken = (window.currentRenderToken || 0) + 1;
    const renderToken = window.currentRenderToken;
    showLoading(true);
    
    try {
        await nextFrame();
        const success = await createCargo(selectedClient, renderToken);
        
        if (!success && renderToken === window.currentRenderToken) {
            alert('Não foi possível organizar toda a carga.');
        }
    } catch (error) {
        console.error(error);
        alert('Não foi possível renderizar a carga.');
    } finally {
        if (renderToken === window.currentRenderToken) {
            showLoading(false);
        }
    }
}

async function createCargo(clientKey, renderToken) {
    const scene = window.scene;
    if (!scene) {
        console.warn('Cena Three.js não inicializada.');
        return false;
    }

    // Limpar visualização anterior
    if (window.cargoGroup) {
        scene.remove(window.cargoGroup);
    }
    
    window.cargoGroup = new THREE.Group();
    
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
    window.instanceGroups = {};
    
    const allPlacements = [];
    
    if (clientKey === 'all') {
        // Múltiplos clientes
        const clientKeys = Object.keys(CLIENT_DATA);

        for (let i = 0; i < clientKeys.length; i++) {
            const key = clientKeys[i];
            // Cada cliente passa a procurar espaço em todo o caminhão.
            // Assim, se o cliente anterior deixou sobras em uma linha,
            // o próximo pode ocupar exatamente esses vazios.
            const block = new ClientBlock(key, REAR_START_X, MIN_X_LIMIT);
            block.boundaryStacks = [...stacks];
            clientBlocks.push(block);
            
            // Processar itens do cliente
            const result = processClientItems(key, block);
            allPlacements.push(...result.placements);
            
            await nextFrame();
        }
    } else {
        // Cliente único
        const block = new ClientBlock(clientKey, REAR_START_X, MIN_X_LIMIT);
        clientBlocks.push(block);
        
        const result = processClientItems(clientKey, block);
        allPlacements.push(...result.placements);
    }
    
    // Renderizar todos os itens
    scene.add(window.cargoGroup);
    let renderedCount = 0;
    
    for (let i = 0; i < allPlacements.length; i += 50) {
        const batchEnd = Math.min(i + 50, allPlacements.length);
        
        for (let j = i; j < batchEnd; j++) {
            const { item, position } = allPlacements[j];
            if (createBoxMesh(item, position)) {
                renderedCount++;
            }
        }
        
        await nextFrame();
    }
    
    console.log(`✅ Carregamento concluído: ${allPlacements.length} itens`);
    console.log(`🎨 Itens renderizados: ${renderedCount}`);
    window.lastCargoRenderStats = {
        placedCount: allPlacements.length,
        renderedCount
    };
    if (renderedCount !== allPlacements.length) {
        console.warn(`⚠️ Diferença entre itens colocados e renderizados: ${allPlacements.length - renderedCount}`);
    }
    
    // Mostrar informações
    const totalRequestedItems = Array.isArray(clientData.items)
        ? clientData.items.reduce((sum, item) => sum + Math.max(0, Number(item?.quantity || 0)), 0)
        : 0;
    showInfoPanel(clientData, allPlacements.length, totalRequestedItems, {}, clientKey === 'all' ? 'multi' : 'single');
    
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
        const dimensionsKey = Array.isArray(item.dimensions) ? item.dimensions.join('x') : 'sem-dimensoes';
        const productKey = `${clientKey}:${item.name}:${dimensionsKey}`;
        if (!productsMap.has(productKey)) {
            productsMap.set(productKey, {
                name: item.name,
                dimensions: item.dimensions,
                color: getOrderColor(clientKey),
                clientKey: clientKey,
                clientName: client.name,
                sourceIndex: itemIndex,
                totalQuantity: Math.max(0, Number(item.quantity || 0))
            });
            return;
        }

        const existingProduct = productsMap.get(productKey);
        existingProduct.totalQuantity += Math.max(0, Number(item.quantity || 0));
    });
    
    const sortedProducts = Array.from(productsMap.entries()).sort(([, productA], [, productB]) => {
        const footprintA = Number(productA?.dimensions?.[0] || 0) * Number(productA?.dimensions?.[2] || 0);
        const footprintB = Number(productB?.dimensions?.[0] || 0) * Number(productB?.dimensions?.[2] || 0);
        if (Math.abs(footprintB - footprintA) > 1e-6) {
            return footprintB - footprintA;
        }

        const volumeA = footprintA * Number(productA?.dimensions?.[1] || 0);
        const volumeB = footprintB * Number(productB?.dimensions?.[1] || 0);
        if (Math.abs(volumeB - volumeA) > 1e-6) {
            return volumeB - volumeA;
        }

        const heightA = Number(productA?.dimensions?.[1] || 0);
        const heightB = Number(productB?.dimensions?.[1] || 0);
        if (Math.abs(heightB - heightA) > 1e-6) {
            return heightB - heightA;
        }

        return Number(productB?.totalQuantity || 0) - Number(productA?.totalQuantity || 0);
    });

    console.log(`📦 Produtos encontrados: ${productsMap.size}`);
    
    // Processar cada tipo de produto completamente, do maior para o menor.
    for (const [productKey, product] of sortedProducts) {
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
    
    return {
        placements: allPlacements,
        frontEdgeX: getPlacementsFrontEdgeX(allPlacements)
    };
}

function loadProductType(product, clientBlock) {
    const placements = [];
    const orientations = [
        { width: product.dimensions[0], height: product.dimensions[1], depth: product.dimensions[2], rotated: false },
        { width: product.dimensions[2], height: product.dimensions[1], depth: product.dimensions[0], rotated: true }
    ].filter((orientation, index, list) => {
        return index === list.findIndex((candidate) =>
            Math.abs(candidate.width - orientation.width) <= 1e-6 &&
            Math.abs(candidate.depth - orientation.depth) <= 1e-6
        );
    }).sort((orientationA, orientationB) => {
        const estimateA = estimateOrientationCapacity(clientBlock, orientationA);
        const estimateB = estimateOrientationCapacity(clientBlock, orientationB);
        return estimateB - estimateA;
    });
    
    // Tentar cada orientação e usar a alternativa para preencher sobras.
    for (const orientation of orientations) {
        const remainingQuantity = Math.max(0, product.totalQuantity - placements.length);
        if (remainingQuantity === 0) {
            break;
        }

        console.log(`   🔄 Testando orientação: ${orientation.width.toFixed(2)}x${orientation.depth.toFixed(2)}${orientation.rotated ? ' (rotated)' : ''}`);
        
        const orientationPlacements = loadProductWithOrientation(product, orientation, clientBlock, remainingQuantity);
        
        if (orientationPlacements.length > 0) {
            placements.push(...orientationPlacements);
            console.log(`   ✅ Orientação bem-sucedida: ${orientationPlacements.length} unidades`);
        }
    }
    
    return placements;
}

function estimateOrientationCapacity(clientBlock, orientation) {
    const availablePositions = findAvailablePositions(clientBlock, orientation.width, orientation.depth, orientation.height);
    const stackCapacity = Math.max(
        0,
        Math.floor((TRUCK_DIMENSIONS.height - TOP_CLEARANCE - FLOOR_Y + 1e-6) / orientation.height)
    );

    return availablePositions.length * stackCapacity;
}

function loadProductWithOrientation(product, orientation, clientBlock, maxQuantity = product.totalQuantity) {
    const placements = [];
    let loadedCount = 0;

    const stackedOnExisting = stackItemsOnExistingStacks(product, orientation, clientBlock, maxQuantity);
    if (stackedOnExisting.length > 0) {
        placements.push(...stackedOnExisting);
        loadedCount += stackedOnExisting.length;
        console.log(`   ⬆️ Aproveitado em pilhas existentes: ${stackedOnExisting.length} unidades`);
    }

    while (loadedCount < maxQuantity) {
        const availablePositions = findAvailablePositions(clientBlock, orientation.width, orientation.depth, orientation.height);
        if (placements.length === 0) {
            console.log(`   📍 Posições disponíveis: ${availablePositions.length}`);
        }

        const position = availablePositions[0];
        if (!position) {
            break;
        }

        const stack = createStackAtPosition(product, position, orientation, clientBlock);
        if (!stack) {
            break;
        }

        if (!clientBlock.searchCursor) {
            clientBlock.searchCursor = { x: position.x, z: position.z };
        }

        const stackedItems = stackItemsInPosition(product, stack, orientation, maxQuantity - loadedCount);
        if (stackedItems.length === 0) {
            break;
        }

        placements.push(...stackedItems);
        loadedCount += stackedItems.length;

        console.log(`   📦 Pilha em (${position.x.toFixed(2)}, ${position.z.toFixed(2)}): ${stackedItems.length} unidades`);
    }

    if (loadedCount < maxQuantity) {
        const relaxedPlacements = fillRemainingWithRelaxedSearch(
            product,
            orientation,
            clientBlock,
            maxQuantity - loadedCount
        );
        if (relaxedPlacements.length > 0) {
            placements.push(...relaxedPlacements);
            loadedCount += relaxedPlacements.length;
            console.log(`   🧩 Fechamento de sobras: ${relaxedPlacements.length} unidades`);
        }
    }
    
    return placements;
}

function stackItemsOnExistingStacks(product, orientation, clientBlock, maxItems) {
    if (!Array.isArray(clientBlock.stacks) || clientBlock.stacks.length === 0 || maxItems <= 0) {
        return [];
    }

    const placements = [];
    let remainingItems = maxItems;
    const candidateStacks = [...clientBlock.stacks].sort((stackA, stackB) => {
        if (Math.abs(stackB.x - stackA.x) > 1e-6) {
            return stackB.x - stackA.x;
        }
        if (Math.abs(stackA.z - stackB.z) > 1e-6) {
            return stackA.z - stackB.z;
        }
        const areaA = stackA.baseWidth * stackA.baseDepth;
        const areaB = stackB.baseWidth * stackB.baseDepth;
        if (Math.abs(areaB - areaA) > 1e-6) {
            return areaB - areaA;
        }
        return stackA.currentTopY - stackB.currentTopY;
    });

    for (const supportStack of candidateStacks) {
        if (remainingItems <= 0) {
            break;
        }
        if (supportStack.baseWidth + 1e-6 < orientation.width || supportStack.baseDepth + 1e-6 < orientation.depth) {
            continue;
        }

        const topPositions = findAvailableTopPositions(supportStack, clientBlock, orientation.width, orientation.depth, orientation.height);
        if (topPositions.length === 0) {
            continue;
        }

        for (const position of topPositions) {
            if (remainingItems <= 0) {
                break;
            }

            const topStack = createStackAtPosition(product, position, orientation, clientBlock, position.baseY);
            if (!topStack) {
                continue;
            }

            const stackedItems = stackItemsInPosition(product, topStack, orientation, remainingItems);
            if (stackedItems.length === 0) {
                continue;
            }

            placements.push(...stackedItems);
            remainingItems -= stackedItems.length;
        }
    }

    return placements;
}

function findAvailableTopPositions(supportStack, clientBlock, itemWidth, itemDepth, itemHeight) {
    const positions = [];
    const gap = GAP_STACK;
    const baseY = supportStack.currentTopY;
    const supportLeft = supportStack.x - supportStack.baseWidth / 2;
    const supportRight = supportStack.x + supportStack.baseWidth / 2;
    const supportFront = supportStack.z - supportStack.baseDepth / 2;
    const supportBack = supportStack.z + supportStack.baseDepth / 2;

    let currentX = supportRight - itemWidth / 2;
    while (currentX >= supportLeft + itemWidth / 2 - 1e-6) {
        let currentZ = supportFront + itemDepth / 2;
        while (currentZ <= supportBack - itemDepth / 2 + 1e-6) {
            const itemLeft = currentX - itemWidth / 2;
            const itemRight = currentX + itemWidth / 2;
            const itemFront = currentZ - itemDepth / 2;
            const itemBack = currentZ + itemDepth / 2;
            const insideSupport =
                itemLeft >= supportLeft - 1e-6 &&
                itemRight <= supportRight + 1e-6 &&
                itemFront >= supportFront - 1e-6 &&
                itemBack <= supportBack + 1e-6;

            if (insideSupport && isValidPosition(currentX, currentZ, itemWidth, itemDepth, clientBlock, gap, baseY, itemHeight)) {
                positions.push({ x: currentX, z: currentZ, baseY });
            }

            currentZ += itemDepth + gap;
        }

        currentX -= itemWidth + gap;
    }

    return positions;
}

function findAvailablePositions(clientBlock, itemWidth, itemDepth, itemHeight = 0, options = {}) {
    const positions = [];
    const gap = GAP_STACK;
    const respectCursor = options.respectCursor !== false;
    const respectBoundary = options.respectBoundary !== false;
    const respectConnectivity = options.respectConnectivity !== false;

    const relevantStacks = stacks.filter((stack) => clientBlock.containsPosition(stack.x, stack.baseWidth));
    const xCandidates = buildAxisCandidates(
        clientBlock.startX - itemWidth / 2,
        clientBlock.endX + itemWidth / 2,
        relevantStacks,
        itemWidth,
        'x'
    );
    const zCandidates = buildAxisCandidates(
        MIN_Z_EDGE + itemDepth / 2,
        MAX_Z_EDGE - itemDepth / 2,
        relevantStacks,
        itemDepth,
        'z'
    );

    for (const currentX of xCandidates) {
        for (const currentZ of zCandidates) {
            if (respectCursor && !isPositionWithinClientCursor(currentX, currentZ, clientBlock.searchCursor)) {
                continue;
            }
            if (respectBoundary && !isPositionWithinClientBoundary(currentX, currentZ, itemWidth, itemDepth, clientBlock)) {
                continue;
            }
            if (respectConnectivity && !isPositionConnectedToClientStacks(currentX, currentZ, itemWidth, itemDepth, clientBlock)) {
                continue;
            }
            if (isValidPosition(currentX, currentZ, itemWidth, itemDepth, clientBlock, gap, FLOOR_Y, itemHeight)) {
                positions.push({ x: currentX, z: currentZ });
            }
        }
    }
    
    return positions;
}

function fillRemainingWithRelaxedSearch(product, orientation, clientBlock, maxItems) {
    if (maxItems <= 0) {
        return [];
    }

    const placements = [];
    let remainingItems = maxItems;

    while (remainingItems > 0) {
        const availablePositions = findAvailablePositions(
            clientBlock,
            orientation.width,
            orientation.depth,
            orientation.height,
            { respectConnectivity: false }
        );
        const position = availablePositions[0];
        if (!position) {
            break;
        }

        const stack = createStackAtPosition(product, position, orientation, clientBlock);
        if (!stack) {
            break;
        }

        const stackedItems = stackItemsInPosition(product, stack, orientation, remainingItems);
        if (stackedItems.length === 0) {
            break;
        }

        placements.push(...stackedItems);
        remainingItems -= stackedItems.length;
    }

    return placements;
}

function buildAxisCandidates(startValue, endValue, relevantStacks, itemSize, axis) {
    const gap = GAP_STACK;
    const candidates = [];
    const seen = new Set();

    const addCandidate = (value) => {
        if (!Number.isFinite(value)) {
            return;
        }
        if (axis === 'x') {
            if (value < endValue - 1e-6 || value > startValue + 1e-6) {
                return;
            }
        } else if (value < startValue - 1e-6 || value > endValue + 1e-6) {
            return;
        }

        const key = value.toFixed(6);
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        candidates.push(value);
    };

    addCandidate(startValue);

    relevantStacks.forEach((stack) => {
        if (axis === 'x') {
            addCandidate(stack.x - stack.baseWidth / 2 - gap - itemSize / 2);
            addCandidate(stack.x + stack.baseWidth / 2 + gap + itemSize / 2);
            return;
        }

        addCandidate(stack.z - stack.baseDepth / 2 - gap - itemSize / 2);
        addCandidate(stack.z + stack.baseDepth / 2 + gap + itemSize / 2);
    });

    return candidates.sort((a, b) => axis === 'x' ? b - a : a - b);
}

function isPositionWithinClientCursor(x, z, searchCursor) {
    if (!searchCursor) {
        return true;
    }

    if (x < searchCursor.x - 1e-6) {
        return true;
    }

    if (Math.abs(x - searchCursor.x) <= 1e-6 && z >= searchCursor.z - 1e-6) {
        return true;
    }

    return false;
}

function isPositionWithinClientBoundary(x, z, itemWidth, itemDepth, clientBlock) {
    if (!Array.isArray(clientBlock.boundaryStacks) || clientBlock.boundaryStacks.length === 0) {
        return true;
    }

    const itemRight = x + itemWidth / 2;
    const itemFront = z - itemDepth / 2;
    const itemBack = z + itemDepth / 2;

    let allowedRightEdge = clientBlock.startX + GAP_STACK;
    let hasBoundaryOverlap = false;

    clientBlock.boundaryStacks.forEach((stack) => {
        const stackFront = stack.z - stack.baseDepth / 2;
        const stackBack = stack.z + stack.baseDepth / 2;
        const zOverlap = !(itemBack <= stackFront + GAP_STACK || itemFront >= stackBack - GAP_STACK);
        if (!zOverlap) {
            return;
        }

        hasBoundaryOverlap = true;
        const stackFrontEdgeX = stack.x - stack.baseWidth / 2;
        allowedRightEdge = Math.min(allowedRightEdge, stackFrontEdgeX + GAP_STACK);
    });

    if (!hasBoundaryOverlap) {
        return true;
    }

    return itemRight <= allowedRightEdge + 1e-6;
}

function isPositionConnectedToClientStacks(x, z, itemWidth, itemDepth, clientBlock) {
    if (!Array.isArray(clientBlock.stacks) || clientBlock.stacks.length === 0) {
        return true;
    }

    const itemLeft = x - itemWidth / 2;
    const itemRight = x + itemWidth / 2;
    const itemFront = z - itemDepth / 2;
    const itemBack = z + itemDepth / 2;
    const tolerance = GAP_STACK + 1e-6;

    return clientBlock.stacks.some((stack) => {
        const contact = getStackContactMetrics(x, z, itemWidth, itemDepth, stack);
        return contact.touchesInX || contact.touchesInZ;
    });
}

function getStackContactMetrics(x, z, itemWidth, itemDepth, stack) {
    const itemLeft = x - itemWidth / 2;
    const itemRight = x + itemWidth / 2;
    const itemFront = z - itemDepth / 2;
    const itemBack = z + itemDepth / 2;
    const tolerance = GAP_STACK + 1e-6;

    const stackLeft = stack.x - stack.baseWidth / 2;
    const stackRight = stack.x + stack.baseWidth / 2;
    const stackFront = stack.z - stack.baseDepth / 2;
    const stackBack = stack.z + stack.baseDepth / 2;

    const zRangesOverlap = !(itemBack <= stackFront + 1e-6 || itemFront >= stackBack - 1e-6);
    const xRangesOverlap = !(itemRight <= stackLeft + 1e-6 || itemLeft >= stackRight - 1e-6);
    const touchesInX = zRangesOverlap && (
        Math.abs(itemLeft - stackRight) <= tolerance ||
        Math.abs(itemRight - stackLeft) <= tolerance
    );
    const touchesInZ = xRangesOverlap && (
        Math.abs(itemFront - stackBack) <= tolerance ||
        Math.abs(itemBack - stackFront) <= tolerance
    );

    return { touchesInX, touchesInZ };
}

function getPlacementsFrontEdgeX(placements) {
    if (!Array.isArray(placements) || placements.length === 0) {
        return null;
    }

    const frontEdge = placements.reduce((frontEdgeValue, entry) => {
        const leftEdge = Number(entry?.position?.x) - Number(entry?.position?.width || 0) / 2;
        return Number.isFinite(leftEdge) ? Math.min(frontEdgeValue, leftEdge) : frontEdgeValue;
    }, Number.POSITIVE_INFINITY);

    return Number.isFinite(frontEdge) ? frontEdge : null;
}

function isValidPosition(x, z, itemWidth, itemDepth, clientBlock, gap, baseY = FLOOR_Y, itemHeight = 0) {
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
        const verticalOverlap = !(baseY + itemHeight <= stack.baseY + 1e-6 || baseY >= stack.currentTopY - 1e-6);
        if (!verticalOverlap) {
            continue;
        }
        
        const xOverlap = !(itemRight <= stackLeft + gap || itemLeft >= stackRight - gap);
        const zOverlap = !(itemBack <= stackFront + gap || itemFront >= stackBack - gap);
        
        if (xOverlap && zOverlap) {
            return false;
        }
    }
    
    return true;
}

function createStackAtPosition(product, position, orientation, clientBlock, baseY = FLOOR_Y) {
    const productKey = `${product.clientKey}:${product.name}`;
    const stack = new Stack(
        product.clientKey,
        productKey,
        position.x,
        position.z,
        orientation.width,
        orientation.depth,
        baseY
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
        const item = createPackedItem(product);
        
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
            if (placement.y + orientation.height / 2 > TRUCK_DIMENSIONS.height - TOP_CLEARANCE) {
                break;
            }
        } else {
            break;
        }
    }
    
    return placements;
}

function createPackedItem(product) {
    return {
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
}
