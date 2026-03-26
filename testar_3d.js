// Script de teste para cálculo 3D com dados reais de tintas

const http = require('http');
const { DatabaseSync } = require('node:sqlite');

// Dados das embalagens com dimensões calculadas
const embalagens = [
    {
        name: 'Balde 18L',
        shape: 'cylinder',
        diameter_cm: 31.8,
        height_cm: 35,
        volume_cm3: 18000
    },
    {
        name: 'Galão 3.6L',
        shape: 'cylinder',
        diameter_cm: 19.7,
        height_cm: 20,
        volume_cm3: 3600
    },
    {
        name: 'Balde 25kg',
        shape: 'cylinder',
        diameter_cm: 31.8,
        height_cm: 31,
        volume_cm3: 25000
    },
    {
        name: 'Barrica 25kg',
        shape: 'cylinder',
        diameter_cm: 28.3,
        height_cm: 30,
        volume_cm3: 25000
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
        shape: 'cylinder',
        diameter_cm: 16,
        height_cm: 25,
        volume_cm3: 5000
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
        shape: 'cylinder',
        diameter_cm: 10,
        height_cm: 12,
        volume_cm3: 900
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
    }
];

async function testarCalculo3D() {
    console.log('🎯 Testando Sistema de Cálculo 3D com Dados Reais\n');
    
    try {
        // Testar cada carga
        for (const carga of cargas) {
            console.log(`📦 Cliente: ${carga.cliente}`);
            console.log(`   Itens: ${carga.itens.length} tipos diferentes`);
            
            let volumeTotal = 0;
            let volumeEfetivo = 0;
            
            for (const item of carga.itens) {
                const embalagem = embalagens.find(e => e.name === item.tipo);
                if (embalagem) {
                    const itemVolume = embalagem.volume_cm3 * item.quantidade;
                    const itemEfetivo = embalagem.diameter_cm * embalagem.diameter_cm * embalagem.height_cm * item.quantidade;
                    
                    volumeTotal += itemVolume;
                    volumeEfetivo += itemEfetivo;
                    
                    console.log(`   • ${item.tipo}: ${item.quantidade}un | Vol: ${(itemVolume/1000000).toFixed(2)}m³ | Efetivo: ${(itemEfetivo/1000000).toFixed(2)}m³`);
                } else {
                    console.log(`   ⚠️  ${item.tipo}: ${item.quantidade}un (embalagem não cadastrada)`);
                }
            }
            
            const eficiencia = volumeTotal / volumeEfetivo;
            console.log(`   📊 Volume Total: ${(volumeTotal/1000000).toFixed(2)}m³`);
            console.log(`   📊 Volume Efetivo: ${(volumeEfetivo/1000000).toFixed(2)}m³`);
            console.log(`   📊 Eficiência: ${(eficiencia*100).toFixed(1)}%`);
            console.log(`   🚚 Precisa de caminhão: ${volumeEfetivo > 56840000 ? 'SIM' : 'NÃO'} (56.84m³ padrão)\n`);
        }
        
    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
    }
}

// Executar teste
testarCalculo3D();
