"use strict";

function profile() {
  const { height, weights } = state.profile;
  const days = Object.keys(weights).sort();
  const latest = weights[days[days.length - 1]];
  const area = (height / 100) ** 2;
  const today = localDate(Date.now());
  return heading("Perfil") + `<div class="stack">
    <p class="muted">Suas medidas ficam neste aparelho.</p>
    <form id="profile-height" class="glass stack">
      <label class="field">Altura (cm)<input name="height" type="number" inputmode="decimal" required min="1" max="300" step="0.1" value="${height ?? ""}"></label>
      <label class="field">Idade em anos (para composição)<input name="age" type="number" min="1" max="120" step="1" value="${state.profile.age ?? ""}"></label>
      <label class="field">Sexo usado na estimativa<select name="sex">
        <option value="">Selecione</option><option value="female" ${state.profile.sex === "female" ? "selected" : ""}>Feminino</option>
        <option value="male" ${state.profile.sex === "male" ? "selected" : ""}>Masculino</option></select></label>
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
      <small>Ative o Bluetooth e use a balança em kg. Compatibilidade experimental com OKOK V20/C0 e Xiaomi Mi Body Composition Scale 2.</small>
      <a class="scale-link" href="gym://okok/scan">Procurar balança</a>
    </section>
    <form id="body-weight" class="glass stack"><h2>Registrar peso</h2>
      <label class="field">Data<input name="day" type="date" required max="${today}" value="${today}"></label>
      <label class="field">Peso (kg)<input name="mass" type="number" inputmode="decimal" required min="0.01" max="1000" step="0.01"></label>
      <small>Salvar outra pesagem na mesma data corrige o valor daquele dia.</small>
      <button class="primary">Salvar pesagem</button>
    </form></div>`;
}

function saveMeasurement(form) {
  if (!form.reportValidity()) return;
  const previous = state.profile;
  const fields = form.elements;
  if (form.id === "profile-height") {
    state.profile = { ...previous, height: fields.height.valueAsNumber, age: fields.age.valueAsNumber || null, sex: fields.sex.value };
  } else {
    const day = fields.day.value;
    const impedance = { ...previous.impedance };
    delete impedance[day];
    state.profile = { ...previous, impedance, weights: { ...previous.weights, [day]: fields.mass.valueAsNumber } };
  }
  if (!save()) { state.profile = previous; return; }
  if (form.id === "body-weight") selectedDay = fields.day.value;
  render(true);
  toast("Medida salva");
}

function weightEvolution(day) {
  const weights = state.profile.weights;
  const days = Object.keys(weights).sort();
  const month = days.filter(key => key.startsWith(day.slice(0, 7)));
  const index = days.indexOf(day);
  const delta = index > 0 ? weights[day] - weights[days[index - 1]] : null;
  return `<section class="glass stack"><h2>Peso corporal</h2>
    <p>${dateLabel(dayDate(day))} · ${index >= 0 ? kg(weights[day]) : "Sem pesagem"}</p>
    ${state.profile.impedance?.[day] ? `<p>Impedância medida: ${state.profile.impedance[day]} Ω</p>` : ""}
    ${index >= 0 ? composition(day) : ""}
    ${delta !== null ? `<small>Variação desde a pesagem anterior: ${delta > 0 ? "+" : ""}${kg(delta)}</small>` : ""}
    ${month.length ? `<details><summary>Pesagens do mês (${month.length})</summary>
      ${month.map(key => `<p>${dateLabel(dayDate(key))} · ${kg(weights[key])}</p>`).join("")}</details>` : ""}
    </section>`;
}

window.importOkok = function (mass, ohms) {
  const day = localDate(Date.now());
  const previous = state.profile;
  state.profile = { ...previous, weights: { ...previous.weights, [day]: mass },
    impedance: { ...previous.impedance, [day]: ohms || null } };
  if (!save()) { state.profile = previous; return; }
  selectedDay = day;
  render(true);
  toast("Pesagem salva no calendário");
};

function composition(day) {
  const {height, age, sex, weights, impedance} = state.profile;
  const mass = weights[day];
  if (!height || !age || !sex) return "<small>Salve altura, idade e sexo no Perfil para ver a composição estimada.</small>";
  if (age < 18) return "<small>Estimativas disponíveis para adultos.</small>";
  const male = sex === "male";
  const water = male ? 2.447 - 0.09516 * age + 0.1074 * height + 0.3362 * mass
                     : -2.097 + 0.1069 * height + 0.2466 * mass;
  const fatPercent = 1.2 * mass / (height / 100) ** 2 + 0.23 * age - (male ? 10.8 : 0) - 5.4;
  const ohms = impedance?.[day];
  const muscle = ohms ? 0.401 * height ** 2 / ohms + (male ? 3.825 : 0) - 0.071 * age + 5.102 : null;
  const fmt = n => n.toLocaleString("pt-BR", {maximumFractionDigits: 1});
  return `<section class="stack"><h3>Composição estimada</h3>
    ${water > 0 && water < mass ? `<p>Água corporal total: <strong>${fmt(water)} L</strong> (${fmt(100 * water / mass)}%)</p>` : ""}
    ${fatPercent > 0 && fatPercent < 100 ? `<p>Gordura corporal: <strong>${fmt(fatPercent)}%</strong> (${fmt(mass * fatPercent / 100)} kg)</p>` : ""}
    ${muscle > 0 && muscle < mass && age <= 86 ? `<p>Massa muscular esquelética: <strong>${fmt(muscle)} kg</strong> (${fmt(100 * muscle / mass)}%)</p>`
      : `<small>${ohms ? "Estimativa muscular indisponível para esta medida." : "A massa muscular requer uma pesagem com impedância."}</small>`}
    <small>Água e gordura estimadas pelo perfil atual e pelo peso. A estimativa muscular usa a impedância como aproximação da resistência e pode variar com o modelo da balança.</small></section>`;
}
