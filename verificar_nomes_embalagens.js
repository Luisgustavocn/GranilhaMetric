// Teste para verificar correspondência de nomes e tamanhos
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

async function verificarNomesEmbalagens() {
    console.log('🔍 VERIFICANDO NOMES DAS EMBALAGENS');
    console.log('=' .repeat(50));
    
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
        
        // Obter lista de latas/embalagens
        console.log('📦 Obtendo lista de embalagens...');
        const cansResponse = await fazerRequisicao('GET', '/api/cans');
        
        if (cansResponse.statusCode !== 200) {
            console.error('❌ Erro ao obter embalagens');
            return;
        }
        
        const cans = JSON.parse(cansResponse.body);
        
        console.log('\n📋 EMBALAGENS DISPONÍVEIS:');
        console.log('=' .repeat(50));
        
        // Verificar se cans é um array
        if (!Array.isArray(cans)) {
            console.log('❌ Resposta não é um array:', typeof cans);
            console.log('Resposta:', cans);
            return;
        }
        
        cans.forEach((can, index) => {
            console.log(`${index + 1}. ID: ${can.id} - Nome: "${can.name}"`);
        });
        
        console.log('\n🎯 VERIFICANDO CORRESPONDÊNCIA:');
        console.log('=' .repeat(50));
        
        // Tamanhos esperados
        const tamanhosEsperados = {
            'balde 25kg': 0.31,
            'balde 18l': 0.35,
            'galao 3.6lt': 0.20,
            'galao 3.2lt': 0.18,
            'lata 18lt': 0.25,
            'barrica 25kg': 0.30,
            'tambor 200lt': 0.85,
            'container': 1.20,
            'quarto 900ml': 0.12,
            'frasco aerosol225/180ml': 0.15,
            'massa poliester': 0.20,
            'lata solvente 900ml': 0.15,
            'solvente 5lt': 0.18,
            'balde plastico 18lt': 0.35
        };
        
        // Verificar cada embalagem
        cans.forEach(can => {
            const nomeNormalizado = can.name.toLowerCase().trim();
            let encontrado = false;
            let tamanhoEsperado = null;
            
            // Verificar correspondência exata
            if (tamanhosEsperados[nomeNormalizado]) {
                encontrado = true;
                tamanhoEsperado = tamanhosEsperados[nomeNormalizado];
            }
            
            // Verificar correspondência parcial
            if (!encontrado) {
                Object.keys(tamanhosEsperados).forEach(chave => {
                    if (nomeNormalizado.includes(chave) || chave.includes(nomeNormalizado)) {
                        encontrado = true;
                        tamanhoEsperado = tamanhosEsperados[chave];
                    }
                });
            }
            
            if (encontrado) {
                console.log(`✅ "${can.name}" -> Tamanho: ${tamanhoEsperado}m`);
            } else {
                console.log(`❌ "${can.name}" -> NÃO RECONHECIDO`);
            }
        });
        
        console.log('\n🧪 TESTANDO COM CARGA SIMPLES:');
        console.log('=' .repeat(50));
        
        // Testar com uma carga simples incluindo container
        const cargaTeste = [
            { canId: 54, quantity: 2 },  // container
            { canId: 52, quantity: 4 },  // balde 25kg
            { canId: 58, quantity: 1 },  // tambor 200lt
        ];
        
        console.log('Carga de teste:');
        cargaTeste.forEach((item, index) => {
            const can = cans.find(c => c.id === item.canId);
            console.log(`  ${index + 1}. ${can ? can.name : 'ID ' + item.canId}: ${item.quantity} unidades`);
        });
        
        const packingResponse = await fazerRequisicao('POST', '/api/packing-3d', {
            items: cargaTeste,
            truckDimensions: {
                length_cm: 1450,
                width_cm: 245,
                height_cm: 170
            }
        });
        
        if (packingResponse.statusCode === 200) {
            const packingData = JSON.parse(packingResponse.body);
            console.log('\n✅ Empacotamento bem-sucedido!');
            console.log(`📦 Total de itens: ${packingData.packingResult.totalPackedItems}`);
            console.log(`📐 Volume: ${(packingData.packingResult.totalRealVolume/1000000).toFixed(3)} m³`);
            
            console.log('\n🎨 ITENS RENDERIZADOS:');
            packingData.items.forEach((item, index) => {
                console.log(`${index + 1}. ${item.canName}: ${item.quantity} unidades`);
                console.log(`   Cor: #${item.color.toString(16).padStart(6, '0')}`);
                console.log(`   Geometria: ${item.geometry}`);
            });
        } else {
            console.log('❌ Erro no empacotamento');
        }
        
    } catch (error) {
        console.error('❌ Erro durante verificação:', error.message);
    }
}

verificarNomesEmbalagens();
