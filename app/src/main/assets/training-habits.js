"use strict";

const habitInfo = (profile = activeScaleProfile()) => profile.trainingHabits || {};
const habitLabels = {rest:"Descanso planejado", mobility:"Mobilidade", warmup:"Aquecimento"};

function trainingHabits() {
  const data = habitInfo();
  return heading("Metas e recuperação", true) + `<div class="stack">
    <form id="weekly-goal" class="glass stack"><h2>Meta semanal de treinos</h2>
      <label class="field">Treinos por semana<input name="target" type="number" min="0" max="7" required value="${data.weekly || 0}"></label>
      <small>Use 0 para desativar. A semana vai de segunda a domingo.</small>
      <button>Salvar meta semanal</button></form>
    <section class="glass stack"><h2>Metas pessoais</h2>
      <form id="personal-goal" class="stack">
        <label class="field">Nova meta<input name="goal" maxlength="100" required></label>
        <button>Criar meta</button>
      </form>
      ${(data.goals || []).map(goal => `<div class="stack habit-entry">
        <strong>${escaped(goal.title)}</strong><small>${goal.done ? "Concluída" : "Em andamento"} · criada em ${dayDate(goal.created).toLocaleDateString("pt-BR")}</small>
        <div class="row wrap">
          <button type="button" data-action="habit-action" data-op="toggle-goal" data-value="${escaped(goal.id)}">${goal.done ? "Reabrir meta" : "Concluir meta"}</button>
          <button type="button" class="danger" data-action="habit-action" data-op="confirm-goal" data-value="${escaped(goal.id)}">Excluir meta</button>
        </div></div>`).join("")}
    </section>
    <section class="glass stack"><h2>Descanso planejado</h2>
      <form id="rest-day" class="stack">
        <label class="field">Data<input type="date" name="day" max="${localDate(Date.now())}" required value="${localDate(Date.now())}"></label>
        <button>Registrar descanso</button></form>
      <small>Registre apenas dias de descanso cumpridos. Para mobilidade e aquecimento, escolha a modalidade ao registrar uma atividade.</small>
      ${(data.restDays || []).slice().reverse().map(day => `<div class="row spread habit-entry">
        <span>${dayDate(day).toLocaleDateString("pt-BR")}</span>
        <button type="button" data-action="habit-action" data-op="remove-rest" data-value="${day}">Remover descanso</button></div>`).join("")}
    </section>
  </div>`;
}

function saveHabits(next) {
  const before = achievementKeys();
  const profile = activeScaleProfile();
  const previous = profile.trainingHabits;
  profile.trainingHabits = next;
  if (!save()) { profile.trainingHabits = previous; return; }
  if (sheet.open) closeSheet();
  render(true);
  announceAchievements(before);
}

function saveTrainingHabit(form) {
  if (!["weekly-goal","personal-goal","rest-day"].includes(form.id)) return false;
  if (!form.reportValidity()) return true;
  const data = habitInfo();
  const fields = form.elements;
  if (form.id === "weekly-goal") saveHabits({...data, weekly: fields.target.valueAsNumber});
  if (form.id === "personal-goal") {
    const title = fields.goal.value.trim();
    if (!title) { toast("Informe a meta."); return true; }
    saveHabits({...data, goals:[...(data.goals || []), {id:newId("meta"),title,created:localDate(Date.now()),done:null}]});
  }
  if (form.id === "rest-day") {
    saveHabits({...data, restDays:[...new Set([...(data.restDays || []),fields.day.value])].sort()});
  }
  return true;
}

function handleHabit(action, control) {
  if (action !== "habit-action") return;
  const id = control.dataset.value;
  const data = habitInfo();
  const goals = data.goals || [];
  switch (control.dataset.op) {
    case "toggle-goal":
      saveHabits({...data,goals:goals.map(goal => goal.id === id ? {...goal,done:goal.done ? null : localDate(Date.now())} : goal)});
      break;
    case "confirm-goal":
      openSheet("Excluir meta?", `<div class="stack"><p>O app vai recalcular as medalhas ligadas à meta.</p>
        <button type="button" class="danger" data-action="habit-action" data-op="remove-goal" data-value="${escaped(id)}">Excluir registro da meta</button></div>`);
      break;
    case "remove-goal": saveHabits({...data,goals:goals.filter(goal => goal.id !== id)}); break;
    case "remove-rest": saveHabits({...data,restDays:(data.restDays || []).filter(day => day !== id)}); break;
  }
}
