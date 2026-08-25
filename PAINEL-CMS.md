# Painel de conteúdo — Caminhando com Deus 365

Esta branch contém a versão em desenvolvimento do painel. Ela não altera o site oficial enquanto não for unida à branch `main`.

## Primeiro teste seguro

1. Acessar `https://app.pagescms.org` e entrar com a conta do GitHub.
2. Instalar o aplicativo do Pages CMS somente no repositório `365caminhandocomdeus/devocional`.
3. Abrir o repositório e selecionar a branch `painel-cms`.
4. Conferir as coleções **Semanas de 2026** e **Devocionais de 2026**.
5. Criar primeiro um conteúdo com status **Rascunho** para validar o formulário.

Enquanto o teste estiver na branch `painel-cms`, nenhum salvamento feito pelo painel altera o site oficial. A publicação automática só será ativada depois da revisão final e da união controlada com a branch `main`.

## Estrutura

- `.pages.yml`: formulário exibido pelo Pages CMS.
- `content/semanas/2026/`: tema, propósito e cor de cada semana.
- `content/devocionais/2026/`: conteúdo diário.
- `templates/devocional.html`: modelo visual único.
- `scripts/build.mjs`: gera as páginas e as imagens de compartilhamento.
- `dist/`: site pronto, criado localmente e não salvo no Git.

## Fluxo diário futuro

1. Entrar no Pages CMS com a conta do GitHub.
2. Cadastrar a semana, caso seja o primeiro dia dela.
3. Criar o devocional e preencher os campos.
4. Selecionar `Publicado`.
5. Salvar.
6. O GitHub Actions gera o site, a imagem “DIA N” e publica no GitHub Pages.

## Teste local

```bash
npm ci
npm test
npx serve dist
```

O devocional mais recente com status `publicado` torna-se automaticamente a página principal. Entradas com status `rascunho` não são incluídas no site publicado.

