# Design · nova interface do GymOrganizer

Proposta de interface refeita do zero, inspirada no Obsidian (escuro, plano, busca única, páginas ligadas por `[[links]]`) e no Hevy (registro rápido de séries, coluna "Anterior", recordes, gráficos e rotinas).

Nada nesta pasta é carregado pelo app. O código em `app/` continua igual.

| Arquivo | O que é |
|---|---|
| [`spec.md`](spec.md) | Especificação: princípios, tokens (cor, tipo, espaço), componentes, as 4 abas, fluxo de treino, página do exercício, acessibilidade e mapeamento para o código atual |
| [`prototype/index.html`](prototype/index.html) | Protótipo navegável em um único arquivo, com dados de exemplo gerados e as fotos reais do app |

## Como abrir o protótipo

Abra `design/prototype/index.html` direto no navegador (as fotos vêm de `app/src/main/assets/photos/`, então abra a partir do repositório clonado). Funciona melhor na largura de celular; no computador, a coluna fica centralizada.

Atalhos: `/` ou `Ctrl+K` abre a busca, `Esc` volta ou fecha.

Endereços diretos: `#treino`, `#hist`, `#perfil`, `#lib`, `#treino-ativo`, `#ex-bench`, `#ficha-A`, `#dia-AAAA-MM-DD`.

## O que dá para testar

- **Início**: próximo treino da rotina ABC, semana, nota do dia com peso e água, recordes recentes.
- **Treino ativo**: tabela Série · Anterior · kg · Reps · ✓, toque no ✓ usa o valor anterior e inicia o descanso, tipo de série (aquecimento, drop, falha), adicionar e apagar série com desfazer, trocar e reordenar exercício, minimizar com barra "Treino em andamento", finalizar com resumo e recordes.
- **Página do exercício**: gráfico de 1RM estimado, carga máxima ou volume com período, recordes, nota com links, histórico de séries, como fazer, "Aparece em".
- **Histórico**: mapa de frequência de 16 semanas, filtro por mês, feed de sessões e página da sessão.
- **Perfil**: peso corporal, volume semanal, melhores 1RM, tema escuro/claro/sistema, módulos opcionais, exportar backup.
- **Busca**: ações, exercícios, fichas, sessões e dias num só lugar.

Itens marcados como "previsto na especificação" mostram um aviso em vez de funcionar (editar ficha, importar backup, vídeo, balança).
