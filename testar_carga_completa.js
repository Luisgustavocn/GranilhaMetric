// Script para testar carregamento COMPLETO de todas as cargas no caminhão
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
            console.log(`🍪 Enviando cookie: ${cookies.substring(0, 20)}...`);
        }

        const req = http.request(options, (res) => {
            let body = '';
            
            // Capturar cookies
            if (res.headers['set-cookie']) {
                cookies = res.headers['set-cookie'][0].split(';')[0];
                console.log(`🍪 Recebido cookie: ${cookies.substring(0, 20)}...`);
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

async function obterIdEmbalagem(nome, cansList) {
    const can = cansList.find(c => c.name === nome);
    console.log(`   🔍 Buscando "${nome}": ${can ? `ID ${can.id}` : 'não encontrado'}`);
    return can ? can.id : null;
}

async function testarCargaCompleta() {
    console.log('🚛 TESTE DE CARREGAMENTO COMPLETO NO CAMINHÃO');
    console.log('🚚 Caminhão: 14.5m × 2.45m × 1.70m = 60.39m³\n');
    
    try {
        // Login primeiro
        const loginResponse = await fazerRequisicao('POST', '/api/login', {
            email: 'admin@granilha.local',
            password: 'admin123'
        });
        
        if (loginResponse.statusCode !== 200) {
            console.error('❌ Falha no login');
            return;
        }
        
        console.log('✅ Autenticado com sucesso\n');
        
        // Buscar todas as latas uma vez só
        const cansResponse = await fazerRequisicao('GET', '/api/cans');
        const cansData = JSON.parse(cansResponse.body);
        
        console.log('📦 Embalagens disponíveis:');
        cansData.cans.forEach(can => {
            console.log(`   • ID ${can.id}: ${can.name} (${can.shape})`);
        });
        console.log('');
        
        // Definir todas as cargas
        const todasAsCargas = [
            {
                cliente: 'Casa das Tintas',
                itens: [
                    { nome: 'Balde 25kg', quantidade: 460 },
                    { nome: 'Galão 3.6L', quantidade: 20 },
                    { nome: 'Container', quantidade: 2 }
                ]
            },
            {
                cliente: 'Aliança Tintas',
                itens: [
                    { nome: 'Balde 18L', quantidade: 12 }
                ]
            },
            {
                cliente: 'T Santos',
                itens: [
                    { nome: 'Balde 18L', quantidade: 84 },
                    { nome: 'Balde 25kg', quantidade: 120 },
                    { nome: 'Barrica 25kg', quantidade: 220 },
                    { nome: 'Galão 3.6L', quantidade: 40 }
                ]
            },
            {
                cliente: 'T Santos - Solvente',
                itens: [
                    { nome: 'Galão 3.2L', quantidade: 50 },
                    { nome: 'Tambor 200L', quantidade: 1 },
                    { nome: 'Lata 18L', quantidade: 29 },
                    { nome: 'Quarto 900ML', quantidade: 36 },
                    { nome: 'Lata Solvente 5L', quantidade: 16 },
                    { nome: 'Frasco Aerosol 225/180ML', quantidade: 9 },
                    { nome: 'Massa Poliester', quantidade: 4 },
                    { nome: 'Lata Solvente 900ML', quantidade: 5 }
                ]
            },
            {
                cliente: 'M Max',
                itens: [
                    { nome: 'Galão 3.2L', quantidade: 38 },
                    { nome: 'Lata 18L', quantidade: 70 },
                    { nome: 'Quarto 900ML', quantidade: 14 },
                    { nome: 'Lata Solvente 5L', quantidade: 20 },
                    { nome: 'Frasco Aerosol 225/180ML', quantidade: 12 },
                    { nome: 'Lata Solvente 900ML', quantidade: 20 }
                ]
            },
            {
                cliente: 'Tecnopartes',
                itens: [
                    { nome: 'Galão 3.2L', quantidade: 34 },
                    { nome: 'Lata 18L', quantidade: 7 },
                    { nome: 'Quarto 900ML', quantidade: 13 },
                    { nome: 'Lata Solvente 5L', quantidade: 10 },
                    { nome: 'Lata Solvente 900ML', quantidade: 6 },
                    { nome: 'Balde Plastico 18L', quantidade: 5 }
                ]
            },
            {
                cliente: 'Aliança',
                itens: [
                    { nome: 'Galão 3.2L', quantidade: 10 },
                    { nome: 'Tambor 200L', quantidade: 9 },
                    { nome: 'Lata 18L', quantidade: 95 },
                    { nome: 'Lata Solvente 5L', quantidade: 5 }
                ]
            },
            {
                cliente: 'Mercadão',
                itens: [
                    { nome: 'Galão 3.2L', quantidade: 31 },
                    { nome: 'Lata 18L', quantidade: 20 },
                    { nome: 'Quarto 900ML', quantidade: 19 },
                    { nome: 'Lata Solvente 5L', quantidade: 7 },
                    { nome: 'Frasco Aerosol 225/180ML', quantidade: 3 },
                    { nome: 'Lata Solvente 900ML', quantidade: 19 }
                ]
            },
            {
                cliente: 'FG Santos',
                itens: [
                    { nome: 'Galão 3.2L', quantidade: 4 }
                ]
            }
        ];
        
        // Combinar TODAS as cargas em uma única
        let cargaCompleta = [];
        let volumeTotal = 0;
        let volumeEfetivo = 0;
        
        console.log('📦 Processando todas as cargas...\n');
        
        for (const carga of todasAsCargas) {
            console.log(`🔹 ${carga.cliente}:`);
            
            for (const item of carga.itens) {
                const canId = await obterIdEmbalagem(item.nome, cansData.cans);
                
                if (canId) {
                    cargaCompleta.push({
                        canId: canId,
                        quantity: item.quantidade
                    });
                    
                    console.log(`   • ${item.nome}: ${item.quantidade}un (ID: ${canId})`);
                } else {
                    console.log(`   ⚠️  ${item.nome}: ${item.quantidade}un (não encontrado)`);
                }
            }
        }
        
        console.log(`\n🎯 TOTAL: ${cargaCompleta.length} tipos diferentes de itens`);
        console.log(`📊 Total de unidades: ${cargaCompleta.reduce((sum, item) => sum + item.quantity, 0)}`);
        
        // Testar cálculo com TODA a carga
        console.log('\n🚛 Calculando carregamento COMPLETO...');
        
        const requestData = {
            mode: 'automatic',
            items: cargaCompleta,
            startDate: '2026-03-26',
            endDate: '2026-03-26'
        };
        
        console.log(`📊 Enviando ${cargaCompleta.length} itens para cálculo...`);
        
        const calcResponse = await fazerRequisicao('POST', '/api/calculate', requestData);
        
        if (calcResponse.statusCode === 200) {
            const resultado = JSON.parse(calcResponse.body);
            
            console.log('\n✅ CÁLCULO REALIZADO COM SUCESSO!');
            console.log('=' .repeat(60));
            console.log('📊 RESULTADO DO CARREGAMENTO COMPLETO:');
            console.log('=' .repeat(60));
            console.log(`📦 Método de Cálculo: ${resultado.calculationMethod || '3d_precise'}`);
            console.log(`📦 Volume Total: ${(resultado.totalVolumeCm3/1000000).toFixed(3)}m³`);
            console.log(`📦 Volume Efetivo 3D: ${(resultado.totalEffectiveVolumeCm3/1000000).toFixed(3)}m³`);
            console.log(`📦 Eficiência: ${((resultado.packingEfficiency || 1)*100).toFixed(1)}%`);
            console.log(`📦 Total de Itens: ${resultado.totalCans}`);
            
            if (resultado.logisticAnalysis) {
                const analise = resultado.logisticAnalysis;
                console.log('\n📈 ANÁLISE LOGÍSTICA:');
                console.log(`   • Método: ${analise.metodo}`);
                console.log(`   • Volume Caminhão: ${analise.volumeUtilCaminhao.toFixed(2)}m³`);
                console.log(`   • Taxa Ocupação: ${analise.taxaOcupacao}%`);
                console.log(`   • Espaço Restante: ${analise.espacoRestante.toFixed(3)}m³ (${analise.espacoRestantePercentual}%)`);
                console.log(`   • Conclusão: ${analise.conclusao}`);
                console.log(`   • Nível Risco: ${analise.nivelRisco}`);
                console.log(`   • Recomendação: ${analise.recomendacao}`);
            }
            
            if (resultado.allocation) {
                console.log('\n🚚 ALOCAÇÃO DE CAMINHÕES:');
                resultado.allocation.trucks.forEach((truck, index) => {
                    console.log(`   Caminhão ${index + 1}: ${truck.name} - ${truck.quantity} unid`);
                    console.log(`      Capacidade: ${(truck.totalCapacityCm3/1000000).toFixed(2)}m³`);
                    console.log(`      Ocupação: ${(truck.occupancyRate*100).toFixed(1)}%`);
                });
                console.log(`   ✅ Cabe tudo: ${resultado.allocation.fits ? 'SIM' : 'NÃO'}`);
                console.log(`   📦 Espaço sobrando: ${(resultado.allocation.leftoverCm3/1000000).toFixed(3)}m³`);
                if (resultado.allocation.missingCm3 > 0) {
                    console.log(`   ❌ Espaço faltando: ${(resultado.allocation.missingCm3/1000000).toFixed(3)}m³`);
                }
            }
            
            console.log('\n' + '=' .repeat(60));
            
        } else {
            console.log('❌ Erro no cálculo:', calcResponse.body);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

testarCargaCompleta();
