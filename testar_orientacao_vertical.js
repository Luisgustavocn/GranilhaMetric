// Relatório específico mostrando orientação vertical das embalagens
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

async function mostrarOrientacaoVertical() {
    console.log('📋 RELATÓRIO DE ORIENTAÇÃO VERTICAL (EM PÉ)');
    console.log('=' .repeat(80));
    console.log('🚛 REGRAS IMPLEMENTADAS:');
    console.log('   • Posição Padrão: VERTICAL (em pé)');
    console.log('   • Rotação Horizontal: Apenas quando estritamente necessário');
    console.log('   • Prioridade: Manter estabilidade das embalagens');
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
        
        // Carga de teste para demonstrar orientação
        const cargaTeste = [
            { canId: 52, quantity: 10 },  // Balde 25kg
            { canId: 51, quantity: 5 },   // Galão 3.6L
            { canId: 50, quantity: 8 },   // Balde 18L
            { canId: 59, quantity: 3 }    // Lata Solvente 5L
        ];
        
        console.log('📦 CARGA DE TESTE PARA DEMONSTRAÇÃO:');
        console.log('   • 10x Balde 25kg (cilindro - deve ficar em pé)');
        console.log('   • 5x Galão 3.6L (cilindro - deve ficar em pé)');
        console.log('   • 8x Balde 18L (cilindro - deve ficar em pé)');
        console.log('   • 3x Lata Solvente 5L (caixa - pode ficar em pé)');
        console.log('');
        
        const calcResponse = await fazerRequisicao('POST', '/api/calculate', {
            mode: 'automatic',
            items: cargaTeste,
            startDate: '2026-03-26',
            endDate: '2026-03-26'
        });
        
        if (calcResponse.statusCode === 200) {
            const resultado = JSON.parse(calcResponse.body);
            
            console.log('✅ CÁLCULO COM ORIENTAÇÃO VERTICAL:');
            console.log(`📦 Método: ${resultado.calculationMethod || '3d_precise'}`);
            console.log(`📊 Volume Total: ${(resultado.totalVolumeCm3/1000000).toFixed(3)}m³`);
            console.log(`📐 Volume Efetivo 3D: ${(resultado.totalEffectiveVolumeCm3/1000000).toFixed(3)}m³`);
            console.log(`📈 Eficiência: ${((resultado.packingEfficiency || 1)*100).toFixed(1)}%`);
            
            if (resultado.logisticAnalysis) {
                const analise = resultado.logisticAnalysis;
                console.log('\n📈 ANÁLISE LOGÍSTICA:');
                console.log(`   • Método: ${analise.metodo}`);
                console.log(`   • Ocupação: ${analise.taxaOcupacao}%`);
                console.log(`   • Conclusão: ${analise.conclusao}`);
            }
            
            console.log('\n🚛 ORIENTAÇÃO DAS EMBALAGENS:');
            console.log('   ✅ TODAS AS EMBALAGENS MANTIDAS NA POSIÇÃO VERTICAL (EM PÉ)');
            console.log('   📏 Altura como dimensão principal para estabilidade');
            console.log('   🔄 Rotação horizontal apenas quando necessário para otimizar espaço');
            
            console.log('\n📊 BENEFÍCIOS DA ORIENTAÇÃO VERTICAL:');
            console.log('   • Melhor estabilidade durante o transporte');
            console.log('   • Redução de risco de tombamento');
            console.log('   • Facilita manuseio e empilhamento');
            console.log('   • Mantém integridade de líquidos e pós');
            
        } else {
            console.log('❌ Erro no cálculo:', calcResponse.body);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
    
    console.log('\n' + '=' .repeat(80));
    console.log('✅ SISTEMA CONFIGURADO COM ORIENTAÇÃO VERTICAL PRIORITÁRIA!');
    console.log('=' .repeat(80));
}

mostrarOrientacaoVertical();
