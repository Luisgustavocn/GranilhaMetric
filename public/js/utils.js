// ========================================================================
// UTILITÁRIOS E FUNÇÕES AUXILIARES
// ========================================================================

// Constantes do caminhão
const TRUCK_DIMENSIONS = {
    length: 14.5,
    width: 2.45,
    height: 1.70
};

// Constantes
const GAP_STACK = 0.01;
const GAP_CLIENTE = 0.05;
const MIN_Z_EDGE = -TRUCK_DIMENSIONS.width / 2 + GAP_STACK;
const MAX_Z_EDGE = TRUCK_DIMENSIONS.width / 2 - GAP_STACK;
const MIN_X_LIMIT = -TRUCK_DIMENSIONS.length / 2 + GAP_STACK;
const FLOOR_Y = 0.01;
const TOP_CLEARANCE = 0.01;
const REAR_START_X = TRUCK_DIMENSIONS.length / 2 - GAP_STACK;

// Exportar constantes para uso global
window.TRUCK_DIMENSIONS = TRUCK_DIMENSIONS;
window.GAP_STACK = GAP_STACK;
window.GAP_CLIENTE = GAP_CLIENTE;
window.MIN_Z_EDGE = MIN_Z_EDGE;
window.MAX_Z_EDGE = MAX_Z_EDGE;
window.MIN_X_LIMIT = MIN_X_LIMIT;
window.FLOOR_Y = FLOOR_Y;
window.TOP_CLEARANCE = TOP_CLEARANCE;
window.REAR_START_X = REAR_START_X;

function normalizeDimensions(dimensions) {
    if (!Array.isArray(dimensions) || dimensions.length < 3) return dimensions;

    const numbers = dimensions.slice(0, 3).map((value) => Number(value));
    if (numbers.some((value) => !Number.isFinite(value) || value <= 0)) return dimensions;

    const maxDim = Math.max(...numbers);

    // Heurística:
    // - > 50  => mm (ex: 320, 220, 900)
    // - > 5   => cm (ex: 32, 22, 90)
    // - <= 5  => já está em metros (ex: 0.32, 0.22, 0.90)
    if (maxDim > 50) {
        return numbers.map((value) => value / 1000);
    }

    if (maxDim > 5) {
        return numbers.map((value) => value / 100);
    }

    return numbers;
}

window.normalizeDimensions = normalizeDimensions;

// Funções de cor
const CLIENT_COLOR_PALETTE = [
    0xe76f51,
    0x2a9d8f,
    0xe9c46a,
    0x264653,
    0xf4a261,
    0x457b9d,
    0x8d99ae,
    0xef476f,
    0x06d6a0,
    0x118ab2,
    0xbc6c25,
    0x6a4c93
];

function hashOrderKey(orderKey) {
    const normalizedKey = String(orderKey || 'pedido');
    let hash = 0;
    for (let index = 0; index < normalizedKey.length; index++) {
        const char = normalizedKey.charCodeAt(index);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function hslToHex(h, s, l) {
    const hue = ((h % 360) + 360) % 360 / 360;
    const saturation = Math.max(0, Math.min(1, s / 100));
    const lightness = Math.max(0, Math.min(1, l / 100));

    let r, g, b;

    if (saturation === 0) {
        r = g = b = lightness;
    } else {
        const q = lightness < 0.5
            ? lightness * (1 + saturation)
            : lightness + saturation - lightness * saturation;
        const p = 2 * lightness - q;

        function hueToRgb(t) {
            let value = t;
            if (value < 0) value += 1;
            if (value > 1) value -= 1;
            if (value < 1/6) return p + (q - p) * 6 * value;
            if (value < 1/2) return q;
            if (value < 2/3) return p + (q - p) * (2/3 - value) * 6;
            return p;
        }

        r = hueToRgb(hue + 1/3);
        g = hueToRgb(hue);
        b = hueToRgb(hue - 1/3);
    }

    return (r << 16) | (g << 8) | b;
}

function getOrderColor(orderKey) {
    const hash = hashOrderKey(orderKey);
    return CLIENT_COLOR_PALETTE[hash % CLIENT_COLOR_PALETTE.length];
}

// Funções de UI
function populateClientSelect() {
    const select = document.getElementById('client-select');
    if (!select) return;

    const options = ['<option value="">Selecione um cliente</option>'];
    options.push(`<option value="all">Todos os Clientes</option>`);
    
    Object.entries(CLIENT_DATA).forEach(([key, client]) => {
        options.push(`<option value="${key}">${client.name}</option>`);
    });

    select.innerHTML = options.join('');
}

function applyOrderPreviewHeader() {
    if (!ORDER_PREVIEW_DATA) return;
    const subtitle = document.getElementById('page-subtitle');
    if (subtitle) {
        subtitle.textContent = `Visualização 3D - ${ORDER_PREVIEW_DATA.orderNumber || 'Pedido'}`;
    }
}

function showLoading(show) {
    isLoading = show;
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
    }
}

function showInfoPanel(clientData, placedCount, totalRequestedItems, layerStats, mode) {
    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');
    
    if (!infoPanel || !infoContent) return;
    
    const itemSummary = {};
    
    if (clientData.items) {
        clientData.items.forEach((item) => {
            itemSummary[item.name] = (itemSummary[item.name] || 0) + item.quantity;
        });
    }
    
    let html = `
        <div class="info-item">
            <span class="info-label">Cliente:</span>
            <span class="info-value">${clientData.name}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Modo:</span>
            <span class="info-value">${mode === 'multi' ? 'Múltiplos Clientes' : 'Cliente Único'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Itens Carregados:</span>
            <span class="info-value">${placedCount}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Itens Solicitados:</span>
            <span class="info-value">${totalRequestedItems}</span>
        </div>
    `;
    
    Object.entries(itemSummary).forEach(([name, quantity]) => {
        html += `
            <div class="info-item">
                <span class="info-label">${name}:</span>
                <span class="info-value">${quantity}</span>
            </div>
        `;
    });
    
    infoContent.innerHTML = html;
    infoPanel.style.display = 'block';
}

function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

function getClientDataForSelection(clientKey) {
    if (clientKey === 'all') {
        return {
            name: 'Todos os Clientes',
            items: Object.values(CLIENT_DATA).flatMap(client => client.items)
        };
    }
    return CLIENT_DATA[clientKey];
}
