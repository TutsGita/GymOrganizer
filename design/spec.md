# GymOrganizer · Especificação da nova interface

Versão 1 · 28/11/2026 · baseada no app 0.4.1 e na análise "GymOrganizer: análise e proposta de redesign".

Esta pasta descreve a interface nova. Nada aqui altera o app atual em `app/`. O protótipo navegável está em [`prototype/index.html`](prototype/index.html).

## 1. Princípios

1. **Registrar uma série leva um toque.** A tela de treino ativo é a mais importante do app. Carga e reps vêm preenchidas com o que você fez da última vez; o ✓ conclui a série e inicia o descanso.
2. **Tudo é uma página, e páginas se ligam.** Exercício, ficha, sessão e dia são páginas com links entre si (`[[Supino reto]]`) e uma seção "Aparece em", como os backlinks do Obsidian.
3. **Uma busca para tudo.** A paleta de comandos acha exercício, ficha, sessão, dia ou ação a partir de qualquer tela.
4. **Escuro, plano e silencioso.** Sem gradientes, vidro ou sombras. Uma cor de destaque (roxo) e verde só para série concluída. Os números (kg, reps, tempo) são o que tem peso visual.
5. **Progresso visível.** Coluna "Anterior", recordes automáticos, 1RM estimado e gráficos por exercício.

## 2. Tokens

Os tokens substituem as paletas independentes de `themes.js`. Um tema novo só troca valores, nunca nomes.

### 2.1 Cor

| Token | Escuro (padrão) | Claro | Uso |
|---|---|---|---|
| `--bg` | `#161618` | `#fbfbfc` | Fundo da tela |
| `--surface` | `#1e1e21` | `#f3f3f5` | Cartões, linhas de lista, barra inferior |
| `--surface-2` | `#27272b` | `#e9e9ed` | Campos, linha de série, chips |
| `--surface-3` | `#323237` | `#dddde3` | Pressionado, linha selecionada |
| `--border` | `#2c2c31` | `#e2e2e7` | Divisórias de 1 px |
| `--border-strong` | `#3b3b42` | `#cfcfd6` | Contorno de campo e botão secundário |
| `--text` | `#e4e4e7` | `#1b1b1f` | Texto principal |
| `--text-muted` | `#a1a1aa` | `#5d5d66` | Texto secundário, rótulos |
| `--text-faint` | `#71717a` | `#8a8a93` | Placeholder, coluna "Anterior" |
| `--accent` | `#9d8cff` | `#6a55e0` | Ação primária, link, aba ativa, gráfico |
| `--accent-soft` | `#9d8cff1f` | `#6a55e014` | Fundo de item ativo, chip selecionado |
| `--on-accent` | `#14102b` | `#ffffff` | Texto sobre o roxo |
| `--done` | `#4ade80` | `#16a34a` | Série concluída, ✓ |
| `--done-soft` | `#4ade801a` | `#16a34a14` | Fundo de linha concluída |
| `--warmup` | `#fbbf24` | `#b45309` | Série de aquecimento (A) |
| `--drop` | `#60a5fa` | `#2563eb` | Drop set (D) |
| `--failure` | `#f87171` | `#dc2626` | Falha (F) e ações destrutivas |
| `--record` | `#f5c451` | `#a16207` | Troféu de recorde pessoal |

Regras:
- O roxo é a única cor de marca. Verde, amarelo, azul e vermelho só aparecem com significado (concluído, tipo de série, perigo, recorde) e sempre junto de texto ou ícone, nunca só a cor.
- Contraste mínimo AA: `--text` e `--text-muted` sobre `--bg` e `--surface` passam 4,5:1 nos dois temas; `--text-faint` é só para informação repetida (coluna Anterior), nunca para a única cópia de um dado.
- Sobre `--accent` use sempre `--on-accent`.

### 2.2 Tipografia

Família: `Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. No app Android, empacotar Inter (variável, ~300 KB) em `assets/fonts/` porque a CSP bloqueia fontes externas; sem ela, cai para Roboto sem prejuízo.

Números sempre com `font-variant-numeric: tabular-nums`.

| Token | Tamanho / altura | Peso | Uso |
|---|---|---|---|
| `--fs-display` | 32 / 36 | 700 | Cronômetro do treino, número de destaque |
| `--fs-title` | 22 / 28 | 650 | Título da página |
| `--fs-heading` | 17 / 24 | 600 | Título de seção, nome do exercício no treino |
| `--fs-body` | 15 / 22 | 400 | Texto, linhas de lista |
| `--fs-input` | 17 / 24 | 600 | kg e reps dentro da linha de série |
| `--fs-small` | 13 / 18 | 450 | Metadados, legenda |
| `--fs-label` | 11 / 14 | 600, caixa alta, +0,06em | Cabeçalho de tabela e de grupo |

Títulos de página são pequenos de propósito (22 px). O tamanho grande fica para números que importam.

### 2.3 Espaço, forma e movimento

- Base de 4 px: `--s1` 4, `--s2` 8, `--s3` 12, `--s4` 16, `--s5` 20, `--s6` 24, `--s8` 32.
- Margem lateral da tela: 16 px (mais a área segura do aparelho).
- Raios: `--r-sm` 4 px (chips, campos), `--r-md` 8 px (cartões, botões), `--r-lg` 14 px (folhas inferiores). Nada de pílulas exceto o chip de filtro.
- Alvo de toque mínimo 44 × 44 px (o app hoje usa 46; manter).
- Movimento: 160 ms `cubic-bezier(.2,.7,.3,1)` para trocas de tela e folhas; `prefers-reduced-motion` desliga tudo menos opacidade.
- Sem sombras. Hierarquia vem de superfície (`--surface` sobre `--bg`) e de divisórias de 1 px.

### 2.4 Ícones

Ícones de linha, traço 1,75 px, grade de 24 px, cantos arredondados (estilo Lucide, licença ISC). Substituem os ícones preenchidos de `icons.js`. Tamanho 20 px em listas, 22 px na barra inferior.

## 3. Estrutura e navegação

```
Barra inferior (4 abas)
├── Início      → nota do dia, próximo treino, semana, atalhos
├── Treino      → rotinas (pastas) → fichas → iniciar
│                 biblioteca de exercícios
├── Histórico   → mapa de frequência, feed de sessões → sessão
└── Perfil      → peso corporal, estatísticas, recordes, ajustes, módulos

Sobrepostos a qualquer aba
├── Busca (paleta de comandos)
├── Treino ativo (tela cheia)  + barra "Treino em andamento" quando minimizado
└── Páginas: Exercício · Ficha · Sessão · Dia
```

- **Pilha de telas.** Cada aba tem sua própria pilha. Abrir uma página empilha; Voltar (gesto ou botão do Android) desempilha. Tocar na aba já ativa volta para a raiz dela. Isso substitui a cadeia de `if` em `back()`.
- **Endereços.** Toda página tem um endereço (`#ex/Barbell_Squat`, `#sessao/<id>`, `#dia/2026-11-28`, `#ficha/<id>`) para que links de notas e da busca funcionem igual.
- **Nutrição, água, missões e conquistas** saem da barra. Água e alimentação aparecem na nota do dia (Início); conquistas e missões em Perfil, como módulos que podem ser desligados.
- **Tablet e paisagem** (largura ≥ 840 px): lista à esquerda (360 px) e página à direita, a barra inferior vira trilho lateral.

## 4. Componentes

### 4.1 Barra superior
Altura 52 px, fundo `--bg`, sem borda até a página rolar (aí ganha `--border` embaixo). Esquerda: Voltar (só em páginas empilhadas). Centro/esquerda: título `--fs-title` nas raízes das abas, `--fs-heading` nas páginas. Direita: Busca e no máximo uma ação.

### 4.2 Barra inferior
Altura 56 px + área segura, fundo `--surface`, borda superior `--border`. Quatro itens iguais com ícone e rótulo `--fs-small`. Ativo: ícone e texto `--accent`. Sem botão central elevado.

Quando há treino ativo e o usuário está fora dele, uma **barra de treino em andamento** fica logo acima: nome da ficha, cronômetro e "Retomar". Toque abre o treino.

### 4.3 Linha de lista
Item padrão de tudo (exercícios, fichas, sessões, ajustes). Altura mínima 56 px, padding 12/16. Esquerda: miniatura 40 px (`--r-sm`) ou ícone. Meio: título `--fs-body` 500 e metadado `--fs-small --text-muted`. Direita: valor ou chevron. Grupos de linhas ficam dentro de um bloco `--surface` com `--r-md` e divisórias internas; não há cartão por linha.

### 4.4 Botões
- **Primário**: fundo `--accent`, texto `--on-accent`, 48 px de altura, `--r-md`. No máximo um por tela.
- **Secundário**: fundo `--surface-2`, texto `--text`.
- **Fantasma**: só texto `--accent`, para ações de linha ("+ Adicionar série").
- **Perigo**: texto `--failure`; ações que apagam pedem confirmação em folha inferior, nunca `confirm()`.

### 4.5 Tabela de séries (treino ativo)
O coração do app. Colunas fixas:

| Série | Anterior | kg | Reps | ✓ |
|---|---|---|---|---|
| 40 px | flexível | 72 px | 64 px | 44 px |

- **Série**: número, ou letra do tipo (A aquecimento, D drop, F falha) na cor do tipo. Tocar abre o menu de tipo.
- **Anterior**: "60 × 10" da mesma série na última sessão com esse exercício, em `--text-faint`. Tocar copia para kg e reps.
- **kg / Reps**: campos numéricos `--fs-input`, fundo `--surface-2`. Vazios mostram o valor anterior como placeholder; ao concluir sem digitar, o placeholder vira o valor. Teclado numérico com vírgula decimal.
- **✓**: quadrado 32 px `--r-sm`. Concluído: fundo `--done`, a linha inteira ganha `--done-soft`, e começa o descanso.
- Deslizar a linha para a esquerda apaga a série.
- Aquecimento não conta no volume nem em recordes.

### 4.6 Barra de descanso
Fixa acima da área segura no treino ativo. Contagem `--fs-heading`, barra de progresso de 3 px em `--accent`, botões −15 s, +15 s e Pular. No Android, mesmo tempo em notificação para funcionar com a tela apagada.

### 4.7 Paleta de comandos (busca)
Abre pelo ícone de lupa em qualquer barra superior (e pela tecla `/` ou Ctrl+K no tablet com teclado). Folha de cima até 80 % da tela, campo no topo com foco automático. Resultados agrupados: **Ações** ("Iniciar Treino B", "Registrar peso", "Adicionar 250 ml de água"), **Exercícios**, **Fichas**, **Sessões**, **Dias**. Busca ignora acento e caixa. Vazia, mostra recentes e ações frequentes. Setas e Enter funcionam com teclado.

### 4.8 Link e "Aparece em"
- Notas aceitam Markdown simples (negrito, lista, título) e `[[Nome]]`. Um link conhecido vira texto `--accent`; um desconhecido fica tracejado e, ao tocar, oferece criar o exercício personalizado.
- Toda página termina com **Aparece em**: fichas que usam o item, sessões recentes e notas que citam o item.

### 4.9 Gráficos
- Linha de 2 px em `--accent`, pontos de 8 px só no último valor e no recorde, grade horizontal em `--border`, eixos em `--text-muted --fs-small`. Uma série por gráfico, sem legenda (o título nomeia).
- Tocar ou arrastar mostra guia vertical e balão com data e valor.
- Barras (volume semanal): `--accent`, cantos de 4 px no topo, 2 px de espaço entre barras.
- Mapa de frequência: 7 linhas × N semanas, quadrados de 12 px, intensidade em 4 passos de `--accent` sobre `--surface-2`; dia sem treino é `--surface-2`.
- Todo gráfico tem um resumo em texto acima ("Recorde 100 kg · +12,5 kg em 10 semanas").

### 4.10 Folha inferior
Para escolhas e confirmações: fundo `--surface`, `--r-lg` no topo, alça de 36 × 4 px, fecha arrastando ou tocando fora. Substitui os `<dialog>` centrais atuais.

### 4.11 Estado vazio
Uma frase sobre o que aparece ali e um botão para criar o primeiro item. Sem ilustração.

## 5. Telas

### 5.1 Início
Ordem de cima para baixo:
1. Saudação curta com data ("Sábado, 28 de novembro") e lupa.
2. **Próximo treino**: bloco com a rotina, a próxima ficha da sequência, quantos exercícios e quando foi a última vez. Botão primário "Iniciar treino". Linha secundária "Escolher outra ficha".
3. **Semana**: 7 dias (S T Q Q S S D) com ponto preenchido nos dias treinados e meta semanal ("3 de 4").
4. **Nota do dia**: peso de hoje (ou "Registrar peso"), água com +250 ml e meta, e uma linha de texto livre. Tocar abre a página do dia.
5. **Recordes recentes**: até 3 linhas com troféu, exercício e valor.

### 5.2 Treino
1. Botão "Iniciar treino vazio".
2. **Rotinas** como pastas expansíveis (ex.: "Hipertrofia ABC"). Dentro, as fichas na ordem, a próxima marcada com "Próxima". Cada ficha: nome, músculos, número de exercícios e botão Iniciar.
3. "Nova rotina" e "Nova ficha".
4. **Exercícios**: entrada para a biblioteca (1.298 exercícios), com filtro por músculo e equipamento em chips.

### 5.3 Página da ficha
Lista de exercícios com séries × reps, descanso e a última carga usada. Nota da ficha. Ações: Iniciar, Editar, Duplicar, Compartilhar (texto ou PDF). "Aparece em": rotinas.

### 5.4 Treino ativo (tela cheia)
- Barra superior: Minimizar (chevron para baixo), nome da ficha, cronômetro corrido, botão "Finalizar" (fantasma verde).
- Linha de resumo: volume até agora e séries concluídas / total.
- Para cada exercício: miniatura, nome (link para a página do exercício), menu ⋯ (trocar, reordenar, nota, remover), nota fixada se houver, tabela de séries (4.5), "+ Adicionar série".
- Rodapé: "+ Adicionar exercício", depois a barra de descanso (4.6) quando ativa.
- **Finalizar** abre folha de resumo: duração, volume, séries, recordes batidos (com troféu), nota da sessão, e a opção "Atualizar ficha com as cargas de hoje". Se houver séries não concluídas, a folha avisa e oferece descartá-las.

### 5.5 Página do exercício
1. Foto (proporção 4:3, `--r-md`) e botão de vídeo.
2. Nome, músculos principais e secundários como chips, equipamento.
3. Abas internas: **Resumo**, **Histórico**, **Como fazer**.
   - Resumo: frase-resumo, gráfico com seletor (Carga máxima, 1RM estimado, Volume) e período (3 m, 6 m, Tudo), recordes (maior carga, melhor 1RM por Epley, maior volume numa sessão, mais reps), nota do exercício.
   - Histórico: sessões em ordem decrescente com todas as séries, cada uma levando à página da sessão.
   - Como fazer: passos numerados e créditos da mídia.
4. "Aparece em": fichas e sessões.

### 5.6 Histórico
1. Mapa de frequência das últimas 16 semanas, com total do período.
2. Filtro por mês.
3. Feed de sessões: nome, data relativa, duração, volume, número de recordes, e as três primeiras linhas "4 × Supino reto". Tocar abre a sessão.

### 5.7 Página da sessão
Cabeçalho com data (link para o dia), duração, volume e recordes. Cada exercício com suas séries (aquecimento em amarelo, recorde com troféu). Nota da sessão com links. Ações: Editar, Repetir este treino, Salvar como ficha, Excluir.

### 5.8 Página do dia (nota diária)
Junta tudo daquele dia: treino(s), peso, água, alimentação (se o módulo estiver ligado) e a nota livre. Setas para dia anterior e seguinte.

### 5.9 Perfil
1. Nome e perfil ativo da balança (troca de perfil em folha).
2. Estatísticas: treinos, volume total, sequência de semanas.
3. Gráfico de peso corporal (30 d, 90 d, 1 a) e botão "Registrar peso" (manual ou balança Bluetooth).
4. Volume semanal (barras das últimas 8 semanas).
5. Recordes pessoais (lista, leva a cada exercício).
6. Ajustes: tema (Escuro, Claro, Sistema), unidade, descanso padrão, **Módulos** (Nutrição, Água, Conquistas, Missões, cada um com chave liga/desliga), **Backup** (Exportar JSON, Importar, Exportar CSV), Sobre.

## 6. Estados e microcopy

- Tom: direto, segunda pessoa, sem exclamações. "Treino salvo", "Peso registrado", "Série apagada · Desfazer".
- Desfazer em toast por 5 s para apagar série, exercício ou sessão.
- Números em pt-BR: vírgula decimal (82,4 kg), milhar com ponto (12.450 kg).
- Datas relativas até 6 dias ("hoje", "ontem", "há 3 dias"), depois "21 nov".

## 7. Acessibilidade

- TalkBack: cada linha de série lê "Série 2, anterior 60 quilos por 10, 62,5 quilos, 8 repetições, não concluída".
- Área de toque ≥ 44 px, foco visível em `--accent` 2 px.
- Tipo de série e recordes nunca só pela cor: letra e ícone sempre presentes.
- Respeitar o tamanho de fonte do sistema até 130 % sem cortar a tabela de séries (as colunas kg e Reps crescem, Anterior encolhe e trunca).

## 8. Mapeamento para o código atual

| Hoje | Novo |
|---|---|
| `themes.js` (paletas independentes) | Tokens da seção 2 em `tokens.css`, temas só trocam valores |
| `theme.css` com vidro e gradientes | Superfícies planas, sem `backdrop-filter` nem `radial-gradient` |
| Barra com 5 itens e botão central | 4 abas + barra de treino em andamento |
| `back()` com `if` por tela | Roteador com pilha por aba e endereços |
| `<dialog>` central | Folha inferior |
| Treino mostra carga planejada | Tabela com coluna Anterior e ✓ por série |
| `training-log.js` calendário | Mapa de frequência + feed |
| Nutrição e missões na barra | Módulos opcionais em Início e Perfil |

A implementação deve seguir a ordem da análise: primeiro backup e ids fixos, depois módulos e roteador, e então este sistema visual, começando pela tela de treino ativo.
