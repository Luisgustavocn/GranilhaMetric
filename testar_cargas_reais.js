// Script de teste para cálculo 3D com dados reais de tintas
// Dimensões atualizadas: Caminhão 14.5x2.45x1.70m, Container 1.15x1.15x1.16m

const http = require('http');

// Dados das embalagens com dimensões reais calculadas
const embalagens = [
    {
        name: 'Balde 18L',
        shape: 'cylinder',
        diameter_cm: 31.8,  // circunf=100cm → diâmetro=100/π
        height_cm: 35,
        volume_cm3: 18000
    },
    {
        name: 'Galão 3.6L',
        shape: 'cylinder', 
        diameter_cm: 19.7,  // circunf=62cm → diâmetro=62/π
        height_cm: 20,
        volume_cm3: 3600
    },
    {
        name: 'Balde 25kg',
        shape: 'cylinder',
        diameter_cm: 31.8,  // circunf=100cm → diâmetro=100/π
        height_cm: 31,
        volume_cm3: 25000
    },
    {
        name: 'Barrica 25kg',
        shape: 'cylinder',
        diameter_cm: 28.3,  // circunf=89cm → diâmetro=89/π
        height_cm: 30,
        volume_cm3: 25000
    },
    {
        name: 'Container',
        shape: 'container',
        length_cm: 115,    // 1.15m
        width_cm: 115,     // 1.15m  
        height_cm: 116,    // 1.16m
        volume_cm3: 1537400 // 1.15 * 1.15 * 1.16 = 1.5374m³
    },
    {
        name: 'Tambor 200L',
        shape: 'cylinder',
        diameter_cm: 58,
        height_cm: 75,
        volume_cm3: 200000
    },
    {
        name: 'Lata 18L',
        shape: 'cylinder',
        diameter_cm: 30,
        height_cm: 25,
        volume_cm3: 18000
    },
    {
        name: 'Quarto 900ML',
        shape: 'cylinder',
        diameter_cm: 10,
        height_cm: 12,
        volume_cm3: 900
    },
    {
        name: 'Solvente 5L',
        shape: 'square',
        length_cm: 37,
        width_cm: 22,
        height_cm: 29,
        volume_cm3: 23626  // 37 × 22 × 29
    },
    {
        name: 'Frasco Aerosol 225/180ML',
        shape: 'cylinder',
        diameter_cm: 6,
        height_cm: 15,
        volume_cm3: 225
    },
    {
        name: 'Lata Solvente 900ML',
        shape: 'square',
        length_cm: 34.5,
        width_cm: 26.5,
        height_cm: 19,
        volume_cm3: 17371.75  // 34.5 × 26.5 × 19
    },
    {
        name: 'Balde Plastico 18L',
        shape: 'cylinder',
        diameter_cm: 31.8,
        height_cm: 35,
        volume_cm3: 18000
    }
];

// Cargas reais para teste
const cargas = [
    {
        cliente: 'Casa das Tintas',
        itens: [
            { tipo: 'Balde 25kg', quantidade: 460 },
            { tipo: 'Galão 3.6L', quantidade: 20 },
            { tipo: 'Container', quantidade: 2 }
        ]
    },
    {
        cliente: 'Aliança Tintas',
        itens: [
            { tipo: 'Balde 18L', quantidade: 12 }
        ]
    },
    {
        cliente: 'T Santos',
        itens: [
            { tipo: 'Balde 18L', quantidade: 84 },
            { tipo: 'Balde 25kg', quantidade: 120 },
            { tipo: 'Barrica 25kg', quantidade: 220 },
            { tipo: 'Galão 3.6L', quantidade: 40 }
        ]
    },
    {
        cliente: 'T Santos - Solvente',
        itens: [
            { tipo: 'Galão 3.2L', quantidade: 50 },
            { tipo: 'Tambor 200L', quantidade: 1 },
            { tipo: 'Lata 18L', quantidade: 29 },
            { tipo: 'Quarto 900ML', quantidade: 36 },
            { tipo: 'Solvente 5L', quantidade: 16 },
            { tipo: 'Frasco Aerosol 225/180ML', quantidade: 9 },
            { tipo: 'Lata Solvente 900ML', quantidade: 5 }
        ]
    },
    {
        cliente: 'M Max',
        itens: [
            { tipo: 'Galão 3.2L', quantidade: 38 },
            { tipo: 'Lata 18L', quantidade: 70 },
            { tipo: 'Quarto 900ML', quantidade: 14 },
            { tipo: 'Solvente 5L', quantidade: 20 },
            { tipo: 'Frasco Aerosol 225/180ML', quantidade: 12 },
            { tipo: 'Lata Solvente 900ML', quantidade: 20 }
        ]
    }
];

// Dimensões reais do caminhão
const caminhao = {
    length_cm: 1450,  // 14.5m
    width_cm: 245,    // 2.45m
    height_cm: 170    // 1.70m
};

const caminhaoCapacity = caminhao.length_cm * caminhao.width_cm * caminhao.height_cm;

function calcularVolume3D(embalagem, quantidade) {
    if (embalagem.shape === 'cylinder') {
        return embalagem.diameter_cm * embalagem.diameter_cm * embalagem.height_cm * quantidade;
    } else if (embalagem.shape === 'container') {
        return embalagem.length_cm * embalagem.width_cm * embalagem.height_cm * quantidade;
    } else {
        return embalagem.length_cm * embalagem.width_cm * embalagem.height_cm * quantidade;
    }
}

function testarCalculo3D() {
    console.log('🎯 Testando Sistema 3D com Dimensões Reais');
    console.log('🚚 Caminhão: 14.5m × 2.45m × 1.70m = ' + (caminhaoCapacity/1000000).toFixed(2) + 'm³\n');
    
    for (const carga of cargas) {
        console.log(`📦 Cliente: ${carga.cliente}`);
        console.log(`   Itens: ${carga.itens.length} tipos diferentes`);
        
        let volumeTotal = 0;
        let volumeEfetivo = 0;
        
        for (const item of carga.itens) {
            const embalagem = embalagens.find(e => e.name.includes(item.tipo) || item.tipo.includes(e.name));
            
            if (embalagem) {
                const itemVolume = embalagem.volume_cm3 * item.quantidade;
                const itemEfetivo = calcularVolume3D(embalagem, item.quantidade);
                
                volumeTotal += itemVolume;
                volumeEfetivo += itemEfetivo;
                
                console.log(`   • ${embalagem.name}: ${item.quantidade}un | Vol: ${(itemVolume/1000000).toFixed(3)}m³ | Efetivo: ${(itemEfetivo/1000000).toFixed(3)}m³`);
            } else {
                console.log(`   ⚠️  ${item.tipo}: ${item.quantidade}un (embalagem não encontrada)`);
            }
        }
        
        const eficiencia = volumeTotal > 0 ? volumeTotal / volumeEfetivo : 1;
        const ocupacao = (volumeEfetivo / caminhaoCapacity) * 100;
        
        console.log(`   📊 Volume Total: ${(volumeTotal/1000000).toFixed(3)}m³`);
        console.log(`   📊 Volume Efetivo 3D: ${(volumeEfetivo/1000000).toFixed(3)}m³`);
        console.log(`   📊 Eficiência: ${(eficiencia*100).toFixed(1)}%`);
        console.log(`   📊 Ocupação Caminhão: ${ocupacao.toFixed(1)}%`);
        console.log(`   🚚 Precisa de caminhão: ${ocupacao > 100 ? 'SIM - Múltiplos' : ocupacao > 85 ? 'SIM - Apertado' : 'NÃO - Folga'}`);
        console.log('');
    }
}

// Executar teste
testarCalculo3D();
