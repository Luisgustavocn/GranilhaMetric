# Granilha Metric

Sistema privado para calcular o caminhao ideal para transporte de latas de tinta, com perfis `admin` e `user`.

## Requisitos

- Node.js 22+ (testado com Node 24)

## Como executar

```bash
npm start
```

Acesse `http://localhost:3000`.

## Credencial inicial

- Email: `admin@granilha.local`
- Senha: `admin123`

## Regras implementadas

- Apenas `admin` cadastra usuarios, latas e caminhoes.
- Apenas `admin` pode editar e excluir usuarios, latas e caminhoes individualmente (acoes dentro dos modais de detalhe).
- Usuarios comuns podem consultar cadastros e usar a calculadora.
- A calculadora possui selecao de modo: `automatico` ou `manual` (um por vez).
- No modo `automatico`, se a carga nao couber em 1 caminhao, o sistema distribui em mais de 1.
- No modo `manual`, voce escolhe entre carregar em 1 caminhao ou distribuir em varios.
- O sistema nao insere mais caminhoes ou latas automaticamente no primeiro start.

## Observacao de calculo

A escolha do caminhao e feita por volume total (cm3 -> litros), para garantir que nao falte espaco e minimizar sobra.

## Seguranca basica aplicada

- Cookie de sessao com `HttpOnly` e `SameSite=Strict`.
- Cookie `Secure` automatico quando a aplicacao estiver atras de HTTPS.
- Limitacao de tentativas de login por IP.
- Rate limit para leitura e escrita na API.
- Validacao de mesma origem para operacoes de escrita na API.
- Token CSRF para requisicoes autenticadas de escrita.
- Vinculo de sessao ao IP e ao `User-Agent` do navegador.
- Cabecalhos de seguranca para conteudo estatico e respostas da API.
- Validacoes mais estritas para nomes, e-mails e forca minima de senha.

## Recomendacoes obrigatorias para producao

- Coloque a aplicacao atras de HTTPS.
- Configure `APP_ORIGIN` com a URL publica exata do sistema.
- Troque imediatamente a senha padrao do administrador.
- Restrinja o acesso ao servidor e ao banco apenas a rede interna ou VPN.
- Mantenha backup do banco e logs do servidor fora da maquina principal.
