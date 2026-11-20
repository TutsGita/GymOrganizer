# Gym Organizer

Aplicativo Android de treino pessoal. As fichas, as sessões e o histórico ficam no aparelho. O catálogo e as fotos vêm no APK, e o aplicativo não solicita acesso à internet.

## Como usar

1. Em **Treinos**, toque em **Criar treino**. Dê um nome à ficha, adicione exercícios e defina séries, repetições e a carga em kg.
2. Na ficha salva, toque em **Iniciar treino**. O **Treino guiado** abre um contador de descanso ao marcar uma série. Defina o intervalo em segundos ou use 0 para desativá-lo.
3. No **Modo planilha**, marque cada série separadamente ou use **Exercício completo** para marcar todas de uma vez.
4. Toque em **Finalizar treino** para registrar a sessão no **Calendário**. Você pode fechar o aplicativo e retomar uma sessão em andamento.

Toque no exercício para abrir os detalhes e na foto para ampliá-la. Durante o treino, **Registrar carga e notas** permite ajustar as séries, escolher o método e anotar como o exercício foi feito. No **Calendário**, selecione um dia para ver os treinos e o resumo da semana. A evolução compara a maior carga das séries concluídas em cada sessão.

Na edição da ficha, use **Subir** e **Descer** para mudar a ordem e escreva notas na ficha ou em cada exercício. Cadastre exercícios próprios em **Exercícios** ou ao adicionar um exercício à ficha.

Em **Planos**, crie uma sequência com fichas A, B, C etc. ou associe fichas aos dias da semana. Ao finalizar uma sessão iniciada pela sequência, o plano destaca a próxima etapa. **Ver ficha** mostra a cobertura muscular daquela ficha. O painel do plano reúne a cobertura de todas as etapas e contabiliza as séries prescritas por músculo principal e secundário.

O catálogo aceita buscas pelo nome original, por nomes em português já cadastrados, por músculo e por equipamento. As instruções de execução mantêm o inglês da fonte. O contador acompanha o tempo decorrido ao voltar ao aplicativo e avisa na tela quando estiver aberto. Desinstalar ou limpar os dados do aplicativo apaga as fichas e o histórico.

## Compilar

1. Abra esta pasta no Android Studio com JDK 17 e Android SDK 35 instalado.
2. Sincronize o Gradle. No Windows, use também `.\gradlew.bat :app:assembleDebug`.
3. Instale `app/build/outputs/apk/debug/app-debug.apk` em um aparelho com Android 8.0 ou posterior e Android System WebView atualizado.

A sincronização inicial do projeto precisa de internet para obter ferramentas de compilação. A interface usa o WebView do próprio Android e inclui os arquivos estáticos localmente.

## Catálogo e ícones

- [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), revisão `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`. São 876 exercícios e 1.746 fotos. As imagens foram reduzidas localmente para até 320 px no lado maior. A licença da fonte está em `app/src/main/assets/LICENSE-exercises.txt`.
- [MingCute](https://github.com/mingcute-design/mingcute-icons), ícones Filled distribuídos por `@iconify-json/mingcute@1.2.3`. A licença Apache 2.0 está em `app/src/main/assets/LICENSE-mingcute.txt`.
- O mapa muscular usa os vetores de [@emmorts/body-muscles](https://emmorts.github.io/body-muscles/) 2.1.1, com arte anatômica de Ivan Vulović. Os arquivos de licença Apache 2.0 e de atribuição estão em `app/src/main/assets`.

Para atualizar a base, clone o Free Exercise DB em `.catalog-source` e execute `tools/prepare-catalog.ps1` no PowerShell. O catálogo utilizado pela busca é definido em `app/src/main/assets/catalog.js`. Esta versão consulta exclusivamente a base local Free Exercise DB.
