// ========================================================================
// LÓGICA DE CARREGAMENTO DE CARGA
// ========================================================================

// Estruturas de dados
let clientBlocks = [];
let stacks = [];
const PACKING_DEBUG = false;

function packingLog(...args) {
    if (PACKING_DEBUG) {
        console.log(...args);
    }
}

// Exportar variáveis para uso global
window.clientBlocks = clientBlocks;
window.stacks = stacks;

// Classe Stack
class Stack {
    constructor(clientKey, x, z, baseWidth, baseDepth, baseY = FLOOR_Y, shape = 'box') {
        this.clientKey = clientKey;
        this.x = x;
        this.z = z;
        this.baseWidth = baseWidth;
        this.baseDepth = baseDepth;
        this.baseY = baseY;
        this.shape = shape;
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

// ========================================================================
// PACKING POR SLOTS (PORTADO DO APP PRINCIPAL)
// ========================================================================

let previewSlotPackingMetrics = null;

function syncPreviewSlotPackingMetrics() {
    const slotGap = Math.min(Number(GAP_STACK || 0.005), 0.002);
    previewSlotPackingMetrics = {
        gap: slotGap,
        orderGap: Math.min(Number(GAP_CLIENTE || slotGap), 0.005),
        positionEpsilon: 0.0015,
        floorY: FLOOR_Y,
        minX: -TRUCK_DIMENSIONS.length / 2 + slotGap,
        rearX: TRUCK_DIMENSIONS.length / 2 - slotGap,
        minZ: -TRUCK_DIMENSIONS.width / 2 + slotGap,
        maxZ: TRUCK_DIMENSIONS.width / 2 - slotGap,
        usableHeight: TRUCK_DIMENSIONS.height - FLOOR_Y - TOP_CLEARANCE
    };
}

function buildPreviewVisualizationItems(selectedClientKey) {
    const entries = selectedClientKey === 'all'
        ? Object.entries(CLIENT_DATA || {})
        : CLIENT_DATA?.[selectedClientKey]
            ? [[selectedClientKey, CLIENT_DATA[selectedClientKey]]]
            : [];
    const items = [];

    entries.forEach(([clientKey, client]) => {
        const clientName = String(client?.name || clientKey || 'Pedido sem cliente').trim() || 'Pedido sem cliente';
        const color = getOrderColor(clientKey);

        (client?.items || []).forEach((item) => {
            const dimensions = Array.isArray(item?.dimensions) ? item.dimensions.map((value) => Number(value || 0)) : null;
            if (!dimensions || dimensions.length < 3) {
                return;
            }

            const [width, height, depth] = dimensions;
            if (!(width > 0) || !(height > 0) || !(depth > 0)) {
                return;
            }

            const quantity = Math.max(0, Number(item?.quantity || 0));
            const shape = item?.shape === 'cylinder' || item?.type === 'cylinder' ? 'cylinder' : 'box';
            const renderDimensions = Array.isArray(item?.renderDimensions)
                ? item.renderDimensions.map((value) => Number(value || 0))
                : [width, height, depth];

            for (let index = 0; index < quantity; index++) {
                items.push({
                    name: item.name,
                    clientKey,
                    clientName,
                    color,
                    shape,
                    dimensions: [width, height, depth],
                    renderDimensions: [...renderDimensions]
                });
            }
        });
    });

    return items;
}

function createPreviewVisualizationBlock(clientKey, clientName, groups) {
    const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
    const totalVolume = groups.reduce((sum, group) => sum + group.volume * group.items.length, 0);
    const weightedFootprint = groups.reduce((sum, group) => sum + (group.footprint * group.items.length), 0);
    const maxFootprint = groups.reduce((maxValue, group) => Math.max(maxValue, group.footprint), 0);
    const minFloorSpan = groups.reduce((minValue, group) => {
        return Math.min(minValue, Math.min(group.itemWidth, group.itemDepth));
    }, Number.POSITIVE_INFINITY);
    const maxGroupWidth = groups.reduce((maxValue, group) => Math.max(maxValue, group.itemWidth), 0);
    const crossSection = Math.max(
        (previewSlotPackingMetrics.maxZ - previewSlotPackingMetrics.minZ) * previewSlotPackingMetrics.usableHeight,
        previewSlotPackingMetrics.positionEpsilon
    );

    return {
        clientKey,
        clientName: clientName || groups[0]?.clientName || clientKey,
        groups,
        totalVolume,
        averageFootprint: totalItems ? weightedFootprint / totalItems : 0,
        maxFootprint,
        minFloorSpan: Number.isFinite(minFloorSpan) ? minFloorSpan : 0,
        maxGroupWidth,
        minimalLength: Math.max(
            maxGroupWidth + previewSlotPackingMetrics.gap * 2,
            totalVolume / crossSection
        )
    };
}

function buildPreviewVisualizationGroups(items, clientKey) {
    const groups = new Map();

    items
        .filter((item) => item.clientKey === clientKey)
        .forEach((item) => {
            const key = `${item.name}:${item.shape}:${item.dimensions.join('x')}:${item.renderDimensions.join('x')}`;
            if (!groups.has(key)) {
                const [width, height, depth] = item.dimensions;
                groups.set(key, {
                    key,
                    clientKey,
                    clientName: item.clientName,
                    color: item.color,
                    name: item.name,
                    shape: item.shape,
                    renderDimensions: [...item.renderDimensions],
                    itemWidth: width,
                    itemHeight: height,
                    itemDepth: depth,
                    footprint: width * depth,
                    volume: width * height * depth,
                    items: []
                });
            }
            groups.get(key).items.push(item);
        });

    return Array.from(groups.values()).sort((a, b) => {
        return b.footprint - a.footprint ||
            b.volume - a.volume ||
            b.itemHeight - a.itemHeight ||
            b.items.length - a.items.length;
    });
}

function buildPreviewVisualizationBlocks(items) {
    const clientKeys = [...new Set(items.map((item) => item.clientKey))];

    return clientKeys.map((clientKey) => {
        const groups = buildPreviewVisualizationGroups(items, clientKey);
        return createPreviewVisualizationBlock(clientKey, groups[0]?.clientName || clientKey, groups);
    });
}

function buildPreviewDeferredVisualizationBlock(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return null;
    }

    const groups = new Map();

    entries.forEach((entry) => {
        if (!entry?.item) {
            return;
        }

        if (!groups.has(entry.groupKey)) {
            groups.set(entry.groupKey, {
                key: entry.groupKey,
                clientKey: entry.item.clientKey,
                clientName: entry.item.clientName,
                color: entry.item.color,
                name: entry.item.name,
                shape: entry.item.shape,
                renderDimensions: Array.isArray(entry.item.renderDimensions) ? [...entry.item.renderDimensions] : [...entry.item.dimensions],
                itemWidth: entry.itemWidth,
                itemHeight: entry.itemHeight,
                itemDepth: entry.itemDepth,
                footprint: entry.footprint,
                volume: entry.volume,
                items: []
            });
        }

        groups.get(entry.groupKey).items.push(entry.item);
    });

    const orderedGroups = Array.from(groups.values()).sort((a, b) => {
        return b.footprint - a.footprint ||
            b.volume - a.volume ||
            b.itemHeight - a.itemHeight ||
            b.items.length - a.items.length;
    });

    return createPreviewVisualizationBlock('__deferred_mix__', 'Sobras Misturadas', orderedGroups);
}

function buildPreviewDeferredVisualizationEntries(entries) {
    const deferredBlock = buildPreviewDeferredVisualizationBlock(entries);
    if (!deferredBlock) {
        return [];
    }

    return buildPreviewVisualizationEntries(deferredBlock).sort((a, b) => {
        return a.footprint - b.footprint ||
            a.volume - b.volume ||
            a.itemHeight - b.itemHeight;
    });
}

function getPreviewVisualizationOrientations(width, height, depth) {
    return [
        { width, height, depth, rotated: false },
        { width: depth, height, depth: width, rotated: true }
    ].filter((orientation, index, list) => {
        return index === list.findIndex((candidate) =>
            Math.abs(candidate.width - orientation.width) <= previewSlotPackingMetrics.positionEpsilon &&
            Math.abs(candidate.depth - orientation.depth) <= previewSlotPackingMetrics.positionEpsilon
        );
    });
}

function scorePreviewVisualizationLayout(layout, minFloorSpan) {
    const fragments = layout.map((slot) => ({
        area: (slot.xMax - slot.xMin) * (slot.zMax - slot.zMin),
        minSpan: Math.min(slot.xMax - slot.xMin, slot.zMax - slot.zMin)
    }));

    return {
        unusableCount: fragments.filter((fragment) => fragment.minSpan < minFloorSpan - previewSlotPackingMetrics.positionEpsilon).length,
        maxSpan: fragments.reduce((value, fragment) => Math.max(value, fragment.minSpan), 0),
        maxArea: fragments.reduce((value, fragment) => Math.max(value, fragment.area), 0)
    };
}

function chooseBestPreviewVisualizationRemainder(layouts, minFloorSpan) {
    return layouts.reduce((bestLayout, currentLayout) => {
        if (!bestLayout) return currentLayout;

        const bestScore = scorePreviewVisualizationLayout(bestLayout, minFloorSpan);
        const currentScore = scorePreviewVisualizationLayout(currentLayout, minFloorSpan);
        if (currentScore.unusableCount !== bestScore.unusableCount) {
            return currentScore.unusableCount < bestScore.unusableCount ? currentLayout : bestLayout;
        }
        if (Math.abs(currentScore.maxSpan - bestScore.maxSpan) > previewSlotPackingMetrics.positionEpsilon) {
            return currentScore.maxSpan > bestScore.maxSpan ? currentLayout : bestLayout;
        }
        return currentScore.maxArea > bestScore.maxArea + previewSlotPackingMetrics.positionEpsilon ? currentLayout : bestLayout;
    }, null) || [];
}

function getPreviewVisualizationAnchors(slot, placement) {
    const centeredZMin = slot.zMin + Math.max(0, ((slot.zMax - slot.zMin) - placement.depth) / 2);
    return [slot.zMin, centeredZMin, slot.zMax - placement.depth].filter((anchor, index, list) => {
        return anchor >= slot.zMin - previewSlotPackingMetrics.positionEpsilon &&
            anchor + placement.depth <= slot.zMax + previewSlotPackingMetrics.positionEpsilon &&
            index === list.findIndex((candidate) => Math.abs(candidate - anchor) <= previewSlotPackingMetrics.positionEpsilon);
    });
}

function buildPreviewVisualizationRemainders(slot, placement, usedZMin) {
    const usedXMin = slot.xMax - placement.width;
    const usedZMax = usedZMin + placement.depth;

    const widthFirst = [];
    if (usedXMin - slot.xMin > previewSlotPackingMetrics.positionEpsilon) {
        widthFirst.push({ xMin: slot.xMin, xMax: usedXMin, zMin: slot.zMin, zMax: slot.zMax, baseY: slot.baseY, stackLevel: slot.stackLevel, groupKey: slot.groupKey });
    }
    if (usedZMin - slot.zMin > previewSlotPackingMetrics.positionEpsilon) {
        widthFirst.push({ xMin: usedXMin, xMax: slot.xMax, zMin: slot.zMin, zMax: usedZMin, baseY: slot.baseY, stackLevel: slot.stackLevel, groupKey: slot.groupKey });
    }
    if (slot.zMax - usedZMax > previewSlotPackingMetrics.positionEpsilon) {
        widthFirst.push({ xMin: usedXMin, xMax: slot.xMax, zMin: usedZMax, zMax: slot.zMax, baseY: slot.baseY, stackLevel: slot.stackLevel, groupKey: slot.groupKey });
    }

    const depthFirst = [];
    if (usedZMin - slot.zMin > previewSlotPackingMetrics.positionEpsilon) {
        depthFirst.push({ xMin: slot.xMin, xMax: slot.xMax, zMin: slot.zMin, zMax: usedZMin, baseY: slot.baseY, stackLevel: slot.stackLevel, groupKey: slot.groupKey });
    }
    if (slot.zMax - usedZMax > previewSlotPackingMetrics.positionEpsilon) {
        depthFirst.push({ xMin: slot.xMin, xMax: slot.xMax, zMin: usedZMax, zMax: slot.zMax, baseY: slot.baseY, stackLevel: slot.stackLevel, groupKey: slot.groupKey });
    }
    if (usedXMin - slot.xMin > previewSlotPackingMetrics.positionEpsilon) {
        depthFirst.push({ xMin: slot.xMin, xMax: usedXMin, zMin: usedZMin, zMax: usedZMax, baseY: slot.baseY, stackLevel: slot.stackLevel, groupKey: slot.groupKey });
    }

    return { usedXMin, usedXMax: slot.xMax, usedZMin, usedZMax, layouts: [widthFirst, depthFirst] };
}

function nearlyEqualPreviewVisualization(a, b) {
    return Math.abs(a - b) <= previewSlotPackingMetrics.positionEpsilon;
}

function rangesTouchPreviewVisualization(minA, maxA, minB, maxB) {
    return Math.abs(maxA - minB) <= previewSlotPackingMetrics.positionEpsilon || Math.abs(maxB - minA) <= previewSlotPackingMetrics.positionEpsilon;
}

function buildMergedPreviewVisualizationSlot(state, slotIndex) {
    const seedSlot = state.slots[slotIndex];
    const consumedIndexes = new Set([slotIndex]);
    const mergedSlot = {
        xMin: seedSlot.xMin,
        xMax: seedSlot.xMax,
        zMin: seedSlot.zMin,
        zMax: seedSlot.zMax,
        baseY: seedSlot.baseY,
        stackLevel: seedSlot.stackLevel,
        groupKey: seedSlot.groupKey
    };

    let changed = true;
    while (changed) {
        changed = false;

        for (let index = 0; index < state.slots.length; index++) {
            if (consumedIndexes.has(index)) continue;
            const slot = state.slots[index];

            if (!nearlyEqualPreviewVisualization(slot.baseY, mergedSlot.baseY) || slot.stackLevel !== mergedSlot.stackLevel) {
                continue;
            }

            if (
                nearlyEqualPreviewVisualization(slot.xMin, mergedSlot.xMin) &&
                nearlyEqualPreviewVisualization(slot.xMax, mergedSlot.xMax) &&
                rangesTouchPreviewVisualization(mergedSlot.zMin, mergedSlot.zMax, slot.zMin, slot.zMax)
            ) {
                mergedSlot.zMin = Math.min(mergedSlot.zMin, slot.zMin);
                mergedSlot.zMax = Math.max(mergedSlot.zMax, slot.zMax);
                consumedIndexes.add(index);
                changed = true;
                continue;
            }

            if (
                nearlyEqualPreviewVisualization(slot.zMin, mergedSlot.zMin) &&
                nearlyEqualPreviewVisualization(slot.zMax, mergedSlot.zMax) &&
                rangesTouchPreviewVisualization(mergedSlot.xMin, mergedSlot.xMax, slot.xMin, slot.xMax)
            ) {
                mergedSlot.xMin = Math.min(mergedSlot.xMin, slot.xMin);
                mergedSlot.xMax = Math.max(mergedSlot.xMax, slot.xMax);
                consumedIndexes.add(index);
                changed = true;
            }
        }
    }

    return {
        slot: mergedSlot,
        slotIndexes: [...consumedIndexes].sort((a, b) => b - a)
    };
}

function previewVisualizationPlacement(slot, entry, maxLayers = Infinity) {
    if (slot.baseY + entry.itemHeight > TRUCK_DIMENSIONS.height - TOP_CLEARANCE + previewSlotPackingMetrics.positionEpsilon) {
        return null;
    }

    const supportWidth = slot.xMax - slot.xMin;
    const supportDepth = slot.zMax - slot.zMin;
    let best = null;

    for (const orientation of getPreviewVisualizationOrientations(entry.itemWidth, entry.itemHeight, entry.itemDepth)) {
        if (orientation.width > supportWidth + previewSlotPackingMetrics.positionEpsilon || orientation.depth > supportDepth + previewSlotPackingMetrics.positionEpsilon) {
            continue;
        }
        if (slot.stackLevel + 1 > maxLayers) {
            continue;
        }

        const placement = {
            width: orientation.width,
            height: entry.itemHeight,
            depth: orientation.depth,
            rotated: orientation.rotated,
            y: slot.baseY + entry.itemHeight / 2,
            baseY: slot.baseY,
            layer: slot.baseY <= previewSlotPackingMetrics.floorY + previewSlotPackingMetrics.positionEpsilon ? 'fundo_chao' : 'fundo_empilhado',
            supportArea: supportWidth * supportDepth,
            wasteArea: supportWidth * supportDepth - orientation.width * orientation.depth,
            topY: slot.baseY + entry.itemHeight,
            stackLevel: slot.stackLevel + 1
        };

        if (!best || placement.wasteArea < best.wasteArea - previewSlotPackingMetrics.positionEpsilon) {
            best = placement;
        }
    }

    return best;
}

function getBestPreviewVisualizationAnchor(state, slot, placement) {
    const anchors = slot.baseY <= previewSlotPackingMetrics.floorY + previewSlotPackingMetrics.positionEpsilon
        ? getPreviewVisualizationAnchors(slot, placement)
        : [slot.zMin];
    let bestAnchor = null;

    anchors.forEach((anchorZMin) => {
        const layoutCandidate = buildPreviewVisualizationRemainders(slot, placement, anchorZMin);
        const remainderLayout = chooseBestPreviewVisualizationRemainder(layoutCandidate.layouts, state.minFloorSpan);
        const layoutScore = scorePreviewVisualizationLayout(remainderLayout, state.minFloorSpan);
        const candidate = { ...layoutCandidate, remainders: remainderLayout, layoutScore };

        if (!bestAnchor) {
            bestAnchor = candidate;
            return;
        }

        if (layoutScore.unusableCount !== bestAnchor.layoutScore.unusableCount) {
            if (layoutScore.unusableCount < bestAnchor.layoutScore.unusableCount) {
                bestAnchor = candidate;
            }
            return;
        }

        if (Math.abs(layoutScore.maxSpan - bestAnchor.layoutScore.maxSpan) > previewSlotPackingMetrics.positionEpsilon) {
            if (layoutScore.maxSpan > bestAnchor.layoutScore.maxSpan) {
                bestAnchor = candidate;
            }
            return;
        }

        if (layoutScore.maxArea > bestAnchor.layoutScore.maxArea + previewSlotPackingMetrics.positionEpsilon) {
            bestAnchor = candidate;
        }
    });

    return bestAnchor;
}

function isBetterPreviewVisualizationFloor(current, best) {
    if (!best) return true;
    if (Math.abs(current.slot.xMax - best.slot.xMax) > previewSlotPackingMetrics.positionEpsilon) {
        return current.slot.xMax > best.slot.xMax;
    }
    if (current.anchorLayout.layoutScore.unusableCount !== best.anchorLayout.layoutScore.unusableCount) {
        return current.anchorLayout.layoutScore.unusableCount < best.anchorLayout.layoutScore.unusableCount;
    }
    if (Math.abs(current.anchorLayout.layoutScore.maxSpan - best.anchorLayout.layoutScore.maxSpan) > previewSlotPackingMetrics.positionEpsilon) {
        return current.anchorLayout.layoutScore.maxSpan > best.anchorLayout.layoutScore.maxSpan;
    }
    if (Math.abs(current.placement.supportArea - best.placement.supportArea) > previewSlotPackingMetrics.positionEpsilon) {
        return current.placement.supportArea > best.placement.supportArea;
    }
    return current.placement.wasteArea < best.placement.wasteArea - previewSlotPackingMetrics.positionEpsilon;
}

function isBetterPreviewVisualizationTop(current, best) {
    if (!best) return true;
    if (current.placement.stackLevel !== best.placement.stackLevel) {
        return current.placement.stackLevel < best.placement.stackLevel;
    }
    if (Math.abs(current.placement.supportArea - best.placement.supportArea) > previewSlotPackingMetrics.positionEpsilon) {
        return current.placement.supportArea > best.placement.supportArea;
    }
    if (Math.abs(current.placement.wasteArea - best.placement.wasteArea) > previewSlotPackingMetrics.positionEpsilon) {
        return current.placement.wasteArea < best.placement.wasteArea;
    }
    if (Math.abs(current.placement.topY - best.placement.topY) > previewSlotPackingMetrics.positionEpsilon) {
        return current.placement.topY < best.placement.topY;
    }
    return current.sameGroup && !best.sameGroup;
}

function findBestPreviewVisualizationFloor(state, entry) {
    let best = null;
    for (let slotIndex = 0; slotIndex < state.slots.length; slotIndex++) {
        const merged = buildMergedPreviewVisualizationSlot(state, slotIndex);
        const slot = merged.slot;
        if (slot.baseY > previewSlotPackingMetrics.floorY + previewSlotPackingMetrics.positionEpsilon) continue;
        const placement = previewVisualizationPlacement(slot, entry);
        if (!placement) continue;
        const candidate = { slotIndexes: merged.slotIndexes, slot, placement, anchorLayout: getBestPreviewVisualizationAnchor(state, slot, placement) };
        if (candidate.anchorLayout && isBetterPreviewVisualizationFloor(candidate, best)) {
            best = candidate;
        }
    }
    return best;
}

function findBestPreviewVisualizationTop(state, entry, maxLayers = Infinity) {
    let best = null;
    for (let slotIndex = 0; slotIndex < state.slots.length; slotIndex++) {
        const merged = buildMergedPreviewVisualizationSlot(state, slotIndex);
        const slot = merged.slot;
        if (slot.baseY <= previewSlotPackingMetrics.floorY + previewSlotPackingMetrics.positionEpsilon) continue;
        const placement = previewVisualizationPlacement(slot, entry, maxLayers);
        if (!placement) continue;
        const candidate = {
            slotIndexes: merged.slotIndexes,
            slot,
            placement,
            anchorLayout: getBestPreviewVisualizationAnchor(state, slot, placement),
            sameGroup: slot.groupKey === entry.groupKey
        };
        if (candidate.anchorLayout && isBetterPreviewVisualizationTop(candidate, best)) {
            best = candidate;
        }
    }
    return best;
}

function placePreviewVisualizationCandidate(state, candidate, groupKey) {
    const slot = candidate.slot;
    const slotIndexes = Array.isArray(candidate.slotIndexes) ? candidate.slotIndexes : [];
    slotIndexes.forEach((index) => {
        state.slots.splice(index, 1);
    });
    const anchor = candidate.anchorLayout || getBestPreviewVisualizationAnchor(state, slot, candidate.placement);
    if (!anchor) return null;

    anchor.remainders.forEach((remainder) => state.slots.push(remainder));

    const nextStackLevel = slot.stackLevel + 1;
    if (slot.baseY + candidate.placement.height < TRUCK_DIMENSIONS.height - TOP_CLEARANCE - previewSlotPackingMetrics.positionEpsilon) {
        state.slots.push({
            xMin: anchor.usedXMin,
            xMax: anchor.usedXMax,
            zMin: anchor.usedZMin,
            zMax: anchor.usedZMax,
            baseY: slot.baseY + candidate.placement.height,
            stackLevel: nextStackLevel,
            groupKey
        });
    }

    if (slot.baseY <= previewSlotPackingMetrics.floorY + previewSlotPackingMetrics.positionEpsilon && slot.groupKey === state.floorGroupKey) {
        state.currentBlockFrontEdgeX = Math.min(state.currentBlockFrontEdgeX, anchor.usedXMin);
    }

    prunePreviewVisualizationSlots(state);

    return {
        x: (anchor.usedXMin + anchor.usedXMax) / 2,
        y: candidate.placement.y,
        z: (anchor.usedZMin + anchor.usedZMax) / 2,
        width: candidate.placement.width,
        height: candidate.placement.height,
        depth: candidate.placement.depth,
        rotated: candidate.placement.rotated,
        layer: candidate.placement.layer,
        stackLevel: candidate.placement.stackLevel
    };
}

function prunePreviewVisualizationSlots(state) {
    if (!state || !Array.isArray(state.slots) || state.slots.length === 0) {
        return;
    }

    const deduped = [];
    const seen = new Set();

    state.slots.forEach((slot) => {
        const width = slot.xMax - slot.xMin;
        const depth = slot.zMax - slot.zMin;
        if (width <= previewSlotPackingMetrics.positionEpsilon || depth <= previewSlotPackingMetrics.positionEpsilon) {
            return;
        }

        const key = [
            slot.baseY.toFixed(4),
            slot.stackLevel,
            slot.xMin.toFixed(4),
            slot.xMax.toFixed(4),
            slot.zMin.toFixed(4),
            slot.zMax.toFixed(4),
            slot.groupKey
        ].join(':');

        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        deduped.push(slot);
    });

    if (!(state.maxSlots > 0) || deduped.length <= state.maxSlots) {
        state.slots = deduped;
        return;
    }

    const floorLimit = Math.max(40, Math.floor(state.maxSlots * 0.65));
    const topLimit = Math.max(20, state.maxSlots - floorLimit);
    const sortByUsefulness = (slotA, slotB) => {
        if (Math.abs(slotB.xMax - slotA.xMax) > previewSlotPackingMetrics.positionEpsilon) {
            return slotB.xMax - slotA.xMax;
        }

        const minSpanA = Math.min(slotA.xMax - slotA.xMin, slotA.zMax - slotA.zMin);
        const minSpanB = Math.min(slotB.xMax - slotB.xMin, slotB.zMax - slotB.zMin);
        if (Math.abs(minSpanB - minSpanA) > previewSlotPackingMetrics.positionEpsilon) {
            return minSpanB - minSpanA;
        }

        const areaA = (slotA.xMax - slotA.xMin) * (slotA.zMax - slotA.zMin);
        const areaB = (slotB.xMax - slotB.xMin) * (slotB.zMax - slotB.zMin);
        return areaB - areaA;
    };

    const floorSlots = deduped
        .filter((slot) => slot.baseY <= previewSlotPackingMetrics.floorY + previewSlotPackingMetrics.positionEpsilon)
        .sort(sortByUsefulness)
        .slice(0, floorLimit);

    const topSlots = deduped
        .filter((slot) => slot.baseY > previewSlotPackingMetrics.floorY + previewSlotPackingMetrics.positionEpsilon)
        .sort((slotA, slotB) => {
            const areaA = (slotA.xMax - slotA.xMin) * (slotA.zMax - slotA.zMin);
            const areaB = (slotB.xMax - slotB.xMin) * (slotB.zMax - slotB.zMin);
            if (Math.abs(areaB - areaA) > previewSlotPackingMetrics.positionEpsilon) {
                return areaB - areaA;
            }
            return slotA.baseY - slotB.baseY;
        })
        .slice(0, topLimit);

    state.slots = [...floorSlots, ...topSlots];
}

function buildPreviewVisualizationState(block, rearX, frontX, carriedSlots = [], options = {}) {
    const floorGroupKey = `__floor__:${block.clientKey}`;
    const slots = carriedSlots.map((slot) => ({ ...slot }));

    if (rearX - frontX > previewSlotPackingMetrics.positionEpsilon) {
        slots.push({
            xMin: frontX,
            xMax: rearX,
            zMin: previewSlotPackingMetrics.minZ,
            zMax: previewSlotPackingMetrics.maxZ,
            baseY: previewSlotPackingMetrics.floorY,
            stackLevel: 0,
            groupKey: floorGroupKey
        });
    }

    const state = {
        currentBlockFrontEdgeX: rearX,
        minFloorSpan: block.minFloorSpan,
        largeFootprintThreshold: Math.max(block.averageFootprint * 1.15, block.maxFootprint * 0.55),
        floorGroupKey,
        maxSlots: Number.isFinite(options.maxSlots) ? Math.max(40, Number(options.maxSlots)) : Infinity,
        slots
    };

    prunePreviewVisualizationSlots(state);
    return state;
}

function collectPreviewCarryForwardSlots(state, options = {}) {
    const aggressiveMode = options.aggressiveMode === true;
    const carriedTopSlots = state.slots
        .filter((slot) => slot.baseY > previewSlotPackingMetrics.floorY + previewSlotPackingMetrics.positionEpsilon)
        .map((slot) => ({ ...slot }));

    if (!aggressiveMode) {
        return carriedTopSlots;
    }

    const carryFrontWindow = Number(options.carryFrontWindow);
    const maxCarrySlots = Math.max(1, Number(options.maxCarrySlots || 6));
    const frontierTolerance = Math.max(
        previewSlotPackingMetrics.positionEpsilon * 4,
        Number.isFinite(carryFrontWindow) ? carryFrontWindow : 0.08
    );
    const connectedFloorSlots = state.slots
        .filter((slot) => slot.baseY <= previewSlotPackingMetrics.floorY + previewSlotPackingMetrics.positionEpsilon)
        .filter((slot) => slot.xMax >= state.currentBlockFrontEdgeX - frontierTolerance)
        .sort((slotA, slotB) => {
            if (Math.abs(slotB.xMax - slotA.xMax) > previewSlotPackingMetrics.positionEpsilon) {
                return slotB.xMax - slotA.xMax;
            }
            const areaA = (slotA.xMax - slotA.xMin) * (slotA.zMax - slotA.zMin);
            const areaB = (slotB.xMax - slotB.xMin) * (slotB.zMax - slotB.zMin);
            return areaB - areaA;
        })
        .slice(0, maxCarrySlots)
        .map((slot) => ({ ...slot }));

    return [...carriedTopSlots, ...connectedFloorSlots];
}

function buildPreviewVisualizationEntries(block) {
    const entries = [];
    block.groups.forEach((group) => {
        group.items.forEach((item) => {
            entries.push({
                item,
                groupKey: group.key,
                itemWidth: group.itemWidth,
                itemHeight: group.itemHeight,
                itemDepth: group.itemDepth,
                footprint: group.footprint,
                volume: group.volume
            });
        });
    });

    return entries.sort((a, b) => b.footprint - a.footprint || b.volume - a.volume || b.itemHeight - a.itemHeight);
}

function choosePreviewVisualizationPlacement(state, entry, compactMode = false, aggressiveMode = false) {
    const floorCandidate = findBestPreviewVisualizationFloor(state, entry);
    const topCandidate = findBestPreviewVisualizationTop(state, entry, compactMode || aggressiveMode ? Infinity : 4);
    const isLargeItem = entry.footprint >= state.largeFootprintThreshold - previewSlotPackingMetrics.positionEpsilon;

    if (floorCandidate && topCandidate) {
        if (isLargeItem) {
            return placePreviewVisualizationCandidate(state, floorCandidate, entry.groupKey);
        }

        const floorExpandsFront = floorCandidate.anchorLayout.usedXMin < state.currentBlockFrontEdgeX - previewSlotPackingMetrics.positionEpsilon;
        const floorFragmentsBadly = floorCandidate.anchorLayout.layoutScore.unusableCount > 0;
        const topUsesUpperSpace = topCandidate.placement.supportArea > (entry.itemWidth * entry.itemDepth) + previewSlotPackingMetrics.positionEpsilon;
        const topFillsBroaderBase = topCandidate.placement.supportArea > floorCandidate.placement.supportArea + previewSlotPackingMetrics.positionEpsilon;

        if ((aggressiveMode && floorExpandsFront) || (topUsesUpperSpace && (floorExpandsFront || floorFragmentsBadly || topFillsBroaderBase))) {
            return placePreviewVisualizationCandidate(state, topCandidate, entry.groupKey);
        }

        return placePreviewVisualizationCandidate(state, floorCandidate, entry.groupKey);
    }

    return floorCandidate
        ? placePreviewVisualizationCandidate(state, floorCandidate, entry.groupKey)
        : topCandidate
            ? placePreviewVisualizationCandidate(state, topCandidate, entry.groupKey)
            : null;
}

function evaluatePreviewPackingResult(candidate, best) {
    if (!best) return true;
    if (candidate.placements.length !== best.placements.length) {
        return candidate.placements.length > best.placements.length;
    }
    if ((candidate.layerStats.fundo_chao || 0) !== (best.layerStats.fundo_chao || 0)) {
        return (candidate.layerStats.fundo_chao || 0) > (best.layerStats.fundo_chao || 0);
    }
    if (candidate.maxStackLevel !== best.maxStackLevel) {
        return candidate.maxStackLevel < best.maxStackLevel;
    }
    return (candidate.layerStats.fundo_empilhado || 0) < (best.layerStats.fundo_empilhado || 0);
}

function packPreviewItemsWithSlots(selectedClientKey) {
    syncPreviewSlotPackingMetrics();
    const items = buildPreviewVisualizationItems(selectedClientKey);
    if (!items.length) {
        return {
            placements: [],
            layerStats: { fundo_chao: 0, fundo_empilhado: 0 },
            totalCount: 0,
            placedCount: 0,
            missingCount: 0
        };
    }

    const blocks = buildPreviewVisualizationBlocks(items);
    const shouldTrimPasses = selectedClientKey === 'all' && items.length > 800;

    const runPacking = (config = {}) => {
        const compactMode = config.compactMode === true;
        const aggressiveMode = config.aggressiveMode === true;
        const placements = [];
        const layerStats = { fundo_chao: 0, fundo_empilhado: 0 };
        const deferredEntries = [];
        let maxStackLevel = 0;
        let currentRearX = previewSlotPackingMetrics.rearX;
        let carriedTopSlots = [];
        const reserveFactor = Math.max(0, Math.min(1, Number(config.reserveFactor ?? 1)));
        const orderGap = config.orderGapOverride != null
            ? Math.max(0, Number(config.orderGapOverride))
            : aggressiveMode
                ? Math.min(previewSlotPackingMetrics.orderGap, 0.005)
                : compactMode
                    ? Math.min(previewSlotPackingMetrics.orderGap, 0.01)
                    : previewSlotPackingMetrics.orderGap;

        const carryFrontWindow = config.carryFrontWindow != null
            ? Math.max(0.02, Number(config.carryFrontWindow))
            : aggressiveMode
                ? 0.18
                : 0.08;
        const maxCarrySlots = config.maxCarrySlots != null
            ? Math.max(1, Number(config.maxCarrySlots))
            : compactMode
                ? 8
                : 6;
        const maxSlots = config.maxSlots != null
            ? Math.max(80, Number(config.maxSlots))
            : shouldTrimPasses
                ? 260
                : Infinity;

        for (let index = 0; index < blocks.length; index++) {
            const block = blocks[index];
            const remainingBlocks = blocks.slice(index + 1);
            const reserveForRemaining = (
                remainingBlocks.reduce((sum, remainingBlock) => sum + remainingBlock.minimalLength, 0) + orderGap * remainingBlocks.length
            ) * reserveFactor;
            const frontLimit = Math.max(
                previewSlotPackingMetrics.minX,
                currentRearX - Math.max(block.minimalLength, currentRearX - previewSlotPackingMetrics.minX - reserveForRemaining)
            );
            const state = buildPreviewVisualizationState(block, currentRearX, frontLimit, carriedTopSlots, { maxSlots });
            const entries = buildPreviewVisualizationEntries(block);

            entries.forEach((entry) => {
                const position = choosePreviewVisualizationPlacement(state, entry, compactMode, aggressiveMode);
                if (!position) {
                    deferredEntries.push(entry);
                    return;
                }

                placements.push({ item: entry.item, position });
                layerStats[position.layer] = (layerStats[position.layer] || 0) + 1;
                maxStackLevel = Math.max(maxStackLevel, position.stackLevel || 0);
            });

            carriedTopSlots = collectPreviewCarryForwardSlots(state, {
                aggressiveMode,
                carryFrontWindow,
                maxCarrySlots
            });

            currentRearX = state.currentBlockFrontEdgeX - orderGap;
        }

        if (config.allowDeferredMix !== false && blocks.length > 1 && deferredEntries.length > 0) {
            const deferredEntriesOrdered = buildPreviewDeferredVisualizationEntries(deferredEntries);
            const deferredBlock = deferredEntriesOrdered.length > 0
                ? createPreviewVisualizationBlock('__deferred_mix__', 'Sobras Misturadas', [])
                : null;
            const deferredState = deferredEntriesOrdered.length > 0
                ? buildPreviewVisualizationState(
                    {
                        ...deferredBlock,
                        clientKey: '__deferred_mix__',
                        clientName: 'Sobras Misturadas',
                        groups: [],
                        totalVolume: 0,
                        averageFootprint: deferredEntriesOrdered.reduce((sum, entry) => sum + entry.footprint, 0) / deferredEntriesOrdered.length,
                        maxFootprint: deferredEntriesOrdered.reduce((maxValue, entry) => Math.max(maxValue, entry.footprint), 0),
                        minFloorSpan: deferredEntriesOrdered.reduce((minValue, entry) => Math.min(minValue, Math.min(entry.itemWidth, entry.itemDepth)), Number.POSITIVE_INFINITY),
                        maxGroupWidth: deferredEntriesOrdered.reduce((maxValue, entry) => Math.max(maxValue, entry.itemWidth), 0),
                        minimalLength: 0
                    },
                    Math.max(currentRearX, previewSlotPackingMetrics.minX),
                    previewSlotPackingMetrics.minX,
                    carriedTopSlots,
                    { maxSlots }
                )
                : null;

            if (deferredEntriesOrdered.length > 0 && deferredState && deferredState.slots.length > 0) {
                let consecutiveMisses = 0;
                const maxDeferredMisses = Math.max(120, deferredState.slots.length * 10);

                deferredEntriesOrdered.forEach((entry) => {
                    if (consecutiveMisses >= maxDeferredMisses) {
                        return;
                    }

                    const position = choosePreviewVisualizationPlacement(deferredState, entry, true, true);
                    if (!position) {
                        consecutiveMisses += 1;
                        return;
                    }

                    consecutiveMisses = 0;
                    placements.push({ item: entry.item, position });
                    layerStats[position.layer] = (layerStats[position.layer] || 0) + 1;
                    maxStackLevel = Math.max(maxStackLevel, position.stackLevel || 0);
                });
            }
        }

        return { placements, layerStats, maxStackLevel };
    };

    const strictConfigs = shouldTrimPasses
        ? [
            {
                compactMode: true,
                aggressiveMode: true,
                allowDeferredMix: false,
                orderGapOverride: 0,
                reserveFactor: 0.7,
                carryFrontWindow: 0.35,
                maxCarrySlots: 12
            }
        ]
        : [
            { compactMode: false, aggressiveMode: false, allowDeferredMix: false },
            { compactMode: true, aggressiveMode: false, allowDeferredMix: false },
            {
                compactMode: true,
                aggressiveMode: true,
                allowDeferredMix: false,
                orderGapOverride: 0,
                reserveFactor: 0.85,
                carryFrontWindow: 0.18,
                maxCarrySlots: 10
            }
        ];

    let best = null;
    strictConfigs.forEach((config) => {
        const result = runPacking(config);
        if (evaluatePreviewPackingResult(result, best)) {
            best = result;
        }
    });

    if (best && best.placements.length < items.length) {
        const mixedConfigs = shouldTrimPasses
            ? [
                {
                    compactMode: true,
                    aggressiveMode: true,
                    allowDeferredMix: true,
                    orderGapOverride: 0,
                    reserveFactor: 0.7,
                    carryFrontWindow: 0.35,
                    maxCarrySlots: 12
                }
            ]
            : [
                { compactMode: true, aggressiveMode: true, allowDeferredMix: true },
                {
                    compactMode: true,
                    aggressiveMode: true,
                    allowDeferredMix: true,
                    orderGapOverride: 0,
                    reserveFactor: 0.7,
                    carryFrontWindow: 0.35,
                    maxCarrySlots: 12
                }
            ];

        mixedConfigs.forEach((config) => {
            const result = runPacking(config);
            if (evaluatePreviewPackingResult(result, best)) {
                best = result;
            }
        });
    }

    return {
        placements: best.placements,
        layerStats: best.layerStats,
        totalCount: items.length,
        placedCount: best.placements.length,
        missingCount: Math.max(0, items.length - best.placements.length),
        maxStackLevel: best.maxStackLevel
    };
}

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
    
    packingLog('🚀 Iniciando carregamento 3D - Nova Lógica');
    
    // Limpar estruturas
    clientBlocks.length = 0;
    stacks.length = 0;
    window.instanceGroups = {};
    
    let allPlacements = [];
    let layerStats = {};

    try {
        const slotPackingResult = packPreviewItemsWithSlots(clientKey);
        if (Array.isArray(slotPackingResult?.placements) && slotPackingResult.placements.length > 0) {
            allPlacements = slotPackingResult.placements;
            layerStats = slotPackingResult.layerStats || {};
            packingLog(`📐 Packing por slots ativo: ${slotPackingResult.placedCount}/${slotPackingResult.totalCount}`);
        }
    } catch (error) {
        console.warn('Falha no packing por slots, usando fallback legado.', error);
    }

    if (allPlacements.length === 0) {
        const globalMissingProducts = [];

        if (clientKey === 'all') {
            const clientKeys = Object.keys(CLIENT_DATA);

            for (let i = 0; i < clientKeys.length; i++) {
                const key = clientKeys[i];
                const block = new ClientBlock(key, REAR_START_X, MIN_X_LIMIT);
                block.boundaryStacks = [...stacks];
                clientBlocks.push(block);

                const result = processClientItems(key, block);
                allPlacements.push(...result.placements);
                globalMissingProducts.push(...result.missingProducts);

                await nextFrame();
            }

            if (globalMissingProducts.length > 0) {
                const recoveredPlacements = fillGlobalMissingProducts(globalMissingProducts);
                allPlacements.push(...recoveredPlacements);
            }
        } else {
            const block = new ClientBlock(clientKey, REAR_START_X, MIN_X_LIMIT);
            clientBlocks.push(block);

            const result = processClientItems(clientKey, block);
            allPlacements.push(...result.placements);
        }
    }
    
    // Renderizar todos os itens
    scene.add(window.cargoGroup);
    let renderedCount = 0;
    
    for (let i = 0; i < allPlacements.length; i += 50) {
        const batchEnd = Math.min(i + 50, allPlacements.length);
        
        for (let j = i; j < batchEnd; j++) {
            const { item, position } = allPlacements[j];
            if (createCargoMesh(item, position)) {
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
    showInfoPanel(clientData, allPlacements.length, totalRequestedItems, layerStats, clientKey === 'all' ? 'multi' : 'single');
    
    return allPlacements.length > 0;
}

function processClientItems(clientKey, clientBlock) {
    const client = CLIENT_DATA[clientKey];
    packingLog(`\n🚀 Processando cliente: ${client.name}`);
    packingLog(`   Lógica: Por produto → Máxima altura → Rotação permitida`);
    
    const allPlacements = [];
    const missingProducts = [];
    
    // Agrupar itens por tipo de produto
    const productsMap = new Map();
    client.items.forEach((item) => {
        const dimensionsKey = Array.isArray(item.dimensions) ? item.dimensions.join('x') : 'sem-dimensoes';
        const renderDimensionsKey = Array.isArray(item.renderDimensions) ? item.renderDimensions.join('x') : 'sem-render';
        const shapeKey = String(item.shape || item.type || 'box');
        const productKey = `${clientKey}:${item.name}:${shapeKey}:${dimensionsKey}:${renderDimensionsKey}`;
        if (!productsMap.has(productKey)) {
            productsMap.set(productKey, {
                name: item.name,
                dimensions: item.dimensions,
                shape: shapeKey,
                renderDimensions: Array.isArray(item.renderDimensions) ? [...item.renderDimensions] : Array.isArray(item.dimensions) ? [...item.dimensions] : null,
                color: getOrderColor(clientKey),
                clientKey: clientKey,
                clientName: client.name,
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

    packingLog(`📦 Produtos encontrados: ${productsMap.size}`);

    // Processar cada tipo de produto completamente, do maior para o menor.
    for (const [, product] of sortedProducts) {
        packingLog(`\n🎯 Carregando produto: ${product.name} (${product.totalQuantity} unidades)`);

        const productPlacements = loadProductType(product, clientBlock);

        if (productPlacements.length > 0) {
            allPlacements.push(...productPlacements);
            packingLog(`✅ ${product.name}: ${productPlacements.length}/${product.totalQuantity} carregados`);
        } else {
            packingLog(`❌ ${product.name}: Nenhuma unidade coube`);
        }

        const remainingQuantity = Math.max(0, product.totalQuantity - productPlacements.length);
        if (remainingQuantity > 0) {
            missingProducts.push({
                ...product,
                totalQuantity: remainingQuantity
            });
        }
    }
    
    packingLog(`\n📊 Resumo do cliente ${client.name}:`);
    packingLog(`   ✅ Total carregado: ${allPlacements.length} itens`);
    
    return {
        placements: allPlacements,
        frontEdgeX: getPlacementsFrontEdgeX(allPlacements),
        missingProducts
    };
}

function fillGlobalMissingProducts(missingProducts) {
    if (!Array.isArray(missingProducts) || missingProducts.length === 0) {
        return [];
    }

    const fillBlock = new ClientBlock('__global-fill__', REAR_START_X, MIN_X_LIMIT);
    fillBlock.stacks = [...stacks];
    const recoveredPlacements = [];
    const sortedMissingProducts = [...missingProducts].sort((productA, productB) => {
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

        return Number(productB?.totalQuantity || 0) - Number(productA?.totalQuantity || 0);
    });

    sortedMissingProducts.forEach((product) => {
        const placements = loadProductType(product, fillBlock);
        if (placements.length > 0) {
            recoveredPlacements.push(...placements);
        }
    });

    return recoveredPlacements;
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
        const scoreA = scoreOrientationHeuristically(orientationA);
        const scoreB = scoreOrientationHeuristically(orientationB);
        return scoreB - scoreA;
    });
    
    // Tentar cada orientação e usar a alternativa para preencher sobras.
    for (const orientation of orientations) {
        const remainingQuantity = Math.max(0, product.totalQuantity - placements.length);
        if (remainingQuantity === 0) {
            break;
        }

        packingLog(`   🔄 Testando orientação: ${orientation.width.toFixed(2)}x${orientation.depth.toFixed(2)}${orientation.rotated ? ' (rotated)' : ''}`);
        
        const orientationPlacements = loadProductWithOrientation(product, orientation, clientBlock, remainingQuantity);
        
        if (orientationPlacements.length > 0) {
            placements.push(...orientationPlacements);
            packingLog(`   ✅ Orientação bem-sucedida: ${orientationPlacements.length} unidades`);
        }
    }
    
    return placements;
}

function scoreOrientationHeuristically(orientation) {
    const stackCapacity = Math.max(
        0,
        Math.floor((TRUCK_DIMENSIONS.height - TOP_CLEARANCE - FLOOR_Y + 1e-6) / orientation.height)
    );
    const footprint = orientation.width * orientation.depth;
    const narrowSide = Math.min(orientation.width, orientation.depth);
    const longSide = Math.max(orientation.width, orientation.depth);

    return (
        stackCapacity * 1000000
        - footprint * 10000
        - longSide * 100
        - narrowSide * 10
    );
}

function loadProductWithOrientation(product, orientation, clientBlock, maxQuantity = product.totalQuantity) {
    const placements = [];
    let loadedCount = 0;

    const stackedOnExisting = stackItemsOnExistingStacks(product, orientation, clientBlock, maxQuantity);
    if (stackedOnExisting.length > 0) {
        placements.push(...stackedOnExisting);
        loadedCount += stackedOnExisting.length;
        packingLog(`   ⬆️ Aproveitado em pilhas existentes: ${stackedOnExisting.length} unidades`);
    }

    while (loadedCount < maxQuantity) {
        const availablePositions = findAvailablePositions(
            clientBlock,
            orientation.width,
            orientation.depth,
            orientation.height,
            { itemShape: product.shape, respectCursor: false, stopAfterFirst: true }
        );

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

        packingLog(`   📦 Pilha em (${position.x.toFixed(2)}, ${position.z.toFixed(2)}): ${stackedItems.length} unidades`);
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
            packingLog(`   🧩 Fechamento de sobras: ${relaxedPlacements.length} unidades`);
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

        const topPositions = findAvailableTopPositions(
            supportStack,
            clientBlock,
            orientation.width,
            orientation.depth,
            orientation.height,
            product.shape
        );
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

function findAvailableTopPositions(supportStack, clientBlock, itemWidth, itemDepth, itemHeight, itemShape = 'box') {
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

            if (insideSupport && isValidPosition(currentX, currentZ, itemWidth, itemDepth, clientBlock, gap, baseY, itemHeight, itemShape)) {
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
    const itemShape = String(options.itemShape || 'box');
    const isCircularItem = isCircularFootprint(itemShape, itemWidth, itemDepth);
    const respectCursor = options.respectCursor !== false;
    const respectBoundary = options.respectBoundary !== false;
    const respectConnectivity = options.respectConnectivity !== false;
    const stopAfterFirst = options.stopAfterFirst === true;

    const relevantStacks = stacks.filter((stack) => clientBlock.containsPosition(stack.x, stack.baseWidth));
    const xStart = clientBlock.startX - itemWidth / 2;
    const xEnd = clientBlock.endX + itemWidth / 2;
    const zStart = MIN_Z_EDGE + itemDepth / 2;
    const zEnd = MAX_Z_EDGE - itemDepth / 2;

    const xExtreme = buildAxisCandidates(
        xStart,
        xEnd,
        relevantStacks,
        itemWidth,
        'x'
    );
    const zExtreme = buildAxisCandidates(
        zStart,
        zEnd,
        relevantStacks,
        itemDepth,
        'z'
    );

    // Grid candidates alinham colunas/linhas (estilo wall packing)
    const xGrid = buildGridCandidates(xStart, xEnd, itemWidth, 'x', itemShape);
    const zGrid = buildGridCandidates(zStart, zEnd, itemDepth, 'z', itemShape);

    const xPreferred = buildPreferredClientXCandidates(clientBlock, xStart, xEnd);
    const xExtremeSorted = xExtreme.sort((a, b) => b - a);
    const xGridSorted = xGrid.sort((a, b) => b - a);
    const xCandidates = mergeCandidateGroups(
        xPreferred,
        xExtremeSorted,
        xGridSorted
    );
    const zCandidates = mergeCandidates(zExtreme, zGrid).sort((a, b) => a - b);

    if (isCircularItem) {
        const hexRows = buildHexRows(zStart, zEnd, itemWidth);

        for (const row of hexRows) {
            const currentZ = row.z;
            const xRowGrid = buildGridCandidates(
                xStart - row.xOffset,
                xEnd,
                itemWidth,
                'x'
            ).sort((a, b) => b - a);
            const xRowCandidates = mergeCandidateGroups(
                xPreferred,
                xExtremeSorted,
                xRowGrid
            );

            for (const currentX of xRowCandidates) {
                if (respectCursor && !isPositionWithinClientCursor(currentX, currentZ, clientBlock.searchCursor)) {
                    continue;
                }
                if (respectBoundary && !isPositionWithinClientBoundary(currentX, currentZ, itemWidth, itemDepth, clientBlock)) {
                    continue;
                }
                if (respectConnectivity && !isPositionConnectedToClientStacks(currentX, currentZ, itemWidth, itemDepth, clientBlock, itemShape)) {
                    continue;
                }
                if (isValidPosition(currentX, currentZ, itemWidth, itemDepth, clientBlock, gap, FLOOR_Y, itemHeight, itemShape)) {
                    positions.push({ x: currentX, z: currentZ });
                    if (stopAfterFirst) {
                        return positions;
                    }
                }
            }
        }
    }

    for (const currentX of xCandidates) {
        for (const currentZ of zCandidates) {
            if (respectCursor && !isPositionWithinClientCursor(currentX, currentZ, clientBlock.searchCursor)) {
                continue;
            }
            if (respectBoundary && !isPositionWithinClientBoundary(currentX, currentZ, itemWidth, itemDepth, clientBlock)) {
                continue;
            }
            if (respectConnectivity && !isPositionConnectedToClientStacks(currentX, currentZ, itemWidth, itemDepth, clientBlock, itemShape)) {
                continue;
            }
            if (isValidPosition(currentX, currentZ, itemWidth, itemDepth, clientBlock, gap, FLOOR_Y, itemHeight, itemShape)) {
                positions.push({ x: currentX, z: currentZ });
                if (stopAfterFirst) {
                    return positions;
                }
            }
        }
    }
    
    return positions;
}

function buildPreferredClientXCandidates(clientBlock, xStart, xEnd) {
    if (!Array.isArray(clientBlock?.stacks) || clientBlock.stacks.length === 0) {
        return [];
    }

    return clientBlock.stacks
        .map((stack) => Number(stack?.x))
        .filter((value) => Number.isFinite(value) && value >= xEnd - 1e-6 && value <= xStart + 1e-6)
        .sort((a, b) => b - a);
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
            { itemShape: product.shape, respectCursor: false, respectConnectivity: false, stopAfterFirst: true }
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

function buildGridCandidates(startValue, endValue, itemSize, axis, itemShape = 'box') {
    void itemShape;
    const gap = GAP_STACK;
    const candidates = [];
    const seen = new Set();
    const addCandidate = (value) => {
        if (!Number.isFinite(value)) {
            return;
        }
        const key = value.toFixed(6);
        if (seen.has(key)) {
            return;
        }
        if (axis === 'x') {
            if (value < endValue - 1e-6 || value > startValue + 1e-6) {
                return;
            }
        } else if (value < startValue - 1e-6 || value > endValue + 1e-6) {
            return;
        }
        seen.add(key);
        candidates.push(value);
    };

    if (axis === 'x') {
        for (let value = startValue; value >= endValue - 1e-6; value -= (itemSize + gap)) {
            addCandidate(value);
        }
        return candidates;
    }

    for (let value = startValue; value <= endValue + 1e-6; value += (itemSize + gap)) {
        addCandidate(value);
    }
    return candidates;
}

function buildHexRows(startZ, endZ, itemDiameter) {
    const rows = [];
    const step = itemDiameter + GAP_STACK;
    const rowSpacing = (Math.sqrt(3) / 2) * step;
    let rowIndex = 0;

    for (let currentZ = startZ; currentZ <= endZ + 1e-6; currentZ += rowSpacing) {
        rows.push({
            z: currentZ,
            xOffset: (rowIndex % 2) * (step / 2)
        });
        rowIndex += 1;
    }

    return rows;
}

function mergeCandidates(primary, secondary) {
    const merged = [];
    const seen = new Set();

    const add = (value) => {
        if (!Number.isFinite(value)) return;
        const key = value.toFixed(6);
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(value);
    };

    primary.forEach(add);
    secondary.forEach(add);
    return merged;
}

function mergeCandidateGroups(...groups) {
    const merged = [];
    const seen = new Set();

    groups.forEach((group) => {
        group.forEach((value) => {
            if (!Number.isFinite(value)) return;
            const key = value.toFixed(6);
            if (seen.has(key)) return;
            seen.add(key);
            merged.push(value);
        });
    });

    return merged;
}

function isCircularFootprint(shape, width, depth) {
    return String(shape || 'box') === 'cylinder' && Math.abs(Number(width || 0) - Number(depth || 0)) <= 1e-6;
}

function footprintsOverlap(itemFootprint, stackFootprint, gap) {
    const itemIsCircle = isCircularFootprint(itemFootprint.shape, itemFootprint.width, itemFootprint.depth);
    const stackIsCircle = isCircularFootprint(stackFootprint.shape, stackFootprint.width, stackFootprint.depth);

    if (itemIsCircle && stackIsCircle) {
        const combinedRadius = itemFootprint.width / 2 + stackFootprint.width / 2 + gap;
        const deltaX = itemFootprint.x - stackFootprint.x;
        const deltaZ = itemFootprint.z - stackFootprint.z;
        return (deltaX * deltaX + deltaZ * deltaZ) < (combinedRadius * combinedRadius) - 1e-6;
    }

    if (itemIsCircle) {
        return circleRectOverlap(itemFootprint, stackFootprint, gap);
    }

    if (stackIsCircle) {
        return circleRectOverlap(stackFootprint, itemFootprint, gap);
    }

    const itemLeft = itemFootprint.x - itemFootprint.width / 2;
    const itemRight = itemFootprint.x + itemFootprint.width / 2;
    const itemFront = itemFootprint.z - itemFootprint.depth / 2;
    const itemBack = itemFootprint.z + itemFootprint.depth / 2;
    const stackLeft = stackFootprint.x - stackFootprint.width / 2;
    const stackRight = stackFootprint.x + stackFootprint.width / 2;
    const stackFront = stackFootprint.z - stackFootprint.depth / 2;
    const stackBack = stackFootprint.z + stackFootprint.depth / 2;

    const xOverlap = !(itemRight <= stackLeft + gap || itemLeft >= stackRight - gap);
    const zOverlap = !(itemBack <= stackFront + gap || itemFront >= stackBack - gap);
    return xOverlap && zOverlap;
}

function circleRectOverlap(circleFootprint, rectFootprint, gap) {
    const radius = circleFootprint.width / 2;
    const rectLeft = rectFootprint.x - rectFootprint.width / 2;
    const rectRight = rectFootprint.x + rectFootprint.width / 2;
    const rectFront = rectFootprint.z - rectFootprint.depth / 2;
    const rectBack = rectFootprint.z + rectFootprint.depth / 2;
    const closestX = Math.max(rectLeft, Math.min(circleFootprint.x, rectRight));
    const closestZ = Math.max(rectFront, Math.min(circleFootprint.z, rectBack));
    const deltaX = circleFootprint.x - closestX;
    const deltaZ = circleFootprint.z - closestZ;
    const minimumDistance = radius + gap;

    return (deltaX * deltaX + deltaZ * deltaZ) < (minimumDistance * minimumDistance) - 1e-6;
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
    const boundaryState = getClientBoundaryState(x, z, itemWidth, itemDepth, clientBlock);
    if (!boundaryState.hasBoundaryOverlap) {
        return true;
    }

    return boundaryState.itemRight <= boundaryState.allowedRightEdge + 1e-6;
}

function getClientBoundaryState(x, z, itemWidth, itemDepth, clientBlock) {
    if (!Array.isArray(clientBlock.boundaryStacks) || clientBlock.boundaryStacks.length === 0) {
        return {
            itemRight: x + itemWidth / 2,
            hasBoundaryOverlap: false,
            allowedRightEdge: clientBlock.startX + GAP_STACK
        };
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
        return {
            itemRight,
            hasBoundaryOverlap: false,
            allowedRightEdge
        };
    }

    return {
        itemRight,
        hasBoundaryOverlap: true,
        allowedRightEdge
    };
}

function isPositionConnectedToClientStacks(x, z, itemWidth, itemDepth, clientBlock, itemShape = 'box') {
    if (!Array.isArray(clientBlock.stacks) || clientBlock.stacks.length === 0) {
        return isPositionConnectedToBoundaryFrontier(x, z, itemWidth, itemDepth, clientBlock);
    }

    const touchesOwnStacks = clientBlock.stacks.some((stack) => {
        const contact = getStackContactMetrics(x, z, itemWidth, itemDepth, stack, itemShape);
        return contact.touchesInX || contact.touchesInZ || contact.touchesDiagonally;
    });

    if (touchesOwnStacks) {
        return true;
    }

    return isPositionConnectedToBoundaryFrontier(x, z, itemWidth, itemDepth, clientBlock);
}

function isPositionConnectedToBoundaryFrontier(x, z, itemWidth, itemDepth, clientBlock) {
    const boundaryState = getClientBoundaryState(x, z, itemWidth, itemDepth, clientBlock);
    if (!boundaryState.hasBoundaryOverlap) {
        // Se não há nenhum stack do cliente anterior nessa faixa lateral,
        // a faixa é limpa e pode iniciar um novo bloco do mesmo cliente.
        return true;
    }

    const tolerance = GAP_STACK + 1e-6;
    return Math.abs(boundaryState.itemRight - boundaryState.allowedRightEdge) <= tolerance;
}

function getStackContactMetrics(x, z, itemWidth, itemDepth, stack, itemShape = 'box') {
    const itemIsCircle = isCircularFootprint(itemShape, itemWidth, itemDepth);
    const stackIsCircle = isCircularFootprint(stack.shape, stack.baseWidth, stack.baseDepth);

    if (itemIsCircle && stackIsCircle) {
        const targetDistance = itemWidth / 2 + stack.baseWidth / 2 + GAP_STACK;
        const deltaX = x - stack.x;
        const deltaZ = z - stack.z;
        const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
        const tolerance = Math.max(GAP_STACK * 2, 0.01);
        return {
            touchesInX: false,
            touchesInZ: false,
            touchesDiagonally: Math.abs(distance - targetDistance) <= tolerance
        };
    }

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

    return { touchesInX, touchesInZ, touchesDiagonally: false };
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

function isValidPosition(x, z, itemWidth, itemDepth, clientBlock, gap, baseY = FLOOR_Y, itemHeight = 0, itemShape = 'box') {
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
        
        const overlaps = footprintsOverlap(
            { x, z, width: itemWidth, depth: itemDepth, shape: itemShape },
            { x: stack.x, z: stack.z, width: stack.baseWidth, depth: stack.baseDepth, shape: stack.shape },
            gap
        );

        if (overlaps) {
            return false;
        }
    }
    
    return true;
}

function createStackAtPosition(product, position, orientation, clientBlock, baseY = FLOOR_Y) {
    const stack = new Stack(
        product.clientKey,
        position.x,
        position.z,
        orientation.width,
        orientation.depth,
        baseY,
        product.shape || 'box'
    );
    
    // Adicionar às estruturas
    stacks.push(stack);
    
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
        renderDimensions: Array.isArray(product.renderDimensions) ? [...product.renderDimensions] : [...product.dimensions],
        color: product.color,
        clientKey: product.clientKey,
        clientName: product.clientName,
        type: product.shape || 'box',
        shape: product.shape || 'box',
        weight: 1,
        footprint: product.dimensions[0] * product.dimensions[2],
        volume: product.dimensions[0] * product.dimensions[1] * product.dimensions[2],
        stackable: true,
        fragile: false
    };
}
