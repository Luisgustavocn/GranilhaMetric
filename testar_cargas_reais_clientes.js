// Teste completo com cargas reais dos clientes
const http = require('http');

let cookies = '';

function fazerRequisicao(method, path, data) {
    return new Promise((resolve, reject) => {
        let postData = '';
        if (data && method !== 'GET') {
            postData = JSON.stringify(data);
        }
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {}
        };

        if (method !== 'GET' && postData) {
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        if (cookies) {
            options.headers.Cookie = cookies;
        }

        const req = http.request(options, (res) => {
            let body = '';
            
            if (res.headers['set-cookie']) {
                cookies = res.headers['set-cookie'][0].split(';')[0];
            }
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body: body });
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

// Mapeamento de IDs baseado nos nomes das embalagens
const EMBALAGEM_IDS = {
    'balde 25kg': 52,
    'galao 3.6lt': 51,
    'container': 54,
    'balde 18l': 50,
    'barrica 25kg': 53,
    'galao 3.2lt': 49,
    'tambor 200lt': 58,
    'lata 18lt': 57,
    'quarto 900ml': 48,
    'solvente 5lt': 59,
    'frasco aerosol225/180ml': 47,
    'massa poliester': 46,
    'lata solvente 900ml': 45,
    'balde plastico 18lt': 44
};

// Cargas reais dos clientes
const CARGAS_CLIENTES = {
    'CASA DAS TINTAS': [
        { name: 'balde 25kg', quantity: 460 },
        { name: 'galao 3.6lt', quantity: 20 },
        { name: 'container', quantity: 2 }
    ],
    'ALIANÇA TINTAS': [
        { name: 'balde 18l', quantity: 12 }
    ],
    'T SANTOS': [
        { name: 'balde 18l', quantity: 84 },
        { name: 'balde 25kg', quantity: 120 },
        { name: 'barrica 25kg', quantity: 220 },
        { name: 'galao 3.6lt', quantity: 40 },
        { name: 'galao 3.2lt', quantity: 50 },
        { name: 'tambor 200lt', quantity: 1 },
        { name: 'lata 18lt', quantity: 29 },
        { name: 'quarto 900ml', quantity: 36 },
        { name: 'solvente 5lt', quantity: 16 },
        { name: 'frasco aerosol225/180ml', quantity: 9 },
        { name: 'massa poliester', quantity: 4 },
        { name: 'lata solvente 900ml', quantity: 5 }
    ],
    'M MAX': [
        { name: 'galao 3.2lt', quantity: 38 },
        { name: 'lata 18lt', quantity: 70 },
        { name: 'quarto 900ml', quantity: 14 },
        { name: 'solvente 5lt', quantity: 20 },
        { name: 'frasco aerosol225/180ml', quantity: 12 },
        { name: 'lata solvente 900ml', quantity: 20 }
    ],
    'TECNOPARTES': [
        { name: 'galao 3.2lt', quantity: 34 },
        { name: 'lata 18lt', quantity: 7 },
        { name: 'quarto 900ml', quantity: 13 },
        { name: 'solvente 5lt', quantity: 10 },
        { name: 'lata solvente 900ml', quantity: 6 },
        { name: 'balde plastico 18lt', quantity: 5 }
    ],
    'ALIANÇA': [
        { name: 'galao 3.2lt', quantity: 10 },
        { name: 'tambor 200lt', quantity: 9 },
        { name: 'lata 18lt', quantity: 95 },
        { name: 'solvente 5lt', quantity: 5 }
    ],
    'MERCADAO': [
        { name: 'galao 3.2lt', quantity: 31 },
        { name: 'lata 18lt', quantity: 20 },
        { name: 'quarto 900ml', quantity: 19 },
        { name: 'solvente 5lt', quantity: 7 },
        { name: 'frasco aerosol225/180ml', quantity: 3 },
        { name: 'lata solvente 900ml', quantity: 19 }
    ],
    'FG SANTOS': [
        { name: 'galao 3.2lt', quantity: 4 }
    ]
};

async function testeCargasReais() {
    console.log('🚛 TESTE COM CARGAS REAIS DOS CLIENTES');
    console.log('=' .repeat(100));
    
    try {
        // Login
        console.log('🔐 Fazendo login...');
        const loginResponse = await fazerRequisicao('POST', '/api/login', {
            email: 'admin@granilha.local',
            password: 'admin123'
        });
        
        if (loginResponse.statusCode !== 200) {
            console.error('❌ Falha no login');
            return;
        }
        
        console.log('✅ Login realizado com sucesso\n');
        
        let totalGeral = 0;
        let volumeTotalGeral = 0;
        
        // Testar cada cliente
        for (const [cliente, itens] of Object.entries(CARGAS_CLIENTES)) {
            console.log(`🏢 CLIENTE: ${cliente}`);
            console.log('─'.repeat(60));
            
            // Converter para formato da API
            const cargaAPI = itens.map(item => ({
                canId: EMBALAGEM_IDS[item.name],
                quantity: item.quantity
            }));
            
            console.log('📦 Itens do pedido:');
            itens.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.name}: ${item.quantity} unidades`);
            });
            
            // Calcular empacotamento 3D
            const packingResponse = await fazerRequisicao('POST', '/api/packing-3d', {
                items: cargaAPI,
                truckDimensions: {
                    length_cm: 1450,
                    width_cm: 245,
                    height_cm: 170
                }
            });
            
            if (packingResponse.statusCode !== 200) {
                console.log(`❌ Erro no empacotamento: ${packingResponse.body}`);
                continue;
            }
            
            const packingData = JSON.parse(packingResponse.body);
            const result = packingData.packingResult;
            
            console.log('\n📊 RESULTADOS DO EMPACOTAMENTO:');
            console.log(`📦 Estratégia: ${result.strategy}`);
            console.log(`📊 Total de Itens: ${result.totalPackedItems}`);
            console.log(`📐 Volume Total: ${(result.totalBoundingBoxVolume/1000000).toFixed(3)} m³`);
            console.log(`📐 Volume Real: ${(result.totalRealVolume/1000000).toFixed(3)} m³`);
            console.log(`📈 Ocupação: ${result.usedVolumePercentage.toFixed(1)}%`);
            console.log(`🔄 Taxa de Rotação: ${result.rotationStats.rotationRate}`);
            
            // Calcular blocos renderizados
            console.log('\n🎨 BLOCOS RENDERIZADOS:');
            const blocosInfo = {};
            
            // Agrupar para mostrar blocos
            itens.forEach(item => {
                let itemsPerBlock = 1;
                if (item.name.includes('balde')) {
                    itemsPerBlock = item.name.includes('25kg') ? 4 : 4;
                } else if (item.name.includes('galao')) {
                    itemsPerBlock = 6;
                } else if (item.name.includes('lata')) {
                    itemsPerBlock = 8;
                } else if (item.name.includes('barrica')) {
                    itemsPerBlock = 3;
                } else if (item.name.includes('tambor')) {
                    itemsPerBlock = 2;
                } else if (item.name.includes('container')) {
                    itemsPerBlock = 2;
                } else if (item.name.includes('quarto')) {
                    itemsPerBlock = 10;
                } else if (item.name.includes('frasco')) {
                    itemsPerBlock = 12;
                } else if (item.name.includes('massa')) {
                    itemsPerBlock = 2;
                } else if (item.name.includes('plastico')) {
                    itemsPerBlock = 4;
                }
                
                const estimatedBlocks = Math.ceil(item.quantity / itemsPerBlock);
                blocosInfo[item.name] = {
                    quantidade: item.quantity,
                    blocos: estimatedBlocks,
                    itensPorBloco: itemsPerBlock
                };
                
                console.log(`   📦 ${item.name}: ${estimatedBlocks} blocos (${item.quantity} itens, ${itemsPerBlock}/bloco)`);
            });
            
            // Análise logística
            const ocupacao = result.usedVolumePercentage;
            console.log('\n🚛 ANÁLISE LOGÍSTICA:');
            console.log(`📈 Ocupação: ${ocupacao.toFixed(1)}%`);
            
            if (ocupacao <= 60) {
                console.log('✅ Nível Risco: BAIXO - Carga confortável');
            } else if (ocupacao <= 80) {
                console.log('⚠️ Nível Risco: MÉDIO - Ocupação elevada');
            } else if (ocupacao <= 95) {
                console.log('🔴 Nível Risco: ALTO - Caminhão lotado');
            } else {
                console.log('🚨 Nível Risco: CRÍTICO - Excede capacidade');
            }
            
            // Calcular caminhões necessários
            const caminhoesNecessarios = Math.ceil(ocupacao / 85); // 85% capacidade real
            console.log(`🚚 Caminhões Necessários: ${caminhoesNecessarios}`);
            
            totalGeral += result.totalPackedItems;
            volumeTotalGeral += result.totalRealVolume;
            
            console.log('\n' + '=' .repeat(60) + '\n');
        }
        
        // Resumo geral
        console.log('📊 RESUMO GERAL DE TODAS AS CARGAS');
        console.log('=' .repeat(60));
        console.log(`📦 Total de Itens: ${totalGeral}`);
        console.log(`📐 Volume Total: ${(volumeTotalGeral/1000000).toFixed(3)} m³`);
        console.log(`🚛 Capacidade Caminhão: 60.39 m³`);
        console.log(`📈 Ocupação Média Geral: ${((volumeTotalGeral/1000000) / 60.39 * 100).toFixed(1)}%`);
        
        const caminhoesTotais = Math.ceil((volumeTotalGeral/1000000) / 51.33); // 85% capacidade real
        console.log(`🚚 Caminhões para Todas as Cargas: ${caminhoesTotais}`);
        
        console.log('\n' + '=' .repeat(100));
        console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
        console.log('🌐 Acesse: http://localhost:3000');
        console.log('📦 Adicione as cargas dos clientes e clique em "Mostrar 3D"');
        console.log('🎨 Visualize os blocos renderizados para cada tipo de embalagem');
        console.log('=' .repeat(100));
        
    } catch (error) {
        console.error('❌ Erro durante o teste:', error.message);
    }
}

// Executar teste
testeCargasReais();
