"use strict";

const outdoorSports = new Map([
  ["Run", "Corrida"], ["TrailRun", "Corrida de trilha"], ["Ride", "Pedal"],
  ["MountainBikeRide", "Mountain bike"], ["Walk", "Caminhada"], ["Hike", "Trilha"],
  ["Swim", "Natação"], ["Rowing", "Remo"], ["Elliptical", "Elíptico"],
  ["InlineSkate", "Patinação"], ["JumpRope", "Pular corda"], ["Mobility", "Mobilidade / alongamento"],
  ["Warmup", "Aquecimento"], ["Workout", "Outra atividade"]
]);

function outdoorEntries() {
  return activeScaleProfile().outdoorActivities || [];
}

function activityById(id) {
  return outdoorEntries().find(entry => entry.id === id);
}

function replaceOutdoorEntries(next) {
  const owner = activeScaleProfile();
  const previous = owner.outdoorActivities;
  owner.outdoorActivities = next;
  if (save()) return true;
  owner.outdoorActivities = previous;
  return false;
}

function activityDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? (remainder ? `${hours} h ${remainder} min` : `${hours} h`) : `${remainder} min`;
}

function activitySubtitle(entry) {
  return [outdoorSports.get(entry.sport), activityDuration(entry.minutes),
    entry.km === null ? "" : `${formatted(entry.km)} km`].filter(Boolean).join(" · ");
}

function activityDate(entry) {
  return new Date(entry.start).toLocaleString("pt-BR", {dateStyle: "short", timeStyle: "short"});
}

function activityRow(entry, withDate = false) {
  return `<button type="button" class="catalog-result" data-action="view-activity" data-value="${escaped(entry.id)}">
    <span class="tile-icon">${glyph("history")}</span>
    <span class="grow"><strong>${escaped(entry.title)}</strong><br>
    <small>${withDate ? escaped(activityDate(entry)) + " · " : ""}${escaped(activitySubtitle(entry))}</small></span>
    ${glyph("next")}</button>`;
}

function activities() {
  const entries = [...outdoorEntries()].sort((a,b) => b.start.localeCompare(a.start));
  return heading("Atividades", true) + `<div class="stack">
    <section class="glass stack">
      <h2>${escaped(activeScaleProfile().name)}</h2>
      ${scaleProfilePicker()}
      ${button("new-activity", "Registrar atividade", "plus", "primary")}
    </section>
    <section class="glass stack"><h2>Registros neste aparelho</h2>
      ${entries.length ? entries.map(entry => activityRow(entry, true)).join("") : "<p class='muted'>Nenhuma atividade registrada.</p>"}
    </section></div>`;
}

function activityDayPanel(day) {
  const entries = outdoorEntries().filter(entry => entry.start.slice(0,10) === day);
  if (!entries.length) return "";
  return `<section class="glass stack"><h2>Atividades do dia</h2>${entries.map(entry => activityRow(entry)).join("")}</section>`;
}

function activityEditor(entry) {
  const now = new Date();
  const localNow = localDate(now) + "T" + String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0");
  openSheet(entry ? "Editar atividade" : "Registrar atividade", `<form id="activity-editor" class="stack">
    <input type="hidden" name="activityId" value="${escaped(entry?.id || "")}">
    <label class="field">Modalidade<select name="sport">
      ${[...outdoorSports].map(([key,label]) => `<option value="${key}" ${entry?.sport === key ? "selected" : ""}>${label}</option>`).join("")}
    </select></label>
    <label class="field">Nome<input name="title" required maxlength="100" value="${escaped(entry?.title || "")}"></label>
    <label class="field">Data e hora<input name="start" type="datetime-local" required max="${localNow}" value="${escaped(entry?.start || localNow)}"></label>
    <label class="field">Duração (min)<input name="minutes" type="number" required min="1" max="1440" value="${entry?.minutes ?? ""}"></label>
    <label class="field">Distância (km, opcional)<input name="km" type="number" min="0.001" max="2000" step="any" inputmode="decimal" value="${entry?.km ?? ""}"></label>
    <label class="field">Notas<textarea name="notes" rows="3" maxlength="1000">${escaped(entry?.notes || "")}</textarea></label>
    <button class="primary">Salvar atividade</button></form>`);
}

function saveActivity(form) {
  if (!form.reportValidity()) return;
  const fields = form.elements;
  const title = fields.title.value.trim();
  if (!title) { toast("Informe o nome da atividade."); return; }
  const id = fields.activityId.value;
  if ((id && !activityById(id)) || !outdoorSports.has(fields.sport.value)) return;
  const entry = { id: id || newId("atividade"), title, sport: fields.sport.value,
    start: fields.start.value, minutes: fields.minutes.valueAsNumber,
    km: Number.isFinite(fields.km.valueAsNumber) ? fields.km.valueAsNumber : null, notes: fields.notes.value.trim() };
  const previous = outdoorEntries();
  const next = id ? previous.map(item => item.id === id ? entry : item) : [...previous, entry];
  const before = achievementKeys();
  if (!replaceOutdoorEntries(next)) return;
  selectedDay = entry.start.slice(0, 10);
  closeSheet();
  render(true);
  if (!announceAchievements(before)) toast("Atividade salva.");
}

function viewActivity(id) {
  const entry = activityById(id);
  if (!entry) return;
  openSheet(entry.title, `<div class="stack">
    <p>${escaped(activityDate(entry))}</p>
    <p>${escaped(activitySubtitle(entry))}</p>
    ${entry.notes ? `<p class="note">${escaped(entry.notes)}</p>` : ""}
    ${button("edit-activity", "Editar", "edit", "", id)}
    ${button("ask-remove-activity", "Excluir", "trash", "danger", id)}</div>`);
}

function removeActivity(id) {
  if (!activityById(id) || !replaceOutdoorEntries(outdoorEntries().filter(entry => entry.id !== id))) return;
  closeSheet();
  render(true);
}
