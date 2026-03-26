// Teste completo via API com carga real
const http = require('http');

let cookies = '';

function fazerRequisicao(method, path, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

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

        req.write(postData);
        req.end();
    });
}

async function testarCargaReal() {
    console.log('🎯 Testando carga real via API 3D\n');
    
    try {
        // Login
        const loginResponse = await fazerRequisicao('POST', '/api/login', {
            email: 'admin@granilha.local',
            password: 'admin123'
        });
        
        if (loginResponse.statusCode !== 200) {
            console.error('❌ Falha no login');
            return;
        }
        
        console.log('✅ Autenticado com sucesso');
        
        // Buscar latas disponíveis
        const cansResponse = await fazerRequisicao('GET', '/api/cans');
        const cansData = JSON.parse(cansResponse.body);
        
        console.log('📦 Latas disponíveis:');
        cansData.cans.forEach(can => {
            console.log(`   • ${can.name} (ID: ${can.id}) - ${can.shape}`);
        });
        
        // Testar carga da Casa das Tintas
        const cargaTeste = {
            items: [
                { canId: 1, quantity: 5 },  // Assumindo que Balde 25kg é ID 1
                { canId: 2, quantity: 3 }   // Assumindo que Galão 3.6L é ID 2
            ]
        };
        
        console.log('\n🚛 Testando cálculo automático...');
        const calcResponse = await fazerRequisicao('POST', '/api/calculate', {
            mode: 'automatic',
            items: cargaTeste.items,
            startDate: '2026-03-26',
            endDate: '2026-03-26'
        });
        
        if (calcResponse.statusCode === 200) {
            const resultado = JSON.parse(calcResponse.body);
            console.log('✅ Cálculo realizado com sucesso!');
            console.log('📊 Resultado:');
            console.log(`   • Método: ${resultado.calculationMethod || '3d_precise'}`);
            console.log(`   • Volume Total: ${(resultado.totalVolumeCm3/1000000).toFixed(3)}m³`);
            console.log(`   • Volume Efetivo: ${(resultado.totalEffectiveVolumeCm3/1000000).toFixed(3)}m³`);
            console.log(`   • Eficiência: ${((resultado.packingEfficiency || 1)*100).toFixed(1)}%`);
            
            if (resultado.logisticAnalysis) {
                const analise = resultado.logisticAnalysis;
                console.log('📈 Análise Logística:');
                console.log(`   • Método: ${analise.metodo}`);
                console.log(`   • Taxa Ocupação: ${analise.taxaOcupacao}%`);
                console.log(`   • Conclusão: ${analise.conclusao}`);
                console.log(`   • Recomendação: ${analise.recomendacao}`);
            }
            
            if (resultado.allocation) {
                console.log('🚚 Alocação:');
                resultado.allocation.trucks.forEach(truck => {
                    console.log(`   • ${truck.name}: ${truck.quantity} unid`);
                });
            }
        } else {
            console.log('❌ Erro no cálculo:', calcResponse.body);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

testarCargaReal();
