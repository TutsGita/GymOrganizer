# Gym Organizer

Aplicativo Android offline para montar fichas, registrar treinos e acompanhar a evolução de carga. O catálogo, as fotos e o histórico ficam no aparelho.

## O que dá para fazer

- Monte e reordene fichas com séries, repetições, carga e notas. Use o catálogo com fotos ou cadastre seus próprios exercícios.
- Treine no modo guiado, com contador de descanso, ou no modo planilha, marcando séries e exercícios. Registre técnicas como drop set e adicione notas.
- Organize fichas por dia da semana ou em sequência (A, B, C). Veja os grupos musculares trabalhados em cada ficha e no plano.
- Consulte no calendário os treinos realizados, o tempo acumulado na semana e a evolução de carga.

## Compilar

Requer JDK 17 e Android SDK 35. O app roda em Android 8.0 ou superior. A primeira compilação precisa de internet para baixar as dependências; o uso do app é offline.

No Windows, execute `.\gradlew.bat :app:assembleDebug`. No Linux ou macOS, execute `./gradlew :app:assembleDebug`. O APK de teste fica em `app/build/outputs/apk/debug/app-debug.apk`.

## Roadmap

- Backup e restauração de fichas e histórico.
- Exportação de fichas em PDF.
- Tabela nutricional com registro de refeições.
- Consulta opcional de novas versões no GitHub Releases.

## Licenças e créditos

- [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) — 876 exercícios e 1.746 fotos ([Unlicense](app/src/main/assets/LICENSE-exercises.txt)).
- [MingCute](https://github.com/mingcute-design/mingcute-icons) — ícones ([Apache 2.0](app/src/main/assets/LICENSE-mingcute.txt)).
- [Body Muscles](https://github.com/emmorts/body-muscles) — mapa muscular, com arte de Ivan Vulović ([Apache 2.0](app/src/main/assets/LICENSE-body-muscles.txt), [atribuições](app/src/main/assets/NOTICE-body-muscles.txt)).

A licença do código do Gym Organizer ainda não foi definida.
