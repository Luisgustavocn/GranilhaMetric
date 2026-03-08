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
- Caminhoes de exemplo ja sao inseridos automaticamente no primeiro start.

## Observacao de calculo

A escolha do caminhao e feita por volume total (cm3 -> litros), para garantir que nao falte espaco e minimizar sobra.
