"use strict";

const methods = { normal: "Tradicional", drop: "Drop set", increase: "Aumento de carga", pyramid: "Pirâmide", restPause: "Rest-pause", other: "Outro" };
const kg = value => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value) + " kg";
const localDate = timestamp => {
  const date = new Date(timestamp);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => String(n).padStart(2, "0")).join("-");
};
const dayDate = key => new Date(key + "T12:00:00");
const dateLabel = date => date.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
const duration = seconds => {
  const minutes = Math.floor(seconds / 60);
  if (!minutes) return `${seconds} s`;
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};
let selectedDay = localDate(Date.now());
let progressExercise = "";

function actualSet(active, index, set) {
  const planned = active.plan.exercises[index];
  return active.log?.[index]?.sets[set] || { weight: planned.weight, reps: planned.reps };
}

function editExerciseLog(index) {
  const active = state.active;
  const planned = active.plan.exercises[index];
  const record = active.log?.[index];
  openSheet(titleFor(exerciseFor(planned)), `<form id="exercise-log" data-index="${index}" class="stack">
    <label class="field">Método<select name="method">
      ${Object.entries(methods).map(([value, name]) => `<option value="${value}" ${record?.method === value ? "selected" : ""}>${name}</option>`).join("")}
    </select></label>
    ${active.checked[index].map((done, set) => {
      const entry = actualSet(active, index, set);
      return `<fieldset class="glass"><legend>Série ${set + 1}${done ? " · concluída" : ""}</legend>
        <div class="log-fields">
          <label class="field">Carga (kg)<input name="weight" required inputmode="decimal" maxlength="7" value="${escaped(entry.weight)}"></label>
          <label class="field">Repetições<input name="reps" required type="number" min="1" max="999" value="${entry.reps}"></label>
        </div>
        <label class="field drop-field" ${record?.method === "drop" ? "" : "hidden"}>Reduções (kg)
          <input name="drops" maxlength="80" inputmode="text" placeholder="Ex.: 20 / 15" value="${escaped((entry.drops || []).map(value => String(value).replace(".", ",")).join(" / "))}">
        </label></fieldset>`;
    }).join("")}
    <label class="field">Notas da sessão<textarea name="note" maxlength="500" rows="3">${escaped(record?.note)}</textarea></label>
    <button class="primary" type="submit">Salvar registro</button>
  </form>`);
}

function saveExerciseLog(form) {
  const index = Number(form.dataset.index);
  const data = new FormData(form);
  const weights = [...form.querySelectorAll('[name="weight"]')];
  const drops = [...form.querySelectorAll('[name="drops"]')];
  const reps = data.getAll("reps");
  const method = data.get("method");
  const parseWeight = input => {
    const normalized = input.trim().replace(",", ".");
    return /^\d+(?:\.\d{1,2})?$/.test(normalized) && Number(normalized) <= 9999 ? Number(normalized) : NaN;
  };
  const sets = [];
  for (const [set, field] of weights.entries()) {
    const weight = parseWeight(field.value);
    const reduction = drops[set];
    const stages = method === "drop" && reduction.value.trim() ? reduction.value.split("/").map(parseWeight) : [];
    if (!Number.isFinite(weight)) {
      field.setCustomValidity("Informe uma carga válida em kg."); field.reportValidity(); return;
    }
    if (stages.some((stage, i) => !Number.isFinite(stage) || stage >= (i ? stages[i - 1] : weight))) {
      reduction.setCustomValidity("Informe cargas decrescentes separadas por /."); reduction.reportValidity(); return;
    }
    sets.push({ weight, reps: Number(reps[set]), drops: stages });
  }
  const previous = state.active.log;
  state.active.log = { ...previous, [index]: { method, sets, note: data.get("note").trim() } };
  if (!save()) { state.active.log = previous; return; }
  closeSheet();
  render(true);
}

function snapshotWorkout(active) {
  return active.plan.exercises.map((item, index) => ({
    id: item.id, name: titleFor(exerciseFor(item)), method: active.log?.[index]?.method || "normal",
    note: active.log?.[index]?.note || "",
    sets: active.checked[index].flatMap((done, set) => done ? [{ number: set + 1, ...actualSet(active, index, set) }] : [])
  }));
}

function calendarMonth(offset) {
  const date = dayDate(selectedDay);
  const month = new Date(date.getFullYear(), date.getMonth() + offset, 1, 12);
  selectedDay = localDate(month);
  render(true);
}

function progressionPoints(id) {
  let previousBest;
  let previousWeight;
  return [...state.history].sort((a, b) => a.ended - b.ended).flatMap(entry => {
    const sets = (entry.records || []).filter(record => record.id === id).flatMap(record => record.sets);
    if (!sets.length) return [];
    const weight = Math.max(...sets.map(set => set.weight));
    const gain = previousWeight === undefined ? 0 : Math.max(0, Math.round((weight - previousWeight) * 100) / 100);
    const record = previousBest !== undefined && weight > previousBest;
    previousWeight = weight;
    previousBest = Math.max(previousBest ?? weight, weight);
    return [{ ended: entry.ended, weight, gain, record }];
  }).reverse();
}

function history() {
  const date = dayDate(selectedDay);
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const leading = (first.getDay() + 6) % 7;
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const byDay = new Map();
  const tracked = new Map();
  for (const [index, entry] of state.history.entries()) {
    const key = localDate(entry.ended);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push({ entry, index });
    for (const record of (entry.records || [])) if (record.sets.length && !tracked.has(record.id)) tracked.set(record.id, record.name);
  }
  const weekStart = dayDate(selectedDay);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEntries = state.history.filter(entry => {
    const key = localDate(entry.ended);
    return key >= localDate(weekStart) && key <= localDate(weekEnd);
  });
  const weekExercises = weekEntries.reduce((sum, entry) => sum + entry.exercises, 0);
  const weekSeconds = weekEntries.reduce((sum, entry) => sum + entry.seconds, 0);
  const selectedEntries = byDay.get(selectedDay) || [];
  const currentExercise = tracked.has(progressExercise) ? progressExercise : tracked.keys().next().value;
  const points = currentExercise ? progressionPoints(currentExercise) : [];
  return heading("Calendário") + `<div class="stack">
    <section class="glass stack">
      <div class="row spread">
        ${iconButton("calendar-month", "Mês anterior", "back", -1)}
        <h2 class="calendar-title">${date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2>
        ${iconButton("calendar-month", "Mês seguinte", "next", 1)}
      </div>
      <div class="calendar-grid" aria-label="Dias do mês">
        ${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(day => `<small>${day}</small>`).join("")}
        ${"<span aria-hidden=\"true\"></span>".repeat(leading)}
        ${Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const key = localDate(new Date(date.getFullYear(), date.getMonth(), day, 12));
          const entries = byDay.get(key) || [];
          return `<button type="button" data-action="calendar-day" data-value="${key}" aria-pressed="${key === selectedDay}"
            aria-label="${dateLabel(dayDate(key))}, ${plural(entries.length, "treino", "treinos")}${activeScaleProfile().weights[key] ? ", com pesagem" : ""}"><span>${day}</span>
            ${activeScaleProfile().weights[key] ? '<span class="weight-dot" aria-hidden="true"></span>' : ""}
            ${entries.length ? `<span class="calendar-dot" aria-hidden="true"></span>` : ""}</button>`;
        }).join("")}
      </div>
    </section>
    <section class="glass stack"><div><h2>Resumo da semana</h2><small>${dateLabel(weekStart)} a ${dateLabel(weekEnd)}</small></div>
      <div class="week-stats"><div><strong>${weekEntries.length}</strong><small>Treinos</small></div>
      <div><strong>${weekExercises}</strong><small>Exercícios concluídos</small></div>
      <div><strong>${duration(weekSeconds)}</strong><small>Tempo registrado</small></div></div>
    </section>
    ${weightEvolution(selectedDay)}
    <section class="glass stack"><h2>${dateLabel(date)}</h2>
      ${selectedEntries.length ? selectedEntries.map(({ entry, index }) => `<article class="row spread">
        <div class="grow"><h3>${escaped(entry.name)}</h3><small>${duration(entry.seconds)} · ${entry.sets}/${entry.total} séries</small></div>
        ${iconButton("history-entry", "Abrir " + entry.name, "next", index)}</article>`).join("") : '<p class="muted">Nenhum treino registrado neste dia.</p>'}
    </section>
    <section class="glass stack"><h2>Evolução de carga</h2>
      ${currentExercise ? `<label class="field">Exercício<select id="progress-exercise">
        ${[...tracked].map(([id, name]) => `<option value="${escaped(id)}" ${id === currentExercise ? "selected" : ""}>${escaped(name)}</option>`).join("")}</select></label>
        <small>Maior carga de uma série concluída em cada treino.</small>
        <div class="progress-points">${points.map(point => `<div class="row spread muscle-entry"><span>${new Date(point.ended).toLocaleDateString("pt-BR")}</span>
          <strong>${kg(point.weight)}</strong>${point.gain ? `<small class="green">+${kg(point.gain)}${point.record ? " · recorde" : ""}</small>` : ""}</div>`).join("")}</div>`
        : '<p class="muted">As cargas das próximas sessões finalizadas aparecem aqui.</p>'}
    </section>
  </div>`;
}

function openHistoryEntry(index) {
  const entry = state.history[index];
  openSheet(entry.name, `<div class="stack">
    <p class="muted">${new Date(entry.ended).toLocaleDateString("pt-BR")} · ${duration(entry.seconds)} · ${entry.sets}/${entry.total} séries</p>
    ${entry.records ? entry.records.map(record => `<article class="glass stack"><div>
      <h3>${escaped(record.name)}</h3><small>${methods[record.method] || methods.normal}</small></div>
      ${record.sets.length ? record.sets.map(set => `<div><small>Série ${set.number} · ${set.reps} reps · ${kg(set.weight)}
        ${set.drops?.length ? " → " + set.drops.map(kg).join(" → ") : ""}</small></div>`).join("") : '<small>Nenhuma série concluída.</small>'}
      ${record.note ? `<p class="note">${escaped(record.note)}</p>` : ""}</article>`).join("")
      : '<p class="muted">Este treino foi salvo antes do registro de cargas por série.</p>'}
  </div>`);
}
