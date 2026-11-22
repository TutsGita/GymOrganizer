"use strict";

const wellnessRequests = new Map();
let wellnessRequestId = 0;
let tacoIndex = null;
let tacoRequest = null;
let foodQuery = "";
let foodDetailRequest = 0;

window.finishWellness = function (id, value, error) {
  const reply = wellnessRequests.get(id);
  if (!reply) return;
  wellnessRequests.delete(id);
  clearTimeout(reply.timeout);
  if (error) reply.reject(new Error(error));
  else reply.resolve(value);
};

function wellnessRequest(operation, argument = "") {
  return new Promise((resolve, reject) => {
    if (!window.GymWellness) { reject(new Error("Disponível no app Android.")); return; }
    const id = ++wellnessRequestId;
    const timeout = setTimeout(() => window.finishWellness(id, null, "Tempo de espera esgotado. Tente novamente."), 120000);
    wellnessRequests.set(id, {resolve, reject, timeout});
    try {
      window.GymWellness.request(id, operation, String(argument));
    } catch {
      window.finishWellness(id, null, "Não foi possível concluir a operação.");
    }
  });
}

function exerciseVideo(item) {
  const video = item.video;
  if (!video) return "";
  const saved = window.GymWellness?.videoSaved(video.url);
  const play = `<button type="button" class="with-icon" data-action="video-action" data-op="play-video" data-value="${escaped(item.id)}">${glyph("play")} ${saved ? "Assistir offline" : "Assistir online"}</button>`;
  const storage = saved ? "Remover vídeo offline" : `Salvar vídeo offline · ${Math.ceil(video.size / 1e6)} MB`;
  return `<section class="stack"><h3>Vídeo da execução</h3>
    ${play}<button type="button" data-action="video-action" data-op="${saved ? "remove-video" : "save-video"}" data-value="${escaped(item.id)}">${storage}</button>
    <small>Vídeo de ${escaped(video.credit.author)} · ${escaped(video.provider || "wger")} · ${escaped(video.credit.license)}</small>
    ${video.source ? `<a class="accent" href="${escaped(video.source)}">Fonte e licença do vídeo</a>` : ""}</section>`;
}

async function videoAction(control, id) {
  const item = catalog.get(id);
  if (!item?.video || control.disabled) return;
  const operation = control.dataset.op;
  control.disabled = true;
  if (operation === "save-video") toast("Baixando vídeo para assistir offline…");
  try {
    await wellnessRequest(operation, item.video.url);
    if (operation !== "play-video" && control.isConnected && sheet.open) showDetails(item);
  } catch (error) { toast(error.message); }
  finally { control.disabled = false; }
}

const todayWellness = () => localDate(Date.now());
let waterDay = "";
let foodDay = "";
const hydrationDay = () => waterDay || todayWellness();
const nutritionDay = () => foodDay || todayWellness();
function wellnessDate(kind, day) {
  return `<label class="field">Data<input id="${kind}-date" type="date" value="${day}" max="${todayWellness()}"></label>`;
}

function changeWellnessDate(input) {
  if (!["water-date", "food-date"].includes(input.id)) return false;
  if (!input.value || !input.checkValidity()) return true;
  if (input.id === "water-date") waterDay = input.value;
  else foodDay = input.value;
  render(true);
  return true;
}

const wellnessData = () => activeScaleProfile().wellness || {};
const targetWater = () => wellnessData().waterGoal || 2000;
const nutrientFields = [
  ["energy", "Energia", "kcal"], ["protein", "Proteína", "g"], ["carbs", "Carboidratos", "g"],
  ["fat", "Gorduras", "g"], ["fiber", "Fibras", "g"]
];
const amountNumber = new Intl.NumberFormat("pt-BR", {maximumFractionDigits: 1});
const formatted = n => amountNumber.format(n);

function nutritionSections(selected) {
  return `<div class="calendar-sections" aria-label="Seções de nutrição">
    ${[["nutrition", "Alimentação"], ["water", "Água"]].map(([key, label]) =>
      `<button type="button" data-action="${key}" aria-pressed="${selected === key}">${label}</button>`).join("")}
  </div>`;
}

function saveWellnessData(next) {
  const owner = activeScaleProfile();
  const previous = owner.wellness;
  owner.wellness = next;
  if (save()) return true;
  owner.wellness = previous;
  return false;
}

function water() {
  const w = wellnessData();
  const day = hydrationDay();
  const entries = w.water?.[day] || [];
  const total = waterTotal(entries);
  const loggedTarget = w.waterTargets?.[day] || targetWater();
  const [start, end, interval] = (window.GymWellness?.reminder() || "8,21,0").split(",");
  return heading("Nutrição") + `<div class="stack">
    ${nutritionSections("water")}
    <section class="glass stack"><h2>Consumo de água · ${escaped(activeScaleProfile().name)}</h2>
      ${wellnessDate("water", day)}
      <p><strong>${formatted(total)} mL</strong> de ${formatted(loggedTarget)} mL</p>
      <progress class="progress-track" aria-label="Progresso da meta de água" max="${loggedTarget}" value="${Math.min(total, loggedTarget)}"></progress>
      <div class="row wrap">${[150,250,500].map(ml => `<button data-action="wellness" data-op="water-add" data-value="${ml}">+${ml} mL</button>`).join("")}</div>
      <form id="water-add" class="stack"><label class="field">Outro volume (mL)<input name="ml" type="number" required min="1" max="5000" inputmode="numeric"></label>
        <button>Registrar água</button></form>
      ${entries.length ? `<div class="stack">${entries.map(drink => `<div class="row spread"><span>${formatted(drink.ml)} mL</span>
        <button data-action="wellness" data-op="water-delete" data-value="${escaped(drink.id)}" aria-label="Remover registro de ${drink.ml} mL">Remover</button></div>`).join("")}</div>` : ""}
    </section>
    <form class="glass stack" id="water-goal"><h2>Meta diária</h2>
      <small>2 L é um ponto de partida para alguns adultos. A necessidade varia com a atividade, o clima e as orientações de saúde. Ajuste à sua rotina.</small>
      <label class="field">Sua meta (mL)<input name="goal" type="number" min="100" max="10000" required value="${targetWater()}"></label>
      <button>Salvar meta</button></form>
    <form class="glass stack" id="water-reminder"><h2>Lembretes no aparelho</h2>
      <label class="field">Repetir a cada (horas; 0 desliga)<input name="interval" type="number" min="0" max="12" required value="${escaped(interval)}"></label>
      <label class="field">A partir de (hora)<input name="start" type="number" min="0" max="23" required value="${escaped(start)}"></label>
      <label class="field">Até (hora)<input name="end" type="number" min="0" max="23" required value="${escaped(end)}"></label>
      <button>Salvar lembretes</button><small>O Android pode atrasar notificações para economizar bateria.</small></form>
  </div>`;
}

function recordWater(ml, removeId) {
  const w = wellnessData();
  const day = hydrationDay();
  const entries = w.water?.[day] || [];
  const updated = removeId ? entries.filter(entry => entry.id !== removeId)
    : [...entries, { id: newId("agua"), ml }];
  const waterTargets = { ...w.waterTargets, [day]: w.waterTargets?.[day] || targetWater() };
  if (saveWellnessData({...w, waterTargets, water: {...w.water, [day]: updated}})) render(true);
}

const goalTypes = new Map([
  ["maintain", ["Manutenção", 1]], ["lose", ["Perda de peso", .9]],
  ["gain", ["Ganho de peso", 1.1]], ["muscle", ["Ganho de massa muscular", 1.05]]
]);
const activityLevels = new Map([["1.4","Baixa"], ["1.6","Leve"], ["1.8","Moderada"], ["2","Alta"]]);

function caloricEstimate(profile, goal) {
  const {height, age, sex, weights, impedance} = profile;
  const day = Object.keys(weights).sort().pop();
  const kg = weights[day];
  if (!activityLevels.has(goal?.activity) || !goalTypes.has(goal?.type) ||
      !height || !age || age < 18 || !["male", "female"].includes(sex) || kg < 25 ||
      !Number.isFinite(kg)) return null;
  const male = sex === "male";
  const rest = 10 * kg + 6.25 * height - 5 * age + (male ? 5 : -161);
  if (rest <= 0) return null;
  const z = impedance?.[day];
  const okok = z > 0 ? (male
    ? 7.5037 * height + 13.1523 * kg - 4.3376 * age - .3486 * z - 311.7751
    : 7.5432 * height + 9.9474 * kg - 3.4382 * age - .0415 * z - 309.0821) : 0;
  const useBia = okok >= .7 * rest && okok <= 1.3 * rest;
  const basal = useBia ? okok : rest;
  const maintenance = basal * Number(goal.activity);
  const bmi = kg / (height / 100) ** 2;
  const kcal = goal.type === "lose" && bmi < 18.5 ? null : Math.round(maintenance * goalTypes.get(goal.type)[1]);
  return {basal, maintenance, kcal, method: useBia ? "modelo OKOK com impedância" : "equação de Mifflin–St Jeor",
    protein: kg * .8, fiber: Math.round(maintenance * .014)};
}

function nutrition() {
  const w = wellnessData();
  const goal = w.nutritionGoal;
  const profile = activeScaleProfile();
  const estimate = caloricEstimate(profile, goal);
  const entries = w.meals?.[nutritionDay()] || [];
  const totals = Object.fromEntries(nutrientFields.map(([key]) => {
    const known = entries.filter(food => food[key] !== null);
    return [key, {value: known.reduce((sum, food) => sum + food[key] * food.portion / 100, 0), partial: known.length !== entries.length}];
  }));
  const daily = (key, title, reference) => {
    if (!estimate || !entries.length) return "";
    const item = totals[key];
    if (item.partial) return `<small>${title}: há alimentos sem esse dado. Total parcial.</small>`;
    return item.value < reference ? `<small>${title} abaixo da referência nos alimentos registrados (${formatted(item.value)} de ${formatted(reference)} g).</small>` : "";
  };
  return heading("Nutrição") + `<div class="stack">
    ${nutritionSections("nutrition")}
    <section class="glass stack"><h2>Diário · ${escaped(profile.name)}</h2>
      ${wellnessDate("food", nutritionDay())}
      <div class="body-metrics">${nutrientFields.map(([key,label,unit]) => `<div class="body-metric"><small>${label}</small>
        <div><strong>${formatted(totals[key].value)} ${unit}</strong>${totals[key].partial ? " · parcial" : ""}</div></div>`).join("")}</div>
      ${estimate?.kcal !== null && estimate?.kcal !== undefined ? `<p>Meta estimada: <strong>${formatted(estimate.kcal)} kcal</strong></p>` : ""}
      ${daily("protein","Proteína",estimate?.protein)}
      ${daily("fiber","Fibras",estimate?.fiber)}
      ${entries.map(food => `<div class="row spread"><div><strong>${escaped(food.name)}</strong><br><small>${formatted(food.portion)} ${escaped(food.unit || "g")} · ${escaped(food.source)}</small></div>
        <button data-action="wellness" data-op="food-delete" data-value="${escaped(food.id)}" aria-label="Remover ${escaped(food.name)}">Remover</button></div>`).join("") || '<p class="muted">Nenhum alimento registrado.</p>'}
    </section>
    <section class="glass stack"><h2>Adicionar alimento</h2>
      <label class="field">Buscar na TACO online<input id="taco-search" type="search" placeholder="Ex.: arroz integral" value="${escaped(foodQuery)}" autocomplete="off"></label>
      <div id="taco-results" class="stack"></div>
      <form id="barcode-lookup" class="stack"><label class="field">Código de barras<input name="barcode" type="text" required inputmode="numeric" pattern="[0-9]{8}|[0-9]{12,14}" maxlength="14"></label>
        <div class="row wrap"><button>Buscar produto</button><button type="button" data-action="wellness" data-op="barcode">${glyph("search")} Usar câmera</button></div></form>
      <button data-action="wellness" data-op="manual-food">Cadastrar pelo rótulo</button>
      <a class="accent" href="gym://wellness/tbca">Consultar TBCA no site oficial</a>
      <small>Consultas usam internet. Registros salvos ficam disponíveis offline. Fontes: TACO (NEPA/Unicamp; API de Fabio Brolesi) e Open Food Facts (ODbL).</small>
    </section>
    <form class="glass stack" id="nutrition-goal"><h2>Meta de calorias</h2>
      <label class="field">Objetivo<select name="type">${[...goalTypes].map(([key,[label]]) => `<option value="${key}" ${goal?.type === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <label class="field">Atividade habitual<select name="activity" required><option value="">Selecione</option>${[...activityLevels].map(([key,label]) => `<option value="${key}" ${goal?.activity === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      ${estimate ? `<small>Repouso: ${formatted(Math.round(estimate.basal))} kcal/dia · ${escaped(estimate.method)}. Manutenção com atividade: ${formatted(Math.round(estimate.maintenance))} kcal/dia.</small>
        ${estimate.kcal === null ? "<small>Sem meta automática de perda de peso para este perfil.</small>" : ""}` : "<small>Preencha o perfil adulto, registre um peso e salve o nível de atividade.</small>"}
      <button>Salvar objetivo</button>
      <small>Estimativas matemáticas para adultos, com base nos dados informados. Avisos comparam o diário a referências gerais e não diagnosticam deficiência. Consulte um profissional de saúde ou nutricionista para metas individuais.</small>
    </form>
  </div>`;
}

async function searchTaco(query) {
  foodQuery = query;
  const container = document.querySelector("#taco-results");
  if (!container) return;
  const words = normalized(query.trim()).split(/\s+/).filter(Boolean);
  if (query.trim().length < 2) { container.replaceChildren(); return; }
  container.textContent = "Consultando TACO…";
  try {
    if (!tacoIndex) {
      tacoRequest ??= wellnessRequest("taco-index").then(index => { tacoIndex = index; })
        .finally(() => { tacoRequest = null; });
      await tacoRequest;
    }
    if (!container.isConnected || query !== foodQuery) return;
    const matches = tacoIndex.filter(([,label]) => words.every(word => normalized(label).includes(word)));
    container.innerHTML = matches.length ? matches.slice(0, 15).map(([id,label]) =>
      `<button data-action="wellness" data-op="taco-food" data-value="${id}">${escaped(label)}</button>`).join("") : "<small>Nenhum alimento encontrado.</small>";
  } catch (error) {
    if (container.isConnected && query === foodQuery) container.textContent = error.message;
  }
}

async function lookupFood(operation, argument, profileId = state.scaleProfileId) {
  const request = ++foodDetailRequest;
  toast("Consultando alimento…");
  try {
    const food = await wellnessRequest(operation, argument);
    if (request !== foodDetailRequest || page !== "nutrition" || profileId !== state.scaleProfileId || sheet.open) return;
    if (!food) { foodForm({barcode: argument}); toast("Produto não encontrado. Você pode usar os dados do rótulo."); }
    else foodForm(food);
  } catch (error) { toast(error.message); }
}

function foodForm(food = {}) {
  openSheet("Registrar alimento", `<form id="food-entry" class="stack">
    <input type="hidden" name="source" value="${escaped(food.source || "Rótulo / manual")}">
    <input type="hidden" name="barcode" value="${escaped(food.barcode || "")}">
    <label class="field">Alimento<input name="foodName" required maxlength="160" value="${escaped((food.name || "").slice(0, 160))}"></label>
    <div class="row"><label class="field grow">Quantidade consumida<input name="portion" type="number" min=".1" max="10000" step="any" required value="100"></label>
      <label class="field">Unidade<select name="unit"><option value="g">g</option><option value="mL" ${food.unit === "mL" ? "selected" : ""}>mL</option></select></label></div>
    <small>Confira os valores do rótulo por 100 g ou 100 mL. Deixe em branco se faltar algum dado.</small>
    ${nutrientFields.map(([key,label,unit]) => `<label class="field">${label} (${unit} por 100)<input name="${key}" type="number" min="0" step="any" max="${key === "energy" ? 1000 : 100}" value="${escaped(food[key] ?? "")}"></label>`).join("")}
    <small>Fonte: ${escaped(food.source || "Cadastro manual")}</small>
    <button class="primary">Salvar no diário</button></form>`);
}

async function wellnessAction(action, value, control) {
  if (action !== "wellness") return;
  const operation = control.dataset.op;
  if (operation === "water-add") recordWater(Number(value));
  if (operation === "water-delete") recordWater(0, value);
  if (operation === "taco-food") lookupFood("taco-food", value);
  if (operation === "manual-food") foodForm();
  if (operation === "food-delete") {
    const w = wellnessData();
    const day = nutritionDay();
    const meals = (w.meals?.[day] || []).filter(food => food.id !== value);
    if (saveWellnessData({...w, meals: {...w.meals, [day]: meals}})) render(true);
  }
  if (operation === "barcode") {
    const owner = state.scaleProfileId;
    control.disabled = true;
    try {
      const code = await wellnessRequest("barcode");
      if (code && page === "nutrition" && owner === state.scaleProfileId) await lookupFood("product", code, owner);
    } catch (error) { toast(error.message); }
    finally { control.disabled = false; }
  }
}

function saveWellness(form) {
  const fields = form.elements;
  const w = wellnessData();
  if (form.id === "water-add") recordWater(fields.ml.valueAsNumber);
  else if (form.id === "water-goal") {
    const goal = fields.goal.valueAsNumber;
    const today = todayWellness();
    const waterTargets = { ...w.waterTargets, [today]: goal };
    if (saveWellnessData({...w, waterGoal: goal, waterTargets})) render(true);
  } else if (form.id === "water-reminder") {
    wellnessRequest("reminder", [fields.start.value,fields.end.value,fields.interval.value].join(","))
      .then(() => toast("Lembretes salvos.")).catch(error => toast(error.message));
  } else if (form.id === "nutrition-goal") {
    const nutritionGoal = {type:fields.type.value, activity:fields.activity.value};
    const today = todayWellness();
    const nutritionTargets = {...w.nutritionTargets};
    nutritionTargets[today] = caloricEstimate(activeScaleProfile(), nutritionGoal)?.kcal ?? null;
    if (saveWellnessData({...w, nutritionGoal, nutritionTargets})) render(true);
  } else if (form.id === "barcode-lookup") lookupFood("product", fields.barcode.value.trim());
  else if (form.id === "food-entry") {
    const name = fields.foodName.value.trim();
    if (!name) { toast("Informe o nome do alimento."); return true; }
    const day = nutritionDay();
    const food = {id:newId("food"), name, source:fields.source.value, barcode:fields.barcode.value,
      portion:fields.portion.valueAsNumber, unit:fields.unit.value};
    for (const [key] of nutrientFields) food[key] = Number.isFinite(fields[key].valueAsNumber) ? fields[key].valueAsNumber : null;
    const kcal = w.nutritionTargets?.[day] ?? caloricEstimate(activeScaleProfile(), w.nutritionGoal)?.kcal ?? null;
    const nutritionTargets = { ...w.nutritionTargets, [day]: kcal };
    if (saveWellnessData({...w, nutritionTargets, meals:{...w.meals, [day]:[...(w.meals?.[day] || []), food]}})) {
      closeSheet();
      render(true);
      toast("Alimento registrado.");
    }
  } else return false;
  return true;
}
