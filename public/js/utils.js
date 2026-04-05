// ========================================================================
// UTILITÁRIOS E FUNÇÕES AUXILIARES
// ========================================================================

// Constantes do caminhão
const TRUCK_DIMENSIONS = {
    length: 13.6,
    width: 2.45,
    height: 2.50
};

// Constantes
const GAP_STACK = 0.01;
const GAP_CLIENTE = 0.05;
const MIN_Z_EDGE = -TRUCK_DIMENSIONS.width / 2 + GAP_STACK;
const MAX_Z_EDGE = TRUCK_DIMENSIONS.width / 2 - GAP_STACK;
const MIN_X_LIMIT = -TRUCK_DIMENSIONS.length / 2 + GAP_STACK;
const FLOOR_Y = 0.1;
const REAR_START_X = TRUCK_DIMENSIONS.length / 2 - GAP_STACK;

// Funções de cor
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
    const hue = (hash * 137.508) % 360;
    const saturation = 62 + (hash % 14);
    const lightness = 50 + ((Math.floor(hash / 7)) % 10);
    return hslToHex(hue, saturation, lightness);
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
