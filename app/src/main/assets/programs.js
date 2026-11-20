"use strict";

const weekDays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const getSlotLabel = (mode, index) => mode === "weekly" ? weekDays[index] : String.fromCharCode(65 + index);
const getWorkout = id => state.plans.find(workout => workout.id === id);
let selectedProgram = null;
let programDraft = null;

function programs() {
  const program = state.programs.find(item => item.id === selectedProgram);
  const todayIndex = (new Date().getDay() + 6) % 7;
  if (program) {
    const rows = program.slots.flatMap(id => getWorkout(id)?.exercises || []);
    return heading(program.name, true) + `<div class="stack">
      <div class="row spread"><h2>${program.mode === "weekly" ? "Semana" : "Sequência"}</h2>
        ${button("edit-program", "Editar", "edit", "", program.id)}</div>
      ${program.slots.map((id, index) => {
        const workout = getWorkout(id);
        const highlighted = program.mode === "weekly" ? index === todayIndex : index === program.next;
        return `<article class="glass stack ${highlighted ? "next-workout" : ""}">
          <div class="row spread"><strong>${getSlotLabel(program.mode, index)}</strong>
            ${highlighted ? `<small class="accent">${program.mode === "weekly" ? "Hoje" : "Próximo treino"}</small>` : ""}</div>
          <h3>${workout ? escaped(workout.name) : program.mode === "weekly" ? "Descanso" : "Sem ficha"}</h3>
          ${workout ? `<div class="row wrap">${button("view-workout", "Ver ficha", "info", "", id)}
            ${button("start-slot", "Iniciar", "play", "primary", index)}</div>` : ""}
        </article>`;
      }).join("")}
      <h2>Cobertura do plano</h2>${musclePanel(rows)}
    </div>`;
  }
  return heading("Planos de treino") + `<div class="stack">
    ${button("new-program", "Criar plano", "plus", "primary")}
    ${state.programs.map(item => `<article class="glass row spread"><div class="grow">
      <h3>${escaped(item.name)}</h3><small>${item.mode === "weekly" ? "Por dia da semana" : "Sequência A/B/C"}</small></div>
      ${button("view-program", "Abrir", "next", "", item.id)}</article>`).join("")}
    ${state.programs.length ? "" : '<p class="glass muted">Agrupe suas fichas para alternar treinos ou montar uma semana.</p>'}
  </div>`;
}

function editProgram(program) {
  programDraft = {
    id: program?.id, name: program?.name || "", mode: program?.mode || "sequence",
    sequence: program?.mode === "sequence" ? [...program.slots] : [""],
    weekly: program?.mode === "weekly" ? [...program.slots] : Array(7).fill("")
  };
  showProgramEditor();
}

function showProgramEditor() {
  const { id, name, mode } = programDraft;
  const slots = programDraft[mode];
  openSheet(id ? "Editar plano" : "Criar plano", `<form id="program-editor" class="stack">
    <label class="field">Nome do plano<input name="name" maxlength="65" required value="${escaped(name)}"></label>
    <label class="field">Organização<select name="mode" aria-label="Organização">
      <option value="sequence" ${mode === "sequence" ? "selected" : ""}>Sequência A/B/C</option>
      <option value="weekly" ${mode === "weekly" ? "selected" : ""}>Dias da semana</option>
    </select></label>
    ${slots.map((selected, index) => `<div class="row"><label class="field grow">${getSlotLabel(mode, index)}
      <select name="slot" aria-label="${getSlotLabel(mode, index)}" data-slot="${index}" ${mode === "sequence" ? "required" : ""}>
        <option value="">${mode === "weekly" ? "Descanso" : "Selecione a ficha"}</option>
        ${state.plans.map(workout => `<option value="${escaped(workout.id)}" ${workout.id === selected ? "selected" : ""}>${escaped(workout.name)}</option>`).join("")}
      </select></label>
      ${mode === "sequence" && slots.length > 1 ? iconButton("remove-slot", "Remover etapa " + getSlotLabel(mode, index), "trash", index) : ""}
    </div>`).join("")}
    ${mode === "sequence" && slots.length < 26 ? button("add-slot", "Adicionar etapa", "plus") : ""}
    <button class="primary" type="submit">Salvar plano</button>
    ${id ? button("delete-program", "Excluir plano", "trash", "danger", id) : ""}
  </form>`);
}

function saveProgram() {
  const name = programDraft.name.trim();
  const { mode } = programDraft;
  const slots = programDraft[mode];
  if (!name || !slots.some(Boolean)) { toast("Informe um nome e escolha pelo menos uma ficha."); return; }
  const previous = state.programs;
  const existing = previous.find(item => item.id === programDraft.id);
  const sameSlots = existing?.mode === mode && existing.slots.join("|") === slots.join("|");
  const program = { id: existing?.id || newId("plano"), name, mode, slots, next: sameSlots ? existing.next : 0 };
  state.programs = existing ? previous.map(item => item.id === program.id ? program : item) : [...previous, program];
  if (!save()) { state.programs = previous; return; }
  selectedProgram = program.id;
  closeSheet();
  go("programs");
}

function startSlot(index) {
  const program = state.programs.find(item => item.id === selectedProgram);
  const workout = getWorkout(program?.slots[index]);
  if (workout) startSetup(workout, { id: program.id, index, slots: [...program.slots] });
}

function advanceProgram(active) {
  const link = active.program;
  const program = state.programs.find(item => item.id === link?.id);
  if (program?.mode !== "sequence" || program.slots.join("|") !== link.slots.join("|")) return;
  program.next = (link.index + 1) % program.slots.length;
}

function viewWorkout(workout) {
  openSheet(workout.name, `<div class="stack">
    ${workout.note ? `<p class="note">${escaped(workout.note)}</p>` : ""}
    ${workout.exercises.map(row => {
      const exercise = exerciseFor(row);
      return `<div class="stack">${exerciseDetailsButton(exercise, `${row.sets} séries · ${row.reps} reps · ${kg(row.weight)}`)}
        ${row.note ? `<p class="note">${escaped(row.note)}</p>` : ""}</div>`;
    }).join("")}
    ${musclePanel(workout.exercises)}
  </div>`);
}

function showCustomExercise() {
  const choices = Object.entries(muscles);
  openSheet("Criar exercício", `<form id="custom-exercise" class="stack">
    <label class="field">Nome do exercício<input name="name" required maxlength="80"></label>
    <label class="field">Equipamento <input name="equipment" maxlength="60"></label>
    <h3>Grupos musculares</h3>
    ${choices.map(([key, name]) => `<label class="field muscle-choice"><span>${escaped(name)}</span>
      <select name="muscle" aria-label="${escaped(name)}" data-muscle="${escaped(key)}"><option value="">—</option>
      <option value="primary">Principal</option><option value="secondary">Secundário</option></select></label>`).join("")}
    <label class="field">Instruções<textarea name="instructions" maxlength="600" rows="3"></textarea></label>
    <button class="primary" type="submit">Salvar exercício</button>
    ${picker ? button("pick", "Voltar ao catálogo", "back") : ""}
  </form>`);
}

function saveCustomExercise(form) {
  const data = new FormData(form);
  const name = data.get("name").trim();
  if (!name) { toast("Informe o nome do exercício."); return; }
  if ([...catalog.values()].some(item => [item.name, titleFor(item)].some(label => normalized(label) === normalized(name)))) {
    toast("Já existe um exercício com esse nome."); return;
  }
  const groups = [...form.querySelectorAll("[data-muscle]")];
  const instructions = data.get("instructions").trim();
  const item = { id: newId("exercicio"), name, equipment: data.get("equipment").trim(),
    primaryMuscles: groups.filter(field => field.value === "primary").map(field => field.dataset.muscle),
    secondaryMuscles: groups.filter(field => field.value === "secondary").map(field => field.dataset.muscle),
    images: [], instructions: instructions ? [instructions] : [], custom: true };
  state.custom.push(item);
  if (!save()) { state.custom.pop(); return; }
  catalog.set(item.id, item);
  if (picker) draft.exercises.push({ id: item.id, sets: 3, reps: 10, weight: 0 });
  closeSheet();
  render(true);
  toast("Exercício salvo");
}
