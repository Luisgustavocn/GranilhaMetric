// ========================================================================
// DADOS DOS CLIENTES
// ========================================================================

const DEFAULT_CLIENT_DATA = {
    'casa-tintas': {
        name: 'Casa das Tintas',
        items: [
            { name: 'Container', dimensions: [1.15, 1.16, 1.15], color: 0x88d8b0, quantity: 2 },
            { name: 'Balde 25kg', dimensions: [0.32, 0.31, 0.32], color: 0xff6b6b, quantity: 460 },
            { name: 'Galão 3.6L', dimensions: [0.20, 0.20, 0.20], color: 0x45b7d1, quantity: 20 }
        ]
    },
    'alianca-tintas': {
        name: 'Aliança Tintas',
        items: [
            { name: 'Balde 25kg', dimensions: [0.32, 0.31, 0.32], color: 0xff6b6b, quantity: 40 },
            { name: 'Galão 3.6L', dimensions: [0.20, 0.20, 0.20], color: 0x45b7d1, quantity: 10 }
        ]
    },
    'mercadao': {
        name: 'Mercadão',
        items: [
            { name: 'Galão 3.2L', dimensions: [0.19, 0.22, 0.19], color: 0x96ceb4, quantity: 31 },
            { name: 'Lata 18LT', dimensions: [0.16, 0.18, 0.16], color: 0xa8e6cf, quantity: 20 },
            { name: 'Quarto 900ML', dimensions: [0.10, 0.12, 0.10], color: 0xf7dc6f, quantity: 19 }
        ]
    }
};

// Cliente atual
let CLIENT_DATA = DEFAULT_CLIENT_DATA;
let ORDER_PREVIEW_DATA = null;
