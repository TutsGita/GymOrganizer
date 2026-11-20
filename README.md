<p align="center">
  <img src="assets/gym-organizer-logo.svg" alt="Gym Organizer — Train Smarter" width="520">
</p>

<p align="center">
  <a href="https://github.com/TutsGita/GymOrganizer/releases/download/v0.2.0/GymOrganizer-0.2.0.apk"><strong>⬇ Baixar APK 0.2.0</strong></a>
</p>

# Gym Organizer

Aplicativo Android offline para montar fichas, registrar treinos e acompanhar a evolução de carga. O catálogo, as fotos e o histórico ficam no aparelho.

[Histórico de versões](CHANGELOG.md)

## O que dá para fazer

- Monte e reordene fichas com séries, repetições, carga e notas. Use o catálogo com fotos ou cadastre seus próprios exercícios.
- Treine no modo guiado, com contador de descanso, ou no modo planilha, marcando séries e exercícios. Registre técnicas como drop set e adicione notas.
- Organize fichas por dia da semana ou em sequência (A, B, C). Veja os grupos musculares trabalhados em cada ficha e no plano.
- Consulte no calendário os treinos realizados, o tempo acumulado na semana e a evolução de carga.

## Compilar

Requer JDK 17 e Android SDK 35. O app roda em Android 8.0 ou superior. A primeira compilação precisa de internet para baixar as dependências. O app funciona offline e só acessa a internet ao procurar atualizações.

No Windows, execute `.\gradlew.bat :app:assembleDebug`. No Linux ou macOS, execute `./gradlew :app:assembleDebug`. O APK de teste fica em `app/build/outputs/apk/debug/app-debug.apk`. A versão publicada também pode ser baixada pelo botão no início desta página.

## Roadmap

- Backup e restauração de fichas e histórico.
- Exportação de fichas em PDF.
- Tabela nutricional com registro de refeições.
- Backup e restauração na nuvem.
- Lembretes de água.

A consulta de atualização ao abrir o app e a distribuição pelo GitHub Releases já estão disponíveis.

## Balanças na versão 0.2

Em **Perfil**, salve altura, idade e sexo e procure a balança em kg. OKOK V20/C0 e Xiaomi Mi Body Composition Scale 2 têm leitores de anúncios Bluetooth LE. O suporte à Xiaomi é experimental. O app aguarda a impedância da mesma balança após receber o peso. Você pode encerrar a espera e registrar só o peso.

O perfil e o calendário mostram água corporal em litros e percentual ([Watson et al.](https://doi.org/10.1093/ajcn/33.1.27)), gordura estimada pelo IMC ([Deurenberg et al.](https://pubmed.ncbi.nlm.nih.gov/2043597/)) e, quando há impedância, massa muscular esquelética ([Janssen et al.](https://pubmed.ncbi.nlm.nih.gov/10926627/)). As estimativas usam o perfil atual. A equação muscular foi estudada com resistência corporal e sua aplicação a balanças de pés é aproximada. Os resultados podem diferir do aplicativo do fabricante.

## Licenças e créditos

- **openScale**, de olie.xdev e colaboradores, documenta a família Xiaomi Mi Scale e seu protocolo. O projeto original declara GPL versão 3 ou posterior. Consulte o [repositório e aviso de licença](https://github.com/oliexdev/openScale#license) e a [documentação da Mi Scale](https://github.com/oliexdev/openScale/wiki/Xiaomi-Bluetooth-Mi-Scale).
- **100nandoo** documentou os formatos OKOK no [okok-bia-formulas, publicado sob AGPL-3.0](https://github.com/100nandoo/okok-bia-formulas). **ipanalytics** documentou os [campos do anúncio Xiaomi V2](https://github.com/ipanalytics/Xiaomi-Scale-Unlocked-Reverse-Engineering). Os leitores Android desta versão foram escritos para o Gym Organizer a partir das informações de protocolo. Nenhum desses aplicativos ou bibliotecas é empacotado no APK.


- [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) — 876 exercícios e 1.746 fotos ([Unlicense](app/src/main/assets/LICENSE-exercises.txt)).
- [MingCute](https://github.com/mingcute-design/mingcute-icons) — ícones ([Apache 2.0](app/src/main/assets/LICENSE-mingcute.txt)).
- [Body Muscles](https://github.com/emmorts/body-muscles) — mapa muscular, com arte de Ivan Vulović ([Apache 2.0](app/src/main/assets/LICENSE-body-muscles.txt), [atribuições](app/src/main/assets/NOTICE-body-muscles.txt)).

O código próprio do Gym Organizer é distribuído sob a [licença MIT](LICENSE). O catálogo, os ícones e os vetores mantêm as licenças indicadas acima.
