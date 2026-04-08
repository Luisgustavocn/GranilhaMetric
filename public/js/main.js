// ========================================================================
// FUNÇÕES PRINCIPAIS
// ========================================================================

// Inicialização principal
function init() {
    // Carregar dados do localStorage se existir
    loadOrderPreviewData();
    
    // Inicializar UI
    populateClientSelect();
    applyOrderPreviewHeader();
    
    // Inicializar cena Three.js
    initScene();
    
    // Auto-render se houver dados
    if (ORDER_PREVIEW_DATA) {
        const select = document.getElementById('client-select');
        if (select) select.value = 'all';
        renderCargo();
    }
}

// Carregar dados do preview
function loadOrderPreviewData() {
    try {
        const ORDER_PREVIEW_STORAGE_KEY = 'granilha_metric_order_3d_preview';
        const raw = window.localStorage.getItem(ORDER_PREVIEW_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.clients || typeof parsed.clients !== 'object') {
            return null;
        }
        
        ORDER_PREVIEW_DATA = parsed;
        if (ORDER_PREVIEW_DATA && ORDER_PREVIEW_DATA.clients) {
            CLIENT_DATA = ORDER_PREVIEW_DATA.clients;
        }
        return parsed;
    } catch (_error) {
        return null;
    }
}

// Exportar funções para uso global
window.renderCargo = renderCargo;
window.resetView = resetView;
window.init = init;

// Inicializar quando carregar a página
window.addEventListener('load', init);
