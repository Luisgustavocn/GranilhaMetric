# Granilha Metric

Sistema privado para calcular o caminhao ideal para transporte de latas de tinta, com perfis `admin` e `user`.

## Requisitos

- Node.js 22+ (testado com Node 24)

## Como executar

```bash
npm start
```

Acesse `http://localhost:3000`.

## Deploy em Servidor (Produção)

### 1. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo e ajuste:

```bash
cp .env.example .env
```

Edite `.env` conforme necessário:
```
NODE_ENV=production
PORT=3000
DB_PATH=/caminho/seguro/database.sqlite
```

### 2. Opções de Execução

**Opção A - Node.js direto:**
```bash
npm run prod
```

**Opção B - PM2 (Recomendado para produção):**

Instale o PM2 globalmente:
```bash
npm install -g pm2
```

Inicie com PM2:
```bash
npm run pm2:start
```

Comandos PM2 úteis:
```bash
npm run pm2:logs    # Ver logs
npm run pm2:restart # Reiniciar
npm run pm2:stop    # Parar
```

### 3. Configurar HTTPS (Recomendado)

Para HTTPS em produção, use um **reverse proxy** (Nginx, Apache) ou um serviço como Cloudflare.

**Exemplo com Nginx:**
```nginx
server {
    listen 443 ssl;
    server_name seu-dominio.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Backup do Banco de Dados

O banco SQLite fica em `database.sqlite` (ou no caminho definido em `DB_PATH`). Faça backup regular:

```bash
cp database.sqlite backup/database-$(date +%Y%m%d).sqlite
```

### 5. Segurança Importante

- **Altere a senha admin padrão** após o primeiro login
- Use HTTPS em produção
- Mantenha o Node.js atualizado
- Configure firewall para permitir apenas portas necessárias

## Credencial inicial

- Email: `admin@granilha.local`
- Senha: `admin123`

⚠️ **IMPORTANTE:** Altere esta senha após o primeiro login!

## Regras implementadas

- Apenas `admin` cadastra usuarios, latas e caminhoes.
- Apenas `admin` pode editar e excluir usuarios, latas e caminhoes individualmente (acoes dentro dos modais de detalhe).
- Usuarios comuns podem consultar cadastros e usar a calculadora.
- A calculadora possui selecao de modo: `automatico` ou `manual` (um por vez).
- No modo `automatico`, se a carga nao couber em 1 caminhao, o sistema distribui em mais de 1.
- No modo `manual`, voce escolhe entre carregar em 1 caminhao ou distribuir em varios.
- Caminhoes de exemplo ja sao inseridos automaticamente no primeiro start.

## Observacao de calculo

A escolha do caminhao e feita por volume total (cm3 -> litros), para garantir que nao falte espaco e minimizar sobra.
