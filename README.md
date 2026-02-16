# Palavras Cruzadas

Clone do jogo de palavras cruzadas do O Globo. Consome puzzles da API Agilmente e os serve como site 100% estático.

## Como usar

### 1. Baixar puzzles

A API key é pública (visível no HTML do site do O Globo), mas não é commitada no repo. Extraia do código-fonte de https://oglobo.globo.com/jogos/palavras-cruzadas/ (atributo `data-key`) e exporte:

```bash
export AGILMENTE_API_KEY="sua-key-aqui"
node scraper/fetch-puzzles.js
```

Por padrão baixa os últimos 60 dias. Para um range específico:

```bash
node scraper/fetch-puzzles.js --from 2026-01-01 --to 2026-02-15
```

Os puzzles são salvos em `data/daily/{YYYY-MM-DD}.json`. Reruns pulam arquivos já existentes.

### 2. Jogar

```bash
npx serve . -l 3333
```

Abra `http://localhost:3333/site/` no browser.

## Funcionalidades

- **Auto-validação**: palavras são validadas automaticamente ao preencher todas as letras (verde = correto, sem indicação de erro)
- **Dicas**: revelar letra, palavra ou tudo (letras reveladas aparecem em azul)
- **Persistência**: progresso salvo no localStorage entre sessões
- **Timer**: inicia no primeiro input, pausa ao sair da aba
- **Estatísticas**: puzzles completados, streak, melhor tempo, histórico
- **Navegação por teclado**: setas, Tab (próxima palavra), Espaço (alternar direção), Backspace
- **Responsivo**: funciona em desktop e mobile
- **Dark mode**: detecta preferência do sistema

## Estrutura

```
crosswords/
  scraper/
    fetch-puzzles.js     # Baixa puzzles da API Agilmente
  data/
    daily/
      index.json         # Lista de datas disponíveis
      2026-02-15.json    # Puzzle individual
  site/
    index.html
    css/style.css
    js/
      app.js             # Inicialização e roteamento
      grid.js            # Renderer do grid + navegação
      game.js            # Validação, dicas, estado
      storage.js         # localStorage
      timer.js           # Cronômetro
      ui.js              # Painel de dicas, modais
```

## Stack

- **Scraper**: Node.js (ESM, zero dependências externas)
- **Frontend**: HTML/CSS/JS vanilla (ES modules, zero build step)
- **Dados**: iPuz v2 (padrão aberto para puzzles digitais)
