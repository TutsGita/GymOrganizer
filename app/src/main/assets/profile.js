"use strict";

function activeScaleProfile() {
  return state.scaleProfiles[state.scaleProfileId];
}

function scaleProfilePicker() {
  return `<label class="field">Perfil ativo<select id="scale-profile-picker">
    ${Object.entries(state.scaleProfiles).map(([id, person]) =>
      `<option value="${escaped(id)}" ${id === state.scaleProfileId ? "selected" : ""}>${escaped(person.name)}</option>`).join("")}
  </select></label>`;
}

function switchScaleProfile(id) {
  if (!Object.hasOwn(state.scaleProfiles, id)) return;
  const previous = state.scaleProfileId;
  state.scaleProfileId = id;
  if (!save()) state.scaleProfileId = previous;
  render(true);
}

function createScaleProfile(form) {
  const name = form.elements.person.value.trim();
  if (!name) { toast("Informe o nome do perfil."); return; }
  const previous = state.scaleProfileId;
  const id = newId("pessoa");
  state.scaleProfiles[id] = { name, height: null, age: null, sex: "", weights: {} };
  state.scaleProfileId = id;
  if (!save()) {
    delete state.scaleProfiles[id];
    state.scaleProfileId = previous;
    return;
  }
  closeSheet();
  render();
}

function profile() {
  const { height, weights } = activeScaleProfile();
  const days = Object.keys(weights).sort();
  const latest = weights[days[days.length - 1]];
  const area = (height / 100) ** 2;
  const today = localDate(Date.now());
  return heading("Perfil") + `<div class="stack">
    ${rankCard()}
    <section class="glass stack">
      ${scaleProfilePicker()}
      ${button("new-scale-profile", "Novo perfil", "plus")}
    </section>
    <section class="glass stack">
      ${button("missions", "Missões", "list")}
      ${button("achievements", "Conquistas", "medal")}
      ${button("themes", "Temas", "palette")}
    </section>
    <p class="muted">Os dados de cada pessoa ficam neste aparelho.</p>
    <form id="profile-height" class="glass stack">
      <label class="field">Nome<input name="person" required maxlength="40" value="${escaped(activeScaleProfile().name)}"></label>
      <label class="field">Altura (cm)<input name="height" type="number" inputmode="decimal" required min="1" max="300" step="0.1" value="${height ?? ""}"></label>
      <label class="field">Idade em anos (para composição)<input name="age" type="number" min="1" max="120" step="1" value="${activeScaleProfile().age ?? ""}"></label>
      <label class="field">Sexo usado na estimativa<select name="sex">
        <option value="">Selecione</option><option value="female" ${activeScaleProfile().sex === "female" ? "selected" : ""}>Feminino</option>
        <option value="male" ${activeScaleProfile().sex === "male" ? "selected" : ""}>Masculino</option></select></label>
      <button>Salvar dados</button>
    </form>
    <section class="glass stack"><h2>Medidas atuais</h2>
      ${latest ? `<p>Último peso: <strong>${kg(latest)}</strong></p>` : "<p>Registre sua primeira pesagem abaixo.</p>"}
      ${area && latest ? `<p>IMC: <strong>${(latest / area).toLocaleString("pt-BR", {maximumFractionDigits: 1})}</strong> kg/m²</p>` : ""}
      ${area ? `<p>Faixa de peso estimada para adultos de 20 anos ou mais: <strong>${kg(18.5 * area)} a menos de ${kg(25 * area)}</strong>.</p>
      <small>Referência pelo IMC (CDC). A composição corporal também influencia a avaliação individual.</small>` : ""}
    </section>
    ${latest ? composition(days[days.length - 1]) : ""}
    <section class="glass stack"><h2>Balança Bluetooth</h2>
      <small>Ative o Bluetooth e use a balança em kg. Modelos: OKOK V20/C0, Xiaomi Mi Body Composition Scale 2, PICOOC Mini Lite e QN/Renpho AABB (inclui FITINDEX FT-26R).</small>
      <a class="scale-link" href="gym://okok/scan">Procurar balança</a>
      <a class="accent" href="gym://okok/diagnostic">Diagnóstico Bluetooth</a>
    </section>
    <form id="body-weight" class="glass stack"><h2>Registrar peso</h2>
      <label class="field">Data<input name="day" type="date" required max="${today}" value="${today}"></label>
      <label class="field">Peso (kg)<input name="mass" type="number" inputmode="decimal" required min="0.01" max="1000" step="0.01"></label>
      <small>Salvar outra pesagem na mesma data corrige o valor daquele dia.</small>
      <button class="primary">Salvar pesagem</button>
    </form>
    <section class="glass stack"><h2>Backup dos dados</h2>
      <small>Salve todos os perfis, fichas, planos e históricos em um arquivo JSON, ou restaure um backup salvo antes.</small>
      ${button("export-backup", "Exportar backup", "history")}
      ${button("import-backup", "Importar backup", "history")}
    </section>
    <section class="glass stack"><h2>Sobre o app</h2>
      ${button("changelog", "Histórico de versões", "history")}
      <a class="scale-link" href="gym://updates/check">Verificar atualizações</a>
    </section></div>`;
}

function saveMeasurement(form) {
  if (!form.reportValidity()) return;
  const previous = activeScaleProfile();
  const fields = form.elements;
  if (form.id === "profile-height") {
    const name = fields.person.value.trim();
    if (!name) { toast("Informe o nome do perfil."); return; }
    state.scaleProfiles[state.scaleProfileId] = { ...previous, name, height: fields.height.valueAsNumber, age: fields.age.valueAsNumber || null, sex: fields.sex.value };
  } else {
    const day = fields.day.value;
    const impedance = { ...previous.impedance };
    delete impedance[day];
    state.scaleProfiles[state.scaleProfileId] = { ...previous, impedance, weights: { ...previous.weights, [day]: fields.mass.valueAsNumber } };
  }
  if (!save()) { state.scaleProfiles[state.scaleProfileId] = previous; return; }
  if (form.id === "body-weight") selectedDay = fields.day.value;
  render(true);
  toast("Medida salva");
}

function weightEvolution(day) {
  const weights = activeScaleProfile().weights;
  const days = Object.keys(weights).sort();
  const month = days.filter(key => key.startsWith(day.slice(0, 7)));
  const index = days.indexOf(day);
  const delta = index > 0 ? weights[day] - weights[days[index - 1]] : null;
  return `<section class="glass stack"><h2>Peso corporal</h2>
    ${scaleProfilePicker()}
    <p>${dateLabel(dayDate(day))} · ${index >= 0 ? kg(weights[day]) : "Sem pesagem"}</p>
    ${index >= 0 ? composition(day) : ""}
    ${delta !== null ? `<small>Variação desde a pesagem anterior: ${delta > 0 ? "+" : ""}${kg(delta)}</small>` : ""}
    ${month.length ? `<details><summary>Pesagens do mês (${month.length})</summary>
      ${month.map(key => `<p>${dateLabel(dayDate(key))} · ${kg(weights[key])}</p>`).join("")}</details>` : ""}
    </section>`;
}

function recordScaleReading(profileId, mass, ohms) {
  const day = localDate(Date.now());
  const previous = state.scaleProfiles[profileId];
  if (!previous) return false;
  state.scaleProfiles[profileId] = { ...previous, weights: { ...previous.weights, [day]: mass },
    impedance: { ...previous.impedance, [day]: ohms || null } };
  if (!save()) { state.scaleProfiles[profileId] = previous; return false; }
  selectedDay = day;
  render(true);
  toast("Pesagem salva no calendário");
  return true;
}

// Coefficients documented by 100nandoo/okok-bia-formulas.
const biaCoefficients = {
  male: {
    water: [0.0939, 0.3758, -0.0032, -0.006925, 0.097],
    muscle: [0.2867, 0.3894, -0.0408, -0.01235, -15.7665],
    fat: [-0.3315, 0.6216, 0.0183, 0.0085, 22.554]
  },
  female: {
    water: [0.0877, 0.2973, 0.0128, -0.00603, 0.5175],
    muscle: [0.3186, 0.1934, -0.0206, -0.0132, -16.4556],
    fat: [-0.3332, 0.7509, 0.0196, 0.0072, 22.7193]
  }
};

function composition(day, showCardButton = true) {
  const {height, age, sex, weights, impedance} = activeScaleProfile();
  const mass = weights[day];
  const ohms = impedance?.[day];
  const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
  const format = (value, unit) => value == null ? "Sem estimativa" : number.format(value) + " " + unit;
  const metric = (name, value, detail = "") => `<div class="body-metric">
    <dt>${name}</dt><dd>${value}</dd>${detail ? `<dd class="muted">${detail}</dd>` : ""}
  </div>`;

  const model = biaCoefficients[sex];
  let water = null, fat = null, muscle = null, bone = null;
  let message = "Salve altura, idade e sexo no Perfil para calcular a composição.";
  if (height > 0 && age >= 18 && model) {
    const withinWeight = value => value > 0 && value < mass ? value : null;
    const male = sex === "male";
    if (ohms > 0) {
      const estimate = ([h, w, a, z, constant]) => h * height + w * mass + a * age + z * ohms + constant;
      water = withinWeight(estimate(model.water));
      muscle = withinWeight(estimate(model.muscle));
      fat = withinWeight(estimate(model.fat));
      if (fat !== null) fat = Math.min(0.45 * mass, Math.max(0.05 * mass, fat));
      const remainder = fat !== null && muscle !== null ? withinWeight(mass - fat - muscle) : null;
      if (remainder !== null) bone = Math.max(1, Math.min(4, remainder));
      message = [water, fat, muscle, bone].some(value => value === null)
        ? "A leitura é incompatível com parte das estimativas. Repita a pesagem com os dois pés apoiados."
        : "Estimativas pelo modelo OKOK. O valor ósseo é uma aproximação de massa mineral.";
    } else {
      water = withinWeight(male ? 2.447 - 0.09516 * age + 0.1074 * height + 0.3362 * mass
                                : -2.097 + 0.1069 * height + 0.2466 * mass);
      const bmi = mass / (height / 100) ** 2;
      fat = withinWeight(mass * (1.2 * bmi + 0.23 * age - (male ? 10.8 : 0) - 5.4) / 100);
      message = "Água e gordura estimadas pelo perfil e peso. Músculo e massa óssea exigem impedância.";
    }
  } else if (age && age < 18) {
    message = "Estimativas de composição disponíveis para adultos.";
  }
  const percent = value => value === null ? "" : number.format(100 * value / mass) + "% do peso";
  return `<section class="glass stack"><h3>Composição corporal</h3>
    <dl class="body-metrics">
      ${metric("Peso registrado", kg(mass))}
      ${metric("Impedância elétrica", ohms > 0 ? format(ohms, "Ω") : "Sem leitura", "Leitura da balança em ohms")}
      ${metric("Água corporal", format(water, "L"), percent(water))}
      ${metric("Gordura corporal", format(fat, "kg"), percent(fat))}
      ${metric("Massa muscular", format(muscle, "kg"), percent(muscle))}
      ${metric("Massa óssea estimada", format(bone, "kg"))}
    </dl>
    <small>${message}</small>
    ${showCardButton ? button("body-card", "Criar cartão", "plus", "", day) : ""}
  </section>`;
}

const scaleSheet = document.querySelector("#scale-sheet");
let scaleProfileForReading = null;
let candidateReading = null;

window.showScaleStatus = function (status, message, mass, ohms) {
  if (status === "start") {
    scaleProfileForReading = state.scaleProfileId;
    candidateReading = null;
  } else if (scaleProfileForReading === null) {
    if (status === "error") toast(message);
    return;
  }
  if (status === "reading") candidateReading = {mass, ohms};
  const person = state.scaleProfiles[scaleProfileForReading];
  const waiting = status === "start" || status === "waiting";
  scaleSheet.innerHTML = `<div class="scale-status stack">
    <span class="tile-icon scale-emblem">${glyph(waiting ? "search" : "info")}</span>
    <h2 id="scale-title">${waiting ? "Procurando balança" : status === "reading" ? "Confirmar pesagem" : "Busca encerrada"}</h2>
    <p class="accent">${escaped(person.name)}</p>
    ${waiting ? '<progress class="progress-track" aria-label="Busca em andamento"></progress>' : ""}
    <p class="muted" role="status">${escaped(message)}</p>
    ${mass > 0 ? `<strong class="scale-reading">${kg(mass)}</strong>` : ""}
    ${ohms > 0 ? `<p>Impedância: ${ohms.toLocaleString("pt-BR")} Ω</p>` : ""}
    ${status === "waiting" ? '<a class="scale-link" href="gym://okok/weight">Usar só o peso</a>' : ""}
    ${status === "reading" ? button("accept-scale-reading", "Salvar pesagem", "check", "primary") : ""}
    ${button("close-scale", waiting ? "Cancelar" : "Fechar", "close")}
  </div>`;
  if (!scaleSheet.open) scaleSheet.showModal();
};

function closeScaleSheet() {
  if (!scaleSheet.open) return false;
  scaleProfileForReading = null;
  candidateReading = null;
  scaleSheet.close();
  window.location.href = "gym://okok/cancel";
  return true;
}

scaleSheet.addEventListener("cancel", event => {
  event.preventDefault();
  closeScaleSheet();
});

function acceptScaleReading() {
  if (!candidateReading || !scaleProfileForReading) return;
  const {mass, ohms} = candidateReading;
  if (recordScaleReading(scaleProfileForReading, mass, ohms)) closeScaleSheet();
}

function showBodyCard(day) {
  if (!activeScaleProfile().weights[day]) return;
  const date = dayDate(day).toLocaleDateString("pt-BR");
  openSheet("Cartão da pesagem", `<div class="stack">
    <article id="body-card" class="glass stack">
      <div class="brand">Gym Organizer</div>
      <h3>${escaped(activeScaleProfile().name)}</h3>
      <small>${date}</small>
      ${composition(day, false)}
    </article>
    <a class="scale-link" href="gym://body-card/export">Salvar e compartilhar PNG</a>
  </div>`);
}

window.bodyCardPng = function () {
  const card = document.querySelector("#body-card");
  if (!card) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 770;
  const ctx = canvas.getContext("2d");
  const palette = getComputedStyle(document.documentElement);
  const color = key => palette.getPropertyValue("--" + key).trim();
  ctx.fillStyle = color("background");
  ctx.fillRect(0, 0, 900, 770);
  const draw = (text, x, y, size, ink, width = 800) => {
    ctx.font = `600 ${size}px sans-serif`;
    ctx.fillStyle = color(ink);
    ctx.fillText(text, x, y, width);
  };
  draw("Gym Organizer", 42, 63, 30, "purple");
  draw(card.querySelector("h3").textContent, 42, 121, 48, "text");
  draw(card.querySelector("small").textContent, 42, 163, 28, "muted");
  card.querySelectorAll(".body-metric").forEach((item, index) => {
    const x = 42 + (index % 2) * 417;
    const y = 205 + Math.floor(index / 2) * 158;
    ctx.fillStyle = color("surface");
    ctx.fillRect(x, y, 399, 142);
    draw(item.querySelector("dt").textContent, x + 16, y + 34, 24, "muted", 367);
    const values = item.querySelectorAll("dd");
    draw(values[0].textContent, x + 16, y + 80, 35, "text", 367);
    if (values[1]) draw(values[1].textContent, x + 16, y + 117, 22, "muted", 367);
  });
  draw("Composição corporal estimada", 42, 732, 25, "muted");
  return canvas.toDataURL("image/png").split(",")[1];
};
