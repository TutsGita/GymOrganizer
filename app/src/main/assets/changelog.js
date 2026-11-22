"use strict";

const releaseHistory = [
  [
    "0.4.0",
    [
      "Botão central para iniciar ou retomar treino. Água e alimentação ficam na aba Nutrição. Temas e Conquistas ficam no Perfil.",
      "Exportação em PDF de planos semanais e sequenciais, com fichas, exercícios, cargas e notas.",
      "Nível e elo por perfil, com XP por exercício e missões diárias e semanais.",
      "80 medalhas por perfil, com categorias de treino, força, cardio, metas, volume e recuperação. Corrigir ou excluir registros recalcula as conquistas.",
      "Instruções em português no catálogo offline e mais vídeos licenciados do wger e do Wikimedia Commons. Salve somente os vídeos que quiser assistir offline.",
      "Diário de água por perfil e por data, meta editável e lembretes opcionais.",
      "Diário alimentar com busca online na TACO, acesso ao site da TBCA, cadastro manual e consulta de produtos por código de barras.",
      "Estimativas de calorias por objetivo e atividade. O diário sinaliza quando proteína e fibras ficam abaixo da referência nos alimentos registrados.",
      "Diário de corridas, pedais e outras atividades por perfil.",
      "Remoção das fotos legadas de licença incerta e limpeza de vídeos salvos que saíram do catálogo."
    ]
  ],
  [
    "0.3.2",
    [
      "Download de atualizações dentro do app, com confirmação de instalação pelo Android.",
      "Histórico de versões disponível offline em Perfil."
    ]
  ],
  [
    "0.3.1",
    [
      "A barra do app encosta na área de navegação do Android. Os cantos arredondados ajustam apenas o espaçamento lateral dos botões.",
      "As barras do sistema acompanham a paleta do app, com ícones claros ou escuros conforme o fundo.",
      "A rolagem usa menos efeitos de composição. No Android 15 ou superior, a interface solicita uma taxa de atualização alta ao sistema.",
      "Se o componente da interface parar de responder, o app tenta reabri-lo e retoma os dados que já foram salvos."
    ]
  ],
  [
    "0.3.0",
    [
      "Perfis de pesagem independentes para compartilhar a mesma balança. O histórico anterior fica em Meu perfil.",
      "Tela de busca e confirmação da balança integrada ao tema escolhido e com identificação de quem vai receber a pesagem.",
      "Cartão de composição por data com exportação em PNG e compartilhamento pelo Android."
    ]
  ],
  [
    "0.2.2",
    [
      "Aba Temas com sete paletas e preferência salva no aparelho.",
      "Cartões separados para peso, impedância e estimativas de composição no Perfil e no Calendário.",
      "Diagnóstico Bluetooth por endereço da balança e leitura de unidades adicionais nos pacotes OKOK C0."
    ]
  ],
  [
    "0.2.1",
    [
      "Fotos e mapas musculares voltam a carregar ao reabrir um treino salvo.",
      "Leitura de peso das balanças QN/Renpho com anúncios AABB e da FITINDEX FT-26R.",
      "Leitura de peso e impedância da PICOOC Mini Lite. O app confere a integridade do pacote e o estado final da pesagem.",
      "Tabela de compatibilidade por protocolo e tipo de medida."
    ]
  ],
  [
    "0.2.0",
    [
      "O código próprio passa a ser distribuído sob a licença MIT.",
      "A aba **Perfil** guarda altura, idade, sexo e pesagens por data no aparelho. Mostra o IMC e uma faixa de peso de referência para adultos a partir de 20 anos.",
      "O **Calendário** marca os dias com pesagem e mostra o peso do dia, a variação desde a medida anterior e o histórico mensal.",
      "Em **Perfil → Procurar balança**, o app recebe peso e, quando disponível, impedância de balanças OKOK V20/C0. A leitura da Xiaomi Mi Body Composition Scale 2 é experimental. O usuário confirma antes de salvar.",
      "O perfil e o calendário mostram estimativas de água e gordura corporal calculadas com o peso e o perfil atual. A massa muscular esquelética também exige uma leitura de impedância válida.",
      "Os números do calendário e as setas de organização foram alinhados. O layout usa a área disponível ao redor da câmera, do teclado e das barras do Android."
    ]
  ],
  [
    "0.1.1",
    [
      "Consulta silenciosa por versões novas ao abrir o app. Se houver atualização, o app oferece abrir a página de download do GitHub.",
      "APK 0.1.1 pronto para instalação, com botão de download no README.",
      "Melhorias de animação, alinhamento dos ícones e ícone transparente do aplicativo."
    ]
  ]
];

function changelog() {
  return heading("Histórico de versões", true) + `<div class="stack">
    ${releaseHistory.map(([version, changes]) => `<article class="glass stack">
      <h2>${escaped(version)}</h2>
      <ul>${changes.map(change => `<li>${escaped(change.replaceAll("**", ""))}</li>`).join("")}</ul>
    </article>`).join("")}
  </div>`;
}
