// Teste completo da visualização 3D com blocos e carga real
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

async function testeCompletoVisualizacao3D() {
    console.log('🧪 TESTE COMPLETO DA VISUALIZAÇÃO 3D COM BLOCOS');
    console.log('=' .repeat(80));
    
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
        
        console.log('✅ Login realizado com sucesso');
        
        // Carga de teste realista (mesma da página principal)
        console.log('\n📦 Carregando carga de teste realista...');
        const cargaTeste = [
            { canId: 52, quantity: 8 },   // Balde 25kg
            { canId: 51, quantity: 6 },   // Galão 3.6L
            { canId: 50, quantity: 10 },  // Balde 18L
            { canId: 59, quantity: 4 }    // Lata Solvente 5L
        ];
        
        console.log('📊 Itens na carga:');
        cargaTeste.forEach((item, index) => {
            console.log(`   ${index + 1}. ID: ${item.canId}, Quantidade: ${item.quantity}`);
        });
        
        // Calcular empacotamento 3D
        console.log('\n🚛 Calculando empacotamento 3D...');
        const packingResponse = await fazerRequisicao('POST', '/api/packing-3d', {
            items: cargaTeste,
            truckDimensions: {
                length_cm: 1450,
                width_cm: 245,
                height_cm: 170
            }
        });
        
        if (packingResponse.statusCode !== 200) {
            console.error('❌ Erro no empacotamento 3D');
            console.log(packingResponse.body);
            return;
        }
        
        const packingData = JSON.parse(packingResponse.body);
        console.log('✅ Empacotamento 3D calculado com sucesso!');
        
        // Mostrar informações detalhadas da carga
        console.log('\n📊 INFORMAÇÕES DETALHADAS DA CARGA:');
        console.log('=' .repeat(60));
        
        if (packingData.packingResult) {
            const result = packingData.packingResult;
            console.log(`📦 Estratégia: ${result.strategy}`);
            console.log(`📊 Total de Itens Empacotados: ${result.totalPackedItems}`);
            console.log(`📐 Volume Total (Bounding): ${(result.totalBoundingBoxVolume/1000000).toFixed(3)} m³`);
            console.log(`📐 Volume Real: ${(result.totalRealVolume/1000000).toFixed(3)} m³`);
            console.log(`📐 Volume Caminhão: ${(result.truckVolume/1000000).toFixed(3)} m³`);
            console.log(`📈 Ocupação: ${result.usedVolumePercentage.toFixed(1)}%`);
            console.log(`📈 Espaço Livre: ${result.unusedVolume.toFixed(1)}%`);
            
            if (result.rotationStats) {
                console.log(`🔄 Itens Rotacionados: ${result.rotationStats.rotatedItems}/${result.rotationStats.totalItems}`);
                console.log(`🔄 Taxa de Rotação: ${result.rotationStats.rotationRate}`);
            }
        }
        
        if (packingData.geometryStats) {
            const geo = packingData.geometryStats;
            console.log('\n🎨 ESTATÍSTICAS DE GEOMETRIA:');
            console.log(`📊 Eficiência Geométrica: ${(geo.overallEfficiency * 100).toFixed(1)}%`);
            console.log(`📊 Espaço Perdido: ${(geo.wastePercentage).toFixed(1)}%`);
            console.log(`📊 Volume Perdido: ${(geo.totalWastedSpace/1000000).toFixed(3)} m³`);
            
            console.log('\n📦 DETALHES POR TIPO DE EMBALAGEM:');
            Object.entries(geo.geometryStats).forEach(([type, stats]) => {
                if (stats.count > 0) {
                    console.log(`   🏷️  ${type}:`);
                    console.log(`      - Quantidade: ${stats.count} blocos`);
                    console.log(`      - Volume Total: ${(stats.totalVolume/1000000).toFixed(3)} m³`);
                    console.log(`      - Espaço Perdido: ${(stats.wastedSpace/1000000).toFixed(3)} m³`);
                    console.log(`      - Eficiência: ${(stats.totalVolume > 0 ? (stats.totalVolume/(stats.totalVolume + stats.wastedSpace)) * 100 : 100).toFixed(1)}%`);
                }
            });
        }
        
        if (packingData.items && packingData.items.length > 0) {
            console.log('\n🎯 INFORMAÇÕES DOS BLOCOS RENDERIZADOS:');
            console.log('=' .repeat(60));
            
            // Agrupar itens para mostrar blocos
            const blocosInfo = {};
            packingData.items.forEach(item => {
                if (!blocosInfo[item.canName]) {
                    blocosInfo[item.canName] = {
                        count: 0,
                        totalQuantity: 0,
                        color: `#${item.color.toString(16).padStart(6, '0')}`,
                        geometry: item.geometry
                    };
                }
                blocosInfo[item.canName].count++;
                blocosInfo[item.canName].totalQuantity += item.quantity || 1;
            });
            
            Object.entries(blocosInfo).forEach(([name, info], index) => {
                console.log(`${index + 1}. 📦 ${name}:`);
                console.log(`   🎨 Cor: ${info.color}`);
                console.log(`   📐 Geometria: ${info.geometry}`);
                console.log(`   🔢 Blocos Renderizados: ${info.count}`);
                console.log(`   📦 Quantidade Total: ${info.totalQuantity} itens`);
                
                // Calcular aproximação de blocos
                let itemsPerBlock = 1;
                if (name.includes('Balde')) {
                    itemsPerBlock = name.includes('25kg') ? 4 : 4;
                } else if (name.includes('Galão')) {
                    itemsPerBlock = name.includes('3.6L') ? 6 : 6;
                } else if (name.includes('Lata')) {
                    itemsPerBlock = 8;
                } else if (name.includes('Barrica')) {
                    itemsPerBlock = 3;
                } else if (name.includes('Tambor')) {
                    itemsPerBlock = 2;
                } else if (name.includes('Container')) {
                    itemsPerBlock = 2;
                }
                
                const estimatedBlocks = Math.ceil(info.totalQuantity / itemsPerBlock);
                console.log(`   📦 Blocos Estimados: ${estimatedBlocks}`);
                console.log(`   📦 Itens por Bloco: ${itemsPerBlock}`);
                console.log('');
            });
        }
        
        // Análise logística
        console.log('\n🚛 ANÁLISE LOGÍSTICA:');
        console.log('=' .repeat(40));
        
        if (packingData.packingResult) {
            const ocupacao = packingData.packingResult.usedVolumePercentage;
            console.log(`📈 Taxa de Ocupação: ${ocupacao.toFixed(1)}%`);
            
            if (ocupacao <= 60) {
                console.log('✅ Nível Risco: BAIXO');
                console.log('💡 Recomendação: Carga confortável com ampla margem de segurança.');
            } else if (ocupacao <= 80) {
                console.log('⚠️ Nível Risco: MÉDIO');
                console.log('💡 Recomendação: Ocupação elevada mas viável em 1 caminhão.');
            } else {
                console.log('🔴 Nível Risco: ALTO');
                console.log('💡 Recomendação: Caminhão lotado - atenção especial necessária.');
            }
        }
        
        // Informações do caminhão
        console.log('\n🚚 INFORMAÇÕES DO CAMINHÃO:');
        console.log('=' .repeat(40));
        console.log(`📏 Comprimento: 14.5m (1450cm)`);
        console.log(`📏 Largura: 2.45m (245cm)`);
        console.log(`📏 Altura: 1.70m (170cm)`);
        console.log(`📐 Volume Total: ${(14.5 * 2.45 * 1.70).toFixed(2)} m³`);
        console.log(`📐 Volume Utilizável: ${(14.5 * 2.45 * 1.70 * 0.85).toFixed(2)} m³ (85% eficiência)`);
        
        console.log('\n' + '=' .repeat(80));
        console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
        console.log('🌐 Acesse a visualização em: http://localhost:3000');
        console.log('📦 Clique em "Mostrar 3D" para ver a renderização dos blocos');
        console.log('=' .repeat(80));
        
    } catch (error) {
        console.error('❌ Erro durante o teste:', error.message);
    }
}

// Executar teste
testeCompletoVisualizacao3D();
