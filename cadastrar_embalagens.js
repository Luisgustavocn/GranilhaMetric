// Script para cadastrar embalagens via API
const http = require('http');

const embalagensParaCadastrar = [
    {
        name: 'Balde 18L',
        shape: 'cylinder',
        diameterCm: 31.8,  // circunf=100cm → diâmetro=100/π
        heightCm: 35
    },
    {
        name: 'Galão 3.6L',
        shape: 'cylinder',
        diameterCm: 19.7,  // circunf=62cm → diâmetro=62/π
        heightCm: 20
    },
    {
        name: 'Balde 25kg',
        shape: 'cylinder',
        diameterCm: 31.8,  // circunf=100cm → diâmetro=100/π
        heightCm: 31
    },
    {
        name: 'Barrica 25kg',
        shape: 'cylinder',
        diameterCm: 28.3,  // circunf=89cm → diâmetro=89/π
        heightCm: 30
    },
    {
        name: 'Container',
        shape: 'square',
        lengthCm: 115,    // 1.15m
        widthCm: 115,     // 1.15m  
        heightCm: 116     // 1.16m
    },
    {
        name: 'Galão 3.2L',
        shape: 'cylinder',
        diameterCm: 19.0,  // estimado baseado no 3.6L
        heightCm: 22       // estimado
    },
    {
        name: 'Tambor 200L',
        shape: 'cylinder',
        diameterCm: 58,
        heightCm: 75
    },
    {
        name: 'Lata 18L',
        shape: 'cylinder',
        diameterCm: 30,
        heightCm: 25
    },
    {
        name: 'Quarto 900ML',
        shape: 'cylinder',
        diameterCm: 10,
        heightCm: 12
    },
    {
        name: 'Lata Solvente 5L',
        shape: 'square',
        lengthCm: 37,
        widthCm: 22,
        heightCm: 29
    },
    {
        name: 'Frasco Aerosol 225/180ML',
        shape: 'cylinder',
        diameterCm: 6,
        heightCm: 15
    },
    {
        name: 'Massa Poliester',
        shape: 'square',
        lengthCm: 30,
        widthCm: 20,
        heightCm: 15
    },
    {
        name: 'Lata Solvente 900ML',
        shape: 'square',
        lengthCm: 34.5,
        widthCm: 26.5,
        heightCm: 19
    },
    {
        name: 'Balde Plastico 18L',
        shape: 'cylinder',
        diameterCm: 31.8,
        heightCm: 35
    }
];

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
            
            // Capturar cookies
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

async function cadastrarEmbalagens() {
    console.log('🔧 Cadastrando embalagens no sistema...');
    
    try {
        // Fazer login primeiro
        const loginResponse = await fazerRequisicao('POST', '/api/login', {
            email: 'admin@granilha.local',
            password: 'admin123'
        });
        
        if (loginResponse.statusCode !== 200) {
            console.error('❌ Falha no login:', loginResponse.body);
            return;
        }
        
        console.log('✅ Login realizado com sucesso');
        console.log('🍪 Cookies:', cookies);
        
        // Cadastrar cada embalagem
        for (const embalagem of embalagensParaCadastrar) {
            console.log(`📦 Cadastrando: ${embalagem.name}`);
            
            const response = await fazerRequisicao('POST', '/api/cans', embalagem);
            
            if (response.statusCode === 201) {
                console.log(`✅ ${embalagem.name} cadastrado com sucesso`);
            } else {
                console.log(`⚠️  ${embalagem.name}:`, response.body);
            }
        }
        
        console.log('\n🎉 Embalagens cadastradas!');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

cadastrarEmbalagens();
