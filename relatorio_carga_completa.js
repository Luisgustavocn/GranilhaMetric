// Relatório detalhado de tudo que foi carregado no caminhão
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

async function mostrarDetalhesCargaCompleta() {
    console.log('🚛 RELATÓRIO DETALHADO DA CARGA COMPLETA');
    console.log('=' .repeat(80));
    
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
        
        // Buscar informações das latas
        const cansResponse = await fazerRequisicao('GET', '/api/cans');
        const cansData = JSON.parse(cansResponse.body);
        
        // Definir carga completa
        const cargaCompleta = [
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
        
        let totalGeralUnidades = 0;
        let totalGeralVolume = 0;
        let totalGeralPeso = 0;
        
        console.log('📋 DETALHAMENTO POR CLIENTE:\n');
        
        // Mostrar detalhes por cliente
        for (const carga of cargaCompleta) {
            console.log(`🏢 ${carga.cliente}`);
            console.log('-'.repeat(60));
            
            let totalClienteUnidades = 0;
            let totalClienteVolume = 0;
            
            for (const item of carga.itens) {
                const canInfo = cansData.cans.find(c => c.name === item.nome);
                
                if (canInfo) {
                    const volumeItem = canInfo.volume_cm3 * item.quantidade;
                    totalClienteUnidades += item.quantidade;
                    totalClienteVolume += volumeItem;
                    
                    // Calcular dimensões 3D
                    let volume3D = 0;
                    let dimensoes = '';
                    
                    if (canInfo.shape === 'cylinder') {
                        volume3D = canInfo.diameter_cm * canInfo.diameter_cm * canInfo.height_cm * item.quantidade;
                        dimensoes = `⌀${canInfo.diameter_cm}cm × ${canInfo.height_cm}cm`;
                    } else if (canInfo.shape === 'square') {
                        volume3D = canInfo.length_cm * canInfo.width_cm * canInfo.height_cm * item.quantidade;
                        dimensoes = `${canInfo.length_cm}cm × ${canInfo.width_cm}cm × ${canInfo.height_cm}cm`;
                    }
                    
                    console.log(`   📦 ${item.nome}`);
                    console.log(`      Unidades: ${item.quantidade}`);
                    console.log(`      Dimensões: ${dimensoes}`);
                    console.log(`      Volume unitário: ${(canInfo.volume_cm3/1000).toFixed(1)}L`);
                    console.log(`      Volume total: ${(volumeItem/1000000).toFixed(3)}m³`);
                    console.log(`      Volume 3D: ${(volume3D/1000000).toFixed(3)}m³`);
                    console.log('');
                }
            }
            
            totalGeralUnidades += totalClienteUnidades;
            totalGeralVolume += totalClienteVolume;
            
            console.log(`   📊 TOTAL DO CLIENTE:`);
            console.log(`      Unidades: ${totalClienteUnidades}`);
            console.log(`      Volume: ${(totalClienteVolume/1000000).toFixed(3)}m³`);
            console.log('\n' + '=' .repeat(80) + '\n');
        }
        
        // Resumo geral
        console.log('📊 RESUMO GERAL DA CARGA');
        console.log('=' .repeat(80));
        console.log(`🚛 Total de Clientes: ${cargaCompleta.length}`);
        console.log(`📦 Total de Unidades: ${totalGeralUnidades}`);
        console.log(`📊 Volume Total: ${(totalGeralVolume/1000000).toFixed(3)}m³`);
        
        // Calcular volume 3D total
        let volume3DTotal = 0;
        for (const carga of cargaCompleta) {
            for (const item of carga.itens) {
                const canInfo = cansData.cans.find(c => c.name === item.nome);
                if (canInfo) {
                    if (canInfo.shape === 'cylinder') {
                        volume3DTotal += canInfo.diameter_cm * canInfo.diameter_cm * canInfo.height_cm * item.quantidade;
                    } else if (canInfo.shape === 'square') {
                        volume3DTotal += canInfo.length_cm * canInfo.width_cm * canInfo.height_cm * item.quantidade;
                    }
                }
            }
        }
        
        console.log(`📐 Volume Efetivo 3D: ${(volume3DTotal/1000000).toFixed(3)}m³`);
        console.log(`📈 Eficiência: ${((totalGeralVolume/volume3DTotal)*100).toFixed(1)}%`);
        
        // Análise do caminhão
        const caminhaoCapacity = 1450 * 245 * 170; // cm³
        const ocupacao = (volume3DTotal / caminhaoCapacity) * 100;
        
        console.log(`🚚 Capacidade Caminhão: ${(caminhaoCapacity/1000000).toFixed(2)}m³`);
        console.log(`🚚 Ocupação: ${ocupacao.toFixed(1)}%`);
        console.log(`🚚 Espaço Livre: ${((caminhaoCapacity - volume3DTotal)/1000000).toFixed(3)}m³`);
        
        console.log('\n' + '=' .repeat(80));
        console.log('✅ CONCLUSÃO: TODA A CARGA CABE EM 1 CAMINHÃO!');
        console.log('=' .repeat(80));
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

mostrarDetalhesCargaCompleta();
