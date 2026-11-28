# Arquitetura alvo e plano de migração

Base: versão 0.4.1 e a [análise de otimizações e redesign](https://claude.ai/artifact/Tzd6QUB22TPBZ8MnHDU6fv).
Objetivo: sair de 14 scripts globais com um único JSON no `localStorage` para um app em módulos, com dados seguros, catálogo único em português, build e testes, sem parar de lançar versões.

## 1. Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Plataforma | Continua Android nativo fino + WebView. | Funciona, é offline e o Java já cobre balança, PDF, lembretes e updates. |
| Origem da WebView | Trocar `file:///android_asset/` por `https://appassets.androidplatform.net/` com `WebViewAssetLoader` (androidx.webkit). | ES modules e `fetch` de JSON não funcionam em `file://`. É o caminho recomendado pelo Android. |
| Build web | Vite. Fonte em `web/`, saída gerada em `app/build/generated/web/` e registrada como pasta de assets no Gradle. | Bundler padrão, rápido, com `import.meta.glob` para registrar telas sem arquivo central. |
| UI | Preact + `@preact/signals` (cerca de 5 KB). | Atualiza só o que mudou (fim do `innerHTML` total), modelo de componentes conhecido, leve para WebView. |
| Armazenamento | IndexedDB com coleções separadas e versão de esquema. Wrapper `idb`. | Grava só o registro alterado, sem limite de 5 MB, sem duplicar o esquema em Java. Room foi descartado: exigiria ponte JSON a cada leitura. |
| Proteção de dados | Backup JSON manual (exportar e importar), espelho automático em arquivo nativo e Auto Backup do Android ligado só para a pasta de backups. | Cobre desinstalação, troca de celular e a própria troca de origem da WebView. |
| Catálogo | Um script Node gera no build `catalog/index.json` (lista leve, PT) e `catalog/details/<n>.json` (instruções e mídia, em lotes). | Remove 1,7 MB de JS e a mescla em memória ao abrir. |
| Testes | Vitest (+ `fake-indexeddb`) para JS, JUnit para Java, Playwright para fumaça da web, GitHub Actions para tudo e para gerar o APK. | Hoje só existe um teste Java fora do source set. |

## 2. Estrutura de pastas

```
web/
  index.html
  src/
    main.jsx              # inicia store, roteador e casca
    core/                 # router (pilha de telas), events, ids, numbers (parse "72,5"), dates, flags
    data/
      db.js               # abre o IndexedDB, versão do esquema
      migrations/         # v1-blob -> v2, e as próximas
      repos/              # plans, programs, sessions, profiles, measurements, wellness, activities, settings, customExercises
      backup/             # export/import JSON e CSV, validação do formato
    domain/               # regras puras, sem DOM e sem banco (100% testadas)
      body-composition.js nutrition-goals.js xp.js achievements.js missions.js
      records.js (PR, 1RM Epley) progression.js volume.js habits.js
    catalog/              # loader (index + detalhes sob demanda), busca
    platform/             # bridge.js: única porta para window.GymWellness/GymPlan/GymScreen/GymBackup, com fake para o navegador
    ui/                   # tokens.css (tema único com variações), componentes base, ícones
    features/<nome>/      # cada tela: screen.jsx, actions.js, route.js (auto-registrada)
      home workout history exercise routines profile scale nutrition achievements missions activities settings
  tests/                  # *.test.js espelhando src/
  e2e/                    # Playwright, roda contra o build com o bridge fake
tools/catalog/build.mjs   # substitui a mescla em runtime; lê as fontes de tools/ e gera os JSON
app/src/main/java/...     # Android (ver seção 5)
app/src/test/java/...     # JUnit (ScalePacketsTest vem para cá)
```

Regras de dependência: `features` → `domain`, `data`, `catalog`, `ui`, `platform`. `domain` não importa nada do app. `data` não importa `features`. Um lint (`eslint-plugin-boundaries` ou `import/no-restricted-paths`) garante isso.

## 3. Modelo de dados (IndexedDB `gym-organizer`, esquema v2)

| Store | Chave | Conteúdo | Origem no blob v1 |
| --- | --- | --- | --- |
| `profiles` | `id` | nome, altura, dados de perfil, hábitos | `scaleProfiles` |
| `plans` | `id` | ficha com exercícios | `plans` |
| `programs` | `id` | rotina/pasta com sequência de fichas | `programs` |
| `sessions` | `id` (novo, fixo) | treino feito: `profileId`, data, séries com `kind` (normal, aquecimento, drop, falha) | `history` |
| `activeSession` | `"current"` | treino em andamento, salvo a cada série | `gym-organizer-v1-active-session` |
| `measurements` | `id`, índice `profileId+date` | pesagens e composição | `scaleProfiles[].weights` |
| `wellness` | `profileId+date` | água e alimentação do dia | `scaleProfiles[].wellness` |
| `activities` | `id` | corridas e pedais | perfil |
| `customExercises` | `id` | exercícios do usuário | `custom` |
| `settings` | chave | descanso, tema, flags de módulos, perfil ativo | `rest`, `scaleProfileId`, `gym-organizer-theme` |
| `derived` | chave | cache de XP, conquistas, recordes; invalidado quando `sessions` muda | novo |

Cada store tem um repositório com `get`, `list`, `put`, `delete` e um evento de mudança. Telas nunca acessam o IndexedDB direto.

Decisão pendente do Arthur: fichas por perfil ou compartilhadas. O esquema já suporta `profileId` opcional em `plans`; o padrão continua compartilhado.

## 4. Backup e exportação

- Formato único: `{ "format": "gym-organizer-backup", "schemaVersion": 2, "appVersion", "exportedAt", "data": { <store>: [...] } }`. A importação aceita também o blob v1 cru e passa pelas mesmas migrações.
- Exportar e importar pelo seletor de arquivos do Android (SAF) via `GymBackup` no Java. Importar sempre mostra um resumo e faz um backup automático antes de substituir.
- Espelho automático: a cada gravação (com debounce de 5 s) o JS envia o backup para `GymBackup.mirror(json)`, que guarda em `filesDir/backups/` os últimos 7 dias.
- `allowBackup="true"` com `dataExtractionRules`/`fullBackupContent` incluindo só `backups/`. Assim o Google restaura os dados ao reinstalar ou trocar de celular.
- CSV de séries e pesagens gerado em `data/backup/csv.js`.

## 5. Android

- `MainActivity` fica só com ciclo de vida e montagem da WebView. Sai para classes próprias: `WebShell` (WebViewAssetLoader, CSP, allowlist), `Insets`, `PlanExporter`, `CardExporter`, `BackupBridge`, `ScreenAppearance`.
- Lista de URLs permitidas sai do regex para `UrlPolicy` com uma lista de hosts e teste JUnit.
- Descanso: `RestTimerService` com notificação, chamado pelo bridge. O `setInterval` de 250 ms passa a existir só na tela de treino ativo.
- `tests/ScalePacketsTest.java` vai para `app/src/test/java` e roda no `./gradlew test`.

## 6. Plano de migração

Cada tarefa é um PR pequeno, com dono de arquivos definido. Duas tarefas da mesma fase não editam os mesmos arquivos. Quando uma tarefa precisa tocar um arquivo compartilhado, isso está escrito nela.

### Fase 0: proteger os dados no app atual (lançar como 0.4.2)

Feita no código legado, antes da troca de origem. A 0.4.2 precisa estar instalada antes da 0.5, porque é ela que cria o espelho que a 0.5 importa.

| ID | Tarefa | Arquivos | Paralelo com |
| --- | --- | --- | --- |
| 0.1 | Ids fixos nas sessões do histórico. Migração na leitura gera `id` para registros antigos. Trocar `history[index]` por busca por `id`. | `app.js` (só `readState`), `training-log.js`, `achievements.js` | 0.2, 0.3 |
| 0.2 | `BackupBridge.java`: exportar e importar via SAF e `mirror()` para `filesDir/backups/`. Regras de Auto Backup no manifesto. | `BackupBridge.java`, `AndroidManifest.xml`, `res/xml/`, uma linha em `MainActivity` | 0.1, 0.3 |
| 0.3 | `backup.js` legado: montar o JSON do formato acima a partir do blob, botões Exportar e Importar em Perfil, chamar `mirror()` após `save()`. | `backup.js` (novo), `profile.js`, `index.html`, `save()` em `app.js` | 0.1, 0.2 (combinar a interface do bridge antes) |
| 0.4 | QA: testes manuais de exportar, desinstalar, reinstalar e importar; perda zero. | nenhum | depois de 0.1 a 0.3 |

### Fase 1: fundação (sequencial, um dev)

| ID | Tarefa |
| --- | --- |
| 1.1 | `web/` com Vite, Vitest, ESLint, Prettier e `package.json`. Os scripts legados vão para `web/legacy/` e são copiados como estão (scripts clássicos), então o app roda idêntico. Gradle chama `npm run build` antes de `mergeAssets` e lê de `app/build/generated/web/`. |
| 1.2 | `WebShell` com `WebViewAssetLoader` e CSP ajustada. Na primeira abertura na nova origem, se o `localStorage` estiver vazio e houver espelho, importar o espelho. |
| 1.3 | CI no GitHub Actions: lint, Vitest, build web, `./gradlew test assembleDebug`, APK como artefato. ScalePacketsTest movido. |
| 1.4 | `platform/bridge.js` e `window.GO`: ponte para o legado chamar módulos novos. É por ela que o legado vai sendo substituído aos poucos. |

### Fase 2: camadas puras (paralelo, depois da Fase 1)

Quase só arquivos novos. Cada tarefa termina trocando as funções antigas do legado por chamadas a `window.GO`, apenas no arquivo indicado.

| ID | Tarefa | Arquivos novos | Legado tocado |
| --- | --- | --- | --- |
| 2.A | Composição corporal e metas de nutrição, com testes contra os valores atuais. | `domain/body-composition.js`, `domain/nutrition-goals.js` | `wellness.js`, `profile.js` |
| 2.B | XP, conquistas e missões puros, com cache em `derived`. | `domain/xp.js`, `achievements.js`, `missions.js` | `achievements.js`, `missions.js` |
| 2.C | Utilitários: números com vírgula, datas, ids. | `core/numbers.js`, `dates.js`, `ids.js` | `training-log.js`, `activities.js` |
| 2.D | Catálogo único: `tools/catalog/build.mjs`, loader e busca. Legado passa a usar o loader no lugar de `loadCatalog()`. | `tools/catalog/`, `catalog/` | `loadCatalog` em `app.js`; remove `catalog*.js`, `wger-*.js`, `exercise-media.js` dos assets |
| 2.E | Camada de dados: IndexedDB, repositórios, migração v1 para v2, backup v2 e CSV. Legado lê e grava pelos repositórios. Mantém o espelho. | `data/` | `readState`/`save` em `app.js`, `backup.js` |
| 2.F | Android: dividir `MainActivity`, `UrlPolicy` com teste, `RestTimerService`. | classes Java novas | `MainActivity.java` |
| 2.G | UI/UX: sistema visual (tokens, tipografia, componentes base, ícones) e protótipos das telas novas. | `ui/` | nenhum |

2.D e 2.E tocam `app.js` em funções diferentes; quem abrir o PR depois faz rebase. 2.E é a tarefa de maior risco e vai para o dev mais experiente, com revisão do arquiteto.

### Fase 3: nova interface por tela (paralelo, depois de 2.E e 2.G)

| ID | Tarefa |
| --- | --- |
| 3.0 | Casca nova: roteador com pilha, barra de 4 abas, paleta de comandos, flag `newUi` por rota. Telas sem versão nova abrem o legado. Um dev, antes das outras. |
| 3.1 | Treino ativo estilo Hevy: coluna Anterior, edição na linha, tipos de série, descanso no rodapé com notificação, resumo final. Prioridade máxima. |
| 3.2 | Página de exercício: gráfico de progresso, recordes, 1RM, notas Markdown com `[[links]]`, "aparece em". |
| 3.3 | Histórico: feed de sessões, mapa de calor, gráficos de peso e volume, nota diária. |
| 3.4 | Rotinas e fichas: pastas, próxima ficha na Início, duplicar, criar a partir de um treino, PDF. |
| 3.5 | Perfil, balança e configurações (inclui backup e flags de módulos opcionais). |
| 3.6 | Nutrição, conquistas, missões e atividades. |

Cada tarefa mexe só em `web/src/features/<nome>/`. As rotas se registram sozinhas por `import.meta.glob`, então não há arquivo central para conflitar.

### Fase 4: limpeza

Remover `web/legacy/`, a leitura do `localStorage` e do espelho antigo (manter a importação de backup v1), `window.GO`, e os scripts de catálogo antigos. Depois disso, as melhorias extras da análise (calculadora de anilhas, superséries, widget, sugestão de progressão) entram como features normais.

## 7. Regras para o time

- Um PR por tarefa, branch `feat/<id>-<nome>`, base `main`. CI verde e revisão antes do merge.
- Não editar arquivos fora da lista da tarefa. Se precisar, avisar o orquestrador antes.
- Toda mudança de esquema entra como migração nova em `data/migrations/` com teste de ida a partir de um backup real anonimizado em `web/tests/fixtures/`.
- Regras de negócio novas entram em `domain/` com teste. Tela não calcula nada.
- QA valida cada fase em aparelho antes do lançamento: 0.4.2 (Fase 0), 0.5 (Fases 1 e 2), 0.6 em diante (cada tela da Fase 3).

## 8. Time sugerido e modelos

| Papel | Modelo | Por quê |
| --- | --- | --- |
| Orquestrador | Opus | Distribui tarefas, resolve conflitos e decide a ordem. Pouco volume, muito julgamento. |
| Arquiteto | Opus | Dono deste documento, revisa 1.x, 2.E e 2.F. |
| Dev dados e Android (0.2, 1.x, 2.E, 2.F) | Opus | Migração de dados e ponte Java são onde um erro perde dados do usuário. |
| Devs de features e domínio (0.1, 0.3, 2.A a 2.D, 3.x) | Sonnet | Tarefas bem delimitadas, com testes; bom custo e velocidade. Dois ou três em paralelo. |
| UI/UX (2.G, protótipos da Fase 3) | Opus para o sistema visual, Sonnet para aplicar nas telas | O sistema visual define tudo o que vem depois. |
| QA (0.4 e validação de cada fase) | Sonnet | Escreve testes de fumaça Playwright e roteiros de teste em aparelho. |
