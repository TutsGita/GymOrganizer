<p align="center">
  <img src="assets/gym-organizer-logo.svg" alt="Gym Organizer — Train Smarter" width="520">
</p>

<p align="center">
  <a href="https://github.com/TutsGita/GymOrganizer/releases/download/v0.2.1/GymOrganizer-0.2.1.apk"><strong>⬇ Baixar APK 0.2.1</strong></a>
</p>

# Gym Organizer

Monte sua ficha, registre séries e acompanhe a evolução das cargas no Android. Treinos, fotos e histórico ficam no celular e funcionam offline.

- **Planejamento.** Organize as fichas por dia ou em sequência A/B/C. Escolha entre 876 exercícios com fotos ou cadastre os seus.
- **Durante o treino.** Marque séries, ajuste cargas, registre drop sets e controle o descanso.
- **Evolução.** Consulte frequência, tempo de treino e pesagens no calendário.

## Balanças Bluetooth

Em **Perfil**, toque em **Procurar balança** e faça a pesagem em kg. Confirme a leitura para salvá-la no calendário.

| Modelo ou protocolo | Dados recebidos |
| --- | --- |
| OKOK V20 e C0 | Peso e impedância quando transmitida |
| Xiaomi Mi Body Composition Scale 2 | Peso e impedância quando transmitida |
| PICOOC Mini Lite (PICOOC-L) | Peso e impedância quando transmitida |
| QN e Renpho com anúncio AABB, incluindo FITINDEX FT-26R | Peso |

A compatibilidade depende do protocolo do modelo. A versão 0.2.1 teve os formatos de dados verificados por testes de software. A leitura de peso OKOK também foi confirmada em aparelho físico.

O perfil calcula água corporal e gordura a partir das medidas cadastradas. A estimativa de massa muscular também usa a impedância. Equações de [Watson](https://doi.org/10.1093/ajcn/33.1.27), [Deurenberg](https://pubmed.ncbi.nlm.nih.gov/2043597/) e [Janssen](https://pubmed.ncbi.nlm.nih.gov/10926627/).

## Instalação e desenvolvimento

Baixe o APK no topo da página. Requer Android 8.0 ou superior. Para compilar, use JDK 17, Android SDK 35 e o comando `./gradlew :app:assembleDebug` (Windows: `.\gradlew.bat :app:assembleDebug`).

[Histórico de versões](CHANGELOG.md)

## Roadmap

Backup local e em nuvem, exportação de fichas em PDF, tabela nutricional e lembretes de água.

## Licenças e créditos

- **openScale**, de olie.xdev e colaboradores, é a referência dos protocolos Xiaomi, QN AABB e PICOOC Mini Lite. O projeto original declara GPL versão 3 ou posterior. Consulte o [repositório e aviso de licença](https://github.com/oliexdev/openScale#license) e a [documentação da Mi Scale](https://github.com/oliexdev/openScale/wiki/Xiaomi-Bluetooth-Mi-Scale).
- **100nandoo** documentou os formatos OKOK no [okok-bia-formulas, publicado sob AGPL-3.0](https://github.com/100nandoo/okok-bia-formulas). **ipanalytics** documentou os [campos do anúncio Xiaomi V2](https://github.com/ipanalytics/Xiaomi-Scale-Unlocked-Reverse-Engineering). Os leitores Android desta versão foram escritos para o Gym Organizer a partir das informações de protocolo. Nenhum desses aplicativos ou bibliotecas é empacotado no APK.
- [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) — 876 exercícios e 1.746 fotos ([Unlicense](app/src/main/assets/LICENSE-exercises.txt)).
- [MingCute](https://github.com/mingcute-design/mingcute-icons) — ícones ([Apache 2.0](app/src/main/assets/LICENSE-mingcute.txt)).
- [Body Muscles](https://github.com/emmorts/body-muscles) — mapa muscular, com arte de Ivan Vulović ([Apache 2.0](app/src/main/assets/LICENSE-body-muscles.txt), [atribuições](app/src/main/assets/NOTICE-body-muscles.txt)).

O código próprio do Gym Organizer é distribuído sob a [licença MIT](LICENSE). O catálogo, os ícones e os vetores mantêm as licenças indicadas acima.
