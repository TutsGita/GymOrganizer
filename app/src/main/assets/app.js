"use strict";

const screen = document.querySelector("#screen");
const navigation = document.querySelector("#navigation");
const sheet = document.querySelector("#sheet");
const photoViewer = document.querySelector("#photo-viewer");
const storageKey = "gym-organizer-v1";
const sessionStorageKey = storageKey + "-active-session";
const catalog = new Map();
let catalogReady = false;
let catalogLoading = null;
const aliases = {
  "Barbell_Bench_Press_-_Medium_Grip": "Supino reto com barra",
  Dumbbell_Bench_Press: "Supino reto com halteres",
  Barbell_Squat: "Agachamento com barra",
  Dumbbell_Lunges: "Afundo com halteres",
  Leg_Press: "Leg press",
  Leg_Extensions: "Cadeira extensora",
  Seated_Leg_Curl: "Cadeira flexora",
  Barbell_Deadlift: "Levantamento terra",
  "Wide-Grip_Lat_Pulldown": "Puxada alta aberta",
  Seated_Cable_Rows: "Remada baixa",
  Bent_Over_Barbell_Row: "Remada curvada",
  Dumbbell_Bicep_Curl: "Rosca direta com halteres",
  Barbell_Curl: "Rosca direta com barra",
  Triceps_Pushdown: "Tríceps na polia",
  Side_Lateral_Raise: "Elevação lateral",
  Dumbbell_Shoulder_Press: "Desenvolvimento com halteres",
  Pushups: "Flexão de braços",
  Plank: "Prancha"
};
const muscles = {
  abdominals: "abdômen", abductors: "abdutores", adductors: "adutores",
  biceps: "bíceps", calves: "panturrilhas", chest: "peito", forearms: "antebraços",
  glutes: "glúteos", hamstrings: "posteriores da coxa", lats: "dorsais",
  "lower back": "lombar", "middle back": "costas", neck: "pescoço",
  quadriceps: "quadríceps", shoulders: "ombros", traps: "trapézio", triceps: "tríceps",
  obliques: "oblíquos", "hip flexors": "flexores do quadril", shins: "tibiais anteriores"
};
const equipment = {
  barbell: "barra", dumbbell: "halteres", cable: "polia", machine: "máquina",
  "body only": "peso corporal", kettlebells: "kettlebell", bands: "elásticos",
  "e-z curl bar": "barra W", "exercise ball": "bola", "medicine ball": "medicine ball"
};
const escaped = value => String(value ?? "").replace(/[&<>"']/g, ch =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const normalized = value => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const titleFor = item => aliases[item.id] || item.name;
const muscleFor = item => (item.primaryMuscles || []).map(value => muscles[value] || value).join(", ");
const searchText = item => normalized([item.name, item.originalName, titleFor(item), item.equipment,
  equipment[item.equipment], ...[...(item.primaryMuscles || []), ...(item.secondaryMuscles || [])]
    .flatMap(key => [key, muscles[key]])].filter(Boolean).join(" "));
const popularIds = Object.keys(aliases);
const glyph = name => `<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">${window.GYM_ICONS?.[name] || ""}</svg>`;
const button = (action, label, icon, extra = "", value = "") =>
  `<button type="button" class="with-icon ${extra}" data-action="${action}" data-value="${escaped(value)}">${icon ? glyph(icon) : ""}${escaped(label)}</button>`;
const iconButton = (action, label, icon, value = "") =>
  `<button type="button" class="icon-button" aria-label="${escaped(label)}" title="${escaped(label)}" data-action="${action}" data-value="${escaped(value)}">${glyph(icon)}</button>`;
const photo = (path, css = "", alt = "") =>
  `<img class="${css}" src="photos/${escaped(path.split("/").map(encodeURIComponent).join("/"))}" alt="${escaped(alt)}" loading="lazy">`;
const thumbnail = item => item.images?.[0] ? photo(item.images[0], "thumb") : `<span class="tile-icon">${glyph("fitness")}</span>`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const totalSets = plan => plan.exercises.reduce((sum, item) => sum + item.sets, 0);
const copy = value => JSON.parse(JSON.stringify(value));
const newId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const exerciseFor = item => catalog.get(item.id) || { id: item.id, name: item.id, images: [] };
const clock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const heading = (title, back = false) => `<header class="row bar">${back ? iconButton("back", "Voltar", "back") : ""}
  <div class="grow"><div class="brand">Gym Organizer</div><h1>${escaped(title)}</h1></div></header>`;

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Array.isArray(saved.plans) && Array.isArray(saved.history)) {
      const active = JSON.parse(localStorage.getItem(sessionStorageKey));
      return { ...saved, active: active || saved.active || null };
    }
  } catch (error) {
    console.warn("Falha ao ler os dados locais.", error);
  }
  return { plans: [], history: [], active: null, rest: 90 };
}

let state = readState();
state.scaleProfiles ??= {
  personal: { name: "Meu perfil", height: null, weights: {}, ...state.profile }
};
if (!Object.hasOwn(state.scaleProfiles, state.scaleProfileId)) {
  state.scaleProfileId = Object.keys(state.scaleProfiles)[0];
}
delete state.profile;
state.programs ??= [];
state.custom ??= [];
state.custom.forEach(item => catalog.set(item.id, item));
let page = state.active ? "session" : "home";
let draft = null;
let picker = false;
let setup = null;
let toastTimeout;

function toast(message) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { element.hidden = true; }, 2500);
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    if (state.active) localStorage.setItem(sessionStorageKey, JSON.stringify(state.active));
    else localStorage.removeItem(sessionStorageKey);
    return true;
  } catch (error) {
    console.error(error);
    toast("O armazenamento local está indisponível.");
    return false;
  }
}

function saveSessionProgress() {
  try {
    if (state.active) localStorage.setItem(sessionStorageKey, JSON.stringify(state.active));
    else localStorage.removeItem(sessionStorageKey);
    return true;
  } catch (error) {
    console.error(error);
    toast("O armazenamento local está indisponível.");
    return false;
  }
}

function loadCatalog() {
  if (catalogReady) return Promise.resolve();
  if (catalogLoading) return catalogLoading;
  const load = name => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = name;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Catálogo offline indisponível."));
    document.head.appendChild(script);
  });
  catalogLoading = Promise.all(["catalog.js", "wger-catalog.js", "catalog-pt.js", "wger-videos.js", "commons-videos.js"].map(load)).then(() => {
    for (const item of window.EXERCISES || []) catalog.set(item.id, item);
    for (const item of window.WGER_EXERCISES || []) {
      const previous = catalog.get(item.id);
      catalog.set(item.id, { ...previous, originalName: previous?.name, ...item });
    }
    for (const [id, [name, instructions]] of Object.entries(window.GYM_EXERCISES_PT)) {
      const item = catalog.get(id);
      if (item && !item.portuguese) {
        catalog.set(id, { ...item, originalName: item.originalName || item.name, name, instructions,
          portuguese: true, machineTranslated: true });
      }
    }
    for (const [id, video] of Object.entries({...window.WGER_VIDEO_ALIASES, ...window.COMMONS_EXERCISE_VIDEOS})) {
      const item = catalog.get(id);
      if (item && !item.video) item.video = video;
    }
    for (const item of state.custom) catalog.set(item.id, item);
    catalogReady = true;
    if (window.GymWellness?.hasSavedVideos?.()) {
      const currentVideos = [...new Set([...catalog.values()].flatMap(item => item.video ? [item.video.url] : []))];
      window.GymWellness.pruneSavedVideos(JSON.stringify(currentVideos));
    }
  }).finally(() => { catalogLoading = null; });
  return catalogLoading;
}

function home() {
  return heading("Meus treinos") + `
    ${state.active ? `<section class="glass row spread section-head"><div><h3>Treino em andamento</h3><small>${escaped(state.active.plan.name)}</small></div>${button("session", "Retomar", "play", "primary")}</section>` : ""}
    <section class="hero glass">
      <span class="tile-icon">${glyph("fitness")}</span>
      <h2>Monte sua ficha</h2>
      <p class="muted">Escolha os exercícios e defina suas séries, repetições e cargas.</p>
      ${button("new", "Criar treino", "plus", "primary")}
    </section>
    <div class="workout-shortcuts">${button("programs", "Planos", "list")}${button("library", "Exercícios", "search")}</div>
    <div class="row spread section-head"><h2>Minhas fichas</h2><small>${plural(state.plans.length, "treino", "treinos")}</small></div>
    <section class="stack">${state.plans.length ? state.plans.map(plan => `<article class="glass">
      <div class="row"><span class="tile-icon">${glyph("list")}</span><div class="grow"><h3>${escaped(plan.name)}</h3>
      <small>${plural(plan.exercises.length, "exercício", "exercícios")} · ${plural(totalSets(plan), "série", "séries")}</small></div>
      ${iconButton("edit", "Editar ficha", "edit", plan.id)}</div>
      <div class="card-actions">${button("view-workout", "Ver ficha", "info", "", plan.id)}${button("setup", "Iniciar treino", "play", "primary", plan.id)}</div>
    </article>`).join("") : '<div class="glass empty"><h3>Nenhuma ficha criada</h3><p class="muted">Seu primeiro treino aparece aqui.</p></div>'}</section>`;
}

function editor() {
  return heading(draft.id ? "Editar ficha" : "Criar treino", true) + `
    <form id="editor" class="stack">
      <label class="field">Nome do treino<input name="name" required maxlength="65" placeholder="Ex.: Treino A · Peito e tríceps" value="${escaped(draft.name)}"></label>
      <label class="field">Nota da ficha<textarea name="note" maxlength="500" rows="2">${escaped(draft.note)}</textarea></label>
      <div class="row spread"><h2>Exercícios</h2><small>${draft.exercises.length} na ficha</small></div>
      ${draft.exercises.map((item, index) => {
        const exercise = exerciseFor(item);
        return `<article class="glass">
          <div class="row">${thumbnail(exercise)}<h3 class="grow">${escaped(titleFor(exercise))}</h3>
          ${iconButton("remove-exercise", "Remover " + titleFor(exercise), "trash", index)}</div>
          <div class="fields">
            <label class="field">Séries<input type="number" required name="sets" data-index="${index}" min="1" max="30" value="${escaped(item.sets)}"></label>
            <label class="field">Repetições<input type="number" required name="reps" data-index="${index}" min="1" max="999" value="${escaped(item.reps)}"></label>
            <label class="field">Peso (kg)<input required inputmode="decimal" name="weight" data-index="${index}" value="${escaped(item.weight)}"></label>
          </div>
          <label class="field exercise-note">Nota do exercício<textarea name="note" data-index="${index}" maxlength="500" rows="2">${escaped(item.note)}</textarea></label>
          <div class="row exercise-note">
            ${index > 0 ? button("move-exercise", "Subir", "next", "move-up", `${index},-1`) : ""}
            ${index < draft.exercises.length - 1 ? button("move-exercise", "Descer", "next", "move-down", `${index},1`) : ""}
          </div>
          </article>`;
      }).join("")}
      ${button("pick", "Adicionar exercício", "plus")}
      <button class="primary with-icon" type="submit">${glyph("check")} Salvar ficha</button>
      ${draft.id ? button("delete-plan", "Excluir ficha", "trash", "danger") : ""}
    </form>`;
}

function library() {
  return heading("Exercícios") + `<section class="stack">
    ${button("create-custom", "Criar exercício", "plus")}
    <label class="field">Buscar no catálogo <input id="catalog-search" type="search" placeholder="Nome, músculo ou equipamento" autocomplete="off"></label>
    ${button("saved-exercise-videos", "Vídeos salvos", "play")}
    <div id="catalog-results" class="catalog"></div></section>`;
}

function showResults(container, query, adding) {
  if (!catalogReady) {
    container.innerHTML = '<p class="muted">Carregando exercícios…</p>';
    loadCatalog().then(() => showResults(container, query, adding))
      .catch(() => { container.innerHTML = '<p class="muted">Falha ao carregar catálogo.</p>'; });
    return;
  }
  const words = normalized(query.trim()).split(/\s+/).filter(Boolean);
  const found = words.length ? [...catalog.values()].filter(item => {
    const text = searchText(item);
    return words.every(word => text.includes(word));
  }) : [...state.custom, ...popularIds.map(id => catalog.get(id)).filter(Boolean)];
  const label = words.length ? plural(found.length, "resultado", "resultados") : `Próprios e populares · ${catalog.size} no catálogo`;
  container.innerHTML = `<small>${label}${found.length > 50 ? " · refine a busca para ver mais" : ""}</small>` +
    found.slice(0, 50).map(item => {
      const added = adding && draft.exercises.some(row => row.id === item.id);
      return `<button class="catalog-result" type="button" data-action="${adding ? "add-exercise" : "details"}" data-value="${escaped(item.id)}" ${added ? "disabled" : ""}>
        ${thumbnail(item)}<span class="grow"><strong>${escaped(titleFor(item))}</strong><br><small>${escaped(muscleFor(item))}</small></span>
        ${glyph(adding ? added ? "check" : "plus" : "next")}</button>`;
    }).join("") + (found.length ? "" : '<p class="muted">Nenhum exercício encontrado.</p>');
}

function openSheet(title, content) {
  sheet.innerHTML = `<div class="dialog-head row spread"><h2>${escaped(title)}</h2>${iconButton("close-sheet", "Fechar", "close")}</div>${content}`;
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}

function showPicker() {
  picker = true;
  openSheet("Adicionar exercício", `<div class="stack"><label class="field">Buscar no catálogo
    <input id="picker-search" type="search" placeholder="Ex.: supino, peito, halteres" autocomplete="off"></label>
    ${button("create-custom", "Criar exercício próprio", "plus")}
    <div id="picker-results" class="catalog"></div></div>`);
  showResults(document.querySelector("#picker-results"), "", true);
}

function showDetails(item) {
  openSheet(titleFor(item), `<div class="stack">
    ${titleFor(item) !== item.name ? `<p class="muted">${escaped(item.name)}</p>` : ""}
    ${item.images?.length ? `<div class="media">${item.images.map((path, index) =>
      `<button type="button" class="photo-trigger" data-action="zoom-photo" data-value="${escaped(item.id)}"
        data-photo="${index}" aria-label="Ampliar foto ${index + 1} de ${escaped(titleFor(item))}">
        ${photo(path)}<span>${glyph("search")}</span></button>`).join("")}</div>` : ""}
    <p class="muted">${escaped([muscleFor(item), equipment[item.equipment] || item.equipment].filter(Boolean).join(" · "))}</p>
    ${exerciseVideo(item)}
    ${item.instructions?.length ? `<h3>${item.custom || item.portuguese ? "Instruções" : "Instruções da base (em inglês)"}</h3><ol>${item.instructions.map(step => `<li>${escaped(step)}</li>`).join("")}</ol>` : ""}
    ${item.machineTranslated ? "<small>Instruções traduzidas automaticamente para português.</small>" : ""}
    ${item.credit ? `<small>Texto: ${escaped(item.credit.author)} / wger · ${escaped(item.credit.license)}</small>` : ""}
    ${musclePanel([{ id: item.id, sets: 1 }], false)}
  </div>`);
}

function zoomPhoto(item, index) {
  const path = item?.images?.[index];
  if (!path) return;
  photoViewer.innerHTML = `<div class="dialog-head row spread"><h2 id="photo-title">${escaped(titleFor(item))}</h2>
    ${iconButton("close-photo", "Fechar foto", "close")}</div>
    <div class="photo-stage" data-zoom="1" tabindex="0" aria-label="Foto do exercício">
      ${photo(path, "", titleFor(item))}</div>
    <div class="row spread photo-actions">${button("photo-scale", "− Diminuir", "", "", -1)}
    <output id="photo-zoom">1×</output>${button("photo-scale", "+ Ampliar", "", "", 1)}</div>`;
  photoViewer.querySelector('[data-value="-1"]').disabled = true;
  photoViewer.showModal();
}

function scalePhoto(step) {
  const stage = photoViewer.querySelector(".photo-stage");
  const current = Number(stage.dataset.zoom);
  const zoom = Math.min(3, Math.max(1, current + step));
  const relativeX = (stage.scrollLeft + stage.clientWidth / 2) / stage.scrollWidth;
  const relativeY = (stage.scrollTop + stage.clientHeight / 2) / stage.scrollHeight;
  stage.dataset.zoom = zoom;
  stage.scrollTo(stage.scrollWidth * relativeX - stage.clientWidth / 2, stage.scrollHeight * relativeY - stage.clientHeight / 2);
  photoViewer.querySelector("#photo-zoom").textContent = `${zoom}×`;
  photoViewer.querySelector('[data-value="-1"]').disabled = zoom === 1;
  photoViewer.querySelector('[data-value="1"]').disabled = zoom === 3;
}

function showSetup() {
  openSheet(setup.plan.name, `<div class="stack">
    ${[["guided", "Treino guiado", "Marque as séries e use o descanso automático.", "timer"],
        ["sheet", "Modo planilha", "Marque séries ou exercícios inteiros na ficha.", "list"]].map(([mode, title, desc, icon]) =>
       `<button type="button" class="mode ${setup.mode === mode ? "selected" : ""}" data-action="mode" data-value="${mode}" aria-pressed="${setup.mode === mode}">
       <span class="tile-icon">${glyph(icon)}</span><span class="mode-copy"><strong>${title}</strong><small>${desc}</small></span></button>`).join("")}
    <form id="start" class="stack"><fieldset id="setup-rest" class="stack">
      <label class="field">Descanso entre séries (segundos)
      <input type="number" name="rest" value="${escaped(setup.rest)}" required min="0" max="900"></label><small>Use 0 para treinar sem contador.</small></fieldset>
      <button type="submit" class="primary with-icon">${glyph("play")} Começar agora</button></form></div>`);
}

function selectWorkoutMode(mode) {
  setup.mode = mode;
  sheet.querySelectorAll(".mode").forEach(button => {
    const selected = button.dataset.value === mode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const rest = sheet.querySelector("#setup-rest");
  rest.hidden = rest.disabled = mode !== "guided";
}

function startSetup(plan, program = null) {
  if (state.active) { go("session"); toast("Você já tem um treino em andamento."); }
  else { setup = { plan, program, mode: "guided", rest: state.rest }; showSetup(); }
}

function sessionStats(active) {
  return {
    sets: active.checked.reduce((total, rows) => total + rows.filter(Boolean).length, 0),
    exercises: active.checked.filter(rows => rows.every(Boolean)).length
  };
}

function session() {
  const active = state.active;
  const stats = sessionStats(active);
  const total = totalSets(active.plan);
  const remaining = Math.max(0, Math.ceil((active.restUntil - Date.now()) / 1000));
  return heading(active.plan.name, true) + `<div class="stack">
    <div class="glass stack">
      <div class="clock-center"><h2>${active.mode === "guided" ? "Treino guiado" : "Modo planilha"}</h2>
      <div class="counter accent" id="elapsed">${clock(Math.max(0, Math.floor((Date.now() - active.started) / 1000)))}</div></div>
      <progress class="progress-track" max="${total}" value="${stats.sets}" aria-label="Progresso das séries"></progress>
      <small>${stats.sets}/${total} séries · ${stats.exercises}/${active.plan.exercises.length} exercícios</small>
    </div>
    ${remaining ? `<section id="timer-panel" class="glass timer clock-center"><div><small>Descanso</small>
      <div id="remaining" class="counter">${clock(remaining)}</div></div>${button("skip-rest", "Pular", "next")}</section>` : ""}
    ${active.plan.note ? `<p class="glass note">${escaped(active.plan.note)}</p>` : ""}
    ${active.plan.exercises.map((item, index) => {
      const exercise = exerciseFor(item);
      const sets = active.checked[index];
      const record = active.log?.[index];
      return `<article class="glass stack">
        ${exerciseDetailsButton(exercise, `${sets.filter(Boolean).length}/${item.sets} séries · ${item.reps} reps · ${kg(item.weight)}`)}
        ${item.note ? `<p class="note">${escaped(item.note)}</p>` : ""}
        <div class="row wrap">${button("edit-exercise-log", record ? "Editar registro" : "Registrar carga e notas", "edit", "", index)}
          ${record ? `<small class="accent">${methods[record.method]}</small>` : ""}</div>
        ${record?.note ? `<p class="note">${escaped(record.note)}</p>` : ""}
        ${active.mode === "sheet" ? `<label class="check-row"><strong>Exercício completo</strong>
          <input type="checkbox" data-complete="${index}" ${sets.every(Boolean) ? "checked" : ""}></label>` : ""}
        <div>${sets.map((done, set) => {
          const actual = actualSet(active, index, set);
          return `<label class="check-row"><strong class="${done ? "green" : ""}">Série ${set + 1}</strong>
          <span class="muted grow">${actual.reps} reps · ${kg(actual.weight)}${actual.drops?.length ? " → " + actual.drops.map(kg).join(" → ") : ""}</span>
          <input type="checkbox" aria-label="Série ${set + 1} de ${escaped(titleFor(exercise))}" data-set="${index},${set}" ${done ? "checked" : ""}></label>`;
        }).join("")}</div>
        </article>`;
    }).join("")}
    ${button("finish", "Finalizar treino", "check", "primary")}
    ${button("discard", "Descartar sessão", "trash", "danger")}</div>`;
}

function exerciseDetailsButton(exercise, description) {
  return `<button type="button" class="catalog-result" data-action="details" data-value="${escaped(exercise.id)}">
    ${thumbnail(exercise)}<span class="grow"><strong>${escaped(titleFor(exercise))}</strong><br><small>${escaped(description)}</small></span>
    ${glyph(exercise.images?.length ? "search" : "info")}</button>`;
}

function render(keepScroll = false) {
  const y = window.scrollY;
  screen.innerHTML = ({ home, editor, library, programs, record, session, history, profile, themes,
    changelog, water, nutrition, activities, achievements, trainingHabits, missions })[page]();
  const tabs = [
    ["home", "Treinos", "fitness", ["editor", "library"]],
    ["history", "Calendário", "history", ["activities"]],
    ["record", "Iniciar", "play", ["session"]],
    ["nutrition", "Nutrição", "nutrition", ["water"]],
    ["profile", "Perfil", "profile", ["themes", "changelog", "achievements", "trainingHabits", "missions"]]
  ];
  const current = page === "programs" ? (programFromRecord ? "record" : "home") : page;
  navigation.innerHTML = `<div class="nav-inner">${tabs.map(([key, name, icon, children]) =>
    `<button type="button" data-action="${key}" ${key === "record" ? 'class="record-tab"' : ""}
      ${current === key || children.includes(current) ? 'aria-current="page"' : ""}>
      <span class="nav-symbol">${glyph(icon)}</span><span>${name}</span></button>`).join("")}</div>`;
  if (page === "library") showResults(document.querySelector("#catalog-results"), "", false);
  if (page === "nutrition" && foodQuery) searchTaco(foodQuery);
  document.querySelectorAll("[data-complete]").forEach(input => {
    const sets = state.active.checked[Number(input.dataset.complete)];
    input.indeterminate = sets.some(Boolean) && !sets.every(Boolean);
  });
  window.scrollTo(0, keepScroll ? y : 0);
}

function go(next) {
  page = next;
  render();
}
function closeSheet() {
  sheet.close();
  picker = false;
  setup = null;
  programDraft = null;
}
function confirmSheet(title, description, action, label, value = "") {
  openSheet(title, `<div class="stack"><p class="muted">${escaped(description)}</p>${button(action, label, "check", "primary", value)}</div>`);
}
function back() {
  if (photoViewer.open) { photoViewer.close(); return true; }
  if (closeScaleSheet()) return true;
  if (sheet.open) { closeSheet(); return true; }
  if (page === "editor") {
    confirmSheet("Sair da edição?", "As alterações desta ficha serão descartadas.", "leave-editor", "Sair da edição");
    return true;
  }
  if (page === "programs" && selectedProgram) {
    selectedProgram = null;
    go(programFromRecord ? "record" : "programs");
    return true;
  }
  if (page === "water") { go("nutrition"); return true; }
  if (["changelog", "themes", "achievements", "missions"].includes(page)) { go("profile"); return true; }
  if (page === "trainingHabits") { go("achievements"); return true; }
  if (page === "activities") { go("history"); return true; }
  if (page === "session") { go("record"); return true; }
  if (page !== "home") { go("home"); return true; }
  return false;
}
window.gymBack = back;
sheet.addEventListener("cancel", event => { event.preventDefault(); closeSheet(); });

document.addEventListener("click", event => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const { action, value } = control.dataset;
  const plan = state.plans.find(entry => entry.id === value);
  switch (action) {
    case "home":
    case "record":
    case "missions":
    case "library":
    case "water":
    case "trainingHabits":
    case "achievements":
    case "activities":
    case "nutrition":
    case "changelog":
    case "themes":
    case "profile":
    case "history":
    case "programs":
      if (page === "editor") { back(); break; }
      if (action === "programs") { selectedProgram = null; programFromRecord = false; }
      go(action); break;
    case "new-scale-profile":
      openSheet("Novo perfil", `<form id="new-scale-profile" class="stack">
        <label class="field">Nome<input name="person" required maxlength="40"></label>
        <button class="primary">Criar perfil</button>
      </form>`);
      break;
    case "body-card": showBodyCard(value); break;
    case "close-scale": closeScaleSheet(); break;
    case "accept-scale-reading": acceptScaleReading(); break;
    case "select-theme": selectTheme(value, control); break;
    case "view-workout": if (plan) viewWorkout(plan); break;
    case "view-program":
      programFromRecord = page === "record";
      selectedProgram = value;
      go("programs"); break;
    case "start-program":
      if (!state.active) {
        const program = state.programs.find(item => item.id === value);
        if (program) startProgramSlot(program, nextSlot(program));
      }
      break;
    case "new-program": editProgram(); break;
    case "edit-program": editProgram(state.programs.find(item => item.id === value)); break;
    case "export-plan": exportPlanPdf(value, control); break;
    case "add-slot": programDraft.sequence.push(""); showProgramEditor(); break;
    case "remove-slot": programDraft.sequence.splice(Number(value), 1); showProgramEditor(); break;
    case "delete-program":
      openSheet("Excluir plano?", `<p class="section-head muted">As fichas continuam disponíveis em Treinos.</p>${button("confirm-delete-program", "Excluir plano", "trash", "danger", value)}`); break;
    case "confirm-delete-program": {
      const previous = state.programs;
      state.programs = previous.filter(item => item.id !== value);
      if (!save()) { state.programs = previous; break; }
      selectedProgram = null; closeSheet(); go("programs"); break;
    }
    case "start-slot": startSlot(Number(value)); break;
    case "create-custom": showCustomExercise(); break;
    case "session": if (state.active) go("session"); break;
    case "back": back(); break;
    case "close-sheet": closeSheet(); break;
    case "new": draft = { name: "", exercises: [] }; go("editor"); break;
    case "edit": if (plan) { draft = copy(plan); go("editor"); } break;
    case "leave-editor": closeSheet(); draft = null; go("home"); break;
    case "pick": showPicker(); break;
    case "add-exercise":
      if (picker && catalog.has(value) && !draft.exercises.some(item => item.id === value)) {
        draft.exercises.push({ id: value, sets: 3, reps: 10, weight: 0 });
        const input = document.querySelector("#picker-search");
        showResults(document.querySelector("#picker-results"), input.value, true);
        render(true);
      }
      break;
    case "remove-exercise": draft.exercises.splice(Number(value), 1); render(true); break;
    case "move-exercise": {
      const [index, direction] = value.split(",").map(Number);
      const target = index + direction;
      [draft.exercises[index], draft.exercises[target]] = [draft.exercises[target], draft.exercises[index]];
      render(true);
      document.querySelectorAll("#editor article")[target]?.scrollIntoView({ block: "nearest" });
      break;
    }
    case "new-activity": activityEditor(); break;
    case "view-activity": viewActivity(value); break;
    case "edit-activity": activityEditor(activityById(value)); break;
    case "ask-remove-activity":
      openSheet("Excluir atividade?", `<div class="stack"><p>O registro será removido deste aparelho.</p>
        ${button("remove-activity", "Excluir registro", "trash", "danger", value)}</div>`);
      break;
    case "remove-activity": removeActivity(value); break;
    case "wellness": wellnessAction(action, value, control); break;
    case "saved-exercise-videos": {
      const seen = new Set();
      const saved = [...catalog.values()].filter(item => {
        const url = item.video?.url;
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return window.GymWellness?.videoSaved(url);
      });
      openSheet("Vídeos salvos", `<div class="stack">${saved.length ? saved.map(item =>
        button("details", titleFor(item), "play", "", item.id)).join("") : "<p class='muted'>Nenhum vídeo salvo neste aparelho.</p>"}</div>`);
      break;
    }
    case "video-action": videoAction(control, value); break;
    case "details": if (catalog.has(value)) showDetails(catalog.get(value)); break;
    case "zoom-photo": zoomPhoto(catalog.get(value), Number(control.dataset.photo)); break;
    case "close-photo": photoViewer.close(); break;
    case "photo-scale": scalePhoto(Number(value)); break;
    case "edit-exercise-log": editExerciseLog(Number(value)); break;
    case "calendar-month": calendarMonth(Number(value)); break;
    case "calendar-day": selectedDay = value; render(true); break;
    case "history-entry": openHistoryEntry(Number(value)); break;
    case "habit-action": handleHabit(action, control); break;
    case "edit-history-loads": editHistoryLoads(Number(value)); break;
    case "ask-remove-history":
      confirmSheet("Excluir sessão?", "Este treino e suas séries serão removidos do histórico. As medalhas serão recalculadas.", "remove-history", "Excluir sessão", value);
      break;
    case "remove-history": removeHistoryEntry(Number(value)); break;
    case "delete-plan":
      confirmSheet("Excluir ficha?", "Esta ficha será removida dos seus treinos e dos planos que a utilizam.", "confirm-delete", "Excluir ficha"); break;
    case "confirm-delete": {
      const previous = copy(state);
      state.plans = state.plans.filter(entry => entry.id !== draft.id);
      state.programs = state.programs.map(program => {
        if (!program.slots.includes(draft.id)) return program;
        const slots = program.mode === "weekly" ? program.slots.map(id => id === draft.id ? "" : id)
          : program.slots.filter(id => id !== draft.id);
        return { ...program, slots: slots.length ? slots : [""], next: 0 };
      });
      if (!save()) { state = previous; break; }
      draft = null; closeSheet(); go("home"); toast("Ficha excluída"); break;
    }
    case "setup":
      if (plan) startSetup(plan);
      break;
    case "mode": selectWorkoutMode(value); break;
    case "skip-rest": state.active.restUntil = 0; save(); render(true); break;
    case "finish": {
      const stats = sessionStats(state.active);
      const total = totalSets(state.active.plan);
      confirmSheet("Finalizar treino?", `${stats.sets} de ${total} séries concluídas. A sessão será salva no histórico.`, "confirm-finish", "Salvar sessão");
      break;
    }
    case "discard": confirmSheet("Descartar sessão?", "O progresso deste treino será perdido.", "confirm-discard", "Descartar sessão"); break;
    case "confirm-finish":
    case "confirm-discard": {
      const previous = copy(state);
      const active = state.active;
      const owner = active.profileId || "personal";
      const before = action === "confirm-finish" ? achievementKeys(owner) : null;
      if (action === "confirm-finish") {
        const ended = Date.now();
        state.history.unshift({ name: active.plan.name, profileId: owner, started: active.started,
          program: active.program, ended, seconds: Math.max(0, Math.floor((ended - active.started) / 1000)),
          ...sessionStats(active), total: totalSets(active.plan), exerciseTotal: active.plan.exercises.length,
          records: snapshotWorkout(active) });
        selectedDay = localDate(ended);
        advanceProgram(active);
      }
      state.active = null;
      if (!save()) { state = previous; break; }
      closeSheet();
      if (action === "confirm-finish" && state.programs.some(program => program.id === active.program?.id)) {
        selectedProgram = active.program.id;
        go("programs");
      } else go(action === "confirm-finish" ? "history" : "home");
      if (before) announceAchievements(before, owner);
      break;
    }
  }
});

document.addEventListener("input", event => {
  const input = event.target;
  if (input.form?.id === "exercise-log" && input.tagName === "INPUT") input.setCustomValidity("");
  if (input.id === "taco-search") searchTaco(input.value);
  if (input.id === "catalog-search") showResults(document.querySelector("#catalog-results"), input.value, false);
  if (input.id === "picker-search") showResults(document.querySelector("#picker-results"), input.value, true);
  if (input.form?.id === "editor") {
    input.setCustomValidity("");
    if (input.name === "name") draft.name = input.value;
    else if (input.dataset.index !== undefined) draft.exercises[Number(input.dataset.index)][input.name] = input.value;
    else if (input.name === "note") draft.note = input.value;
  }
  if (input.form?.id === "program-editor" && input.name === "name") programDraft.name = input.value;
  if (input.form?.id === "start" && input.name === "rest") setup.rest = input.value;
});

document.addEventListener("change", event => {
  if (event.target.id === "achievement-category") {
    achievementCategory = event.target.value;
    render(true);
    document.querySelector("#achievement-category")?.focus({preventScroll:true});
    return;
  }
  if (changeWellnessDate(event.target)) return;
  if (event.target.id === "scale-profile-picker") {
    switchScaleProfile(event.target.value);
    return;
  }
  const input = event.target;
  if (input.id === "progress-exercise") {
    progressExercise = input.value; render(true);
    document.querySelector("#progress-exercise")?.focus({ preventScroll: true }); return;
  }
  if (input.form?.id === "exercise-log" && input.name === "method") {
    input.form.querySelectorAll(".drop-field").forEach(field => {
      field.hidden = input.value !== "drop";
      field.querySelector("input").setCustomValidity("");
    });
    return;
  }
  if (input.form?.id === "program-editor") {
    if (input.name === "mode") { programDraft.mode = input.value; showProgramEditor(); }
    if (input.name === "slot") programDraft[programDraft.mode][Number(input.dataset.slot)] = input.value;
    return;
  }
  const active = state.active;
  if (!active || input.type !== "checkbox") return;
  if (input.dataset.set !== undefined) {
    const [exercise, set] = input.dataset.set.split(",").map(Number);
    active.checked[exercise][set] = input.checked;
    if (active.mode === "guided") {
      active.restUntil = input.checked && sessionStats(active).sets < totalSets(active.plan) && active.rest > 0
        ? Date.now() + active.rest * 1000 : 0;
    }
  } else if (input.dataset.complete !== undefined) {
    active.checked[Number(input.dataset.complete)].fill(input.checked);
  } else return;
  saveSessionProgress();
  const marker = input.dataset.set !== undefined ? "data-set" : "data-complete";
  const value = input.getAttribute(marker);
  render(true);
  screen.querySelector(`[${marker}="${value}"]`)?.focus({ preventScroll: true });
});

document.addEventListener("submit", event => {
  event.preventDefault();
  const form = event.target;
  if (saveTrainingHabit(form)) return;
  if (form.id === "history-loads") { saveHistoryLoads(form); return; }
  if (form.id === "activity-editor") { saveActivity(form); return; }
  if (saveWellness(form)) return;
  if (form.id === "new-scale-profile") { createScaleProfile(form); return; }
  if (form.id === "profile-height" || form.id === "body-weight") { saveMeasurement(form); return; }
  if (form.id === "exercise-log") { saveExerciseLog(form); return; }
  if (form.id === "program-editor") { saveProgram(); return; }
  if (form.id === "custom-exercise") { saveCustomExercise(form); return; }
  if (form.id === "editor") {
    const name = draft.name.trim();
    if (!name) { form.elements.name.setCustomValidity("Informe o nome do treino."); form.reportValidity(); return; }
    if (!draft.exercises.length) { toast("Adicione pelo menos um exercício."); return; }
    const rows = copy(draft.exercises);
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const weight = String(row.weight).trim().replace(",", ".");
      if (!/^\d+(?:\.\d{1,2})?$/.test(weight) || Number(weight) > 9999) {
        const field = form.querySelector(`[name="weight"][data-index="${index}"]`);
        field.setCustomValidity("Informe um peso de 0 a 9999 kg, com até duas casas decimais.");
        field.reportValidity();
        return;
      }
      row.weight = Number(weight);
      row.sets = Number(row.sets);
      row.reps = Number(row.reps);
    }
    const previous = state.plans;
    const id = draft.id || newId("ficha");
    const plan = { id, name, note: draft.note?.trim() || "", exercises: rows };
    state.plans = draft.id ? previous.map(item => item.id === id ? plan : item) : [...previous, plan];
    if (!save()) { state.plans = previous; return; }
    draft = null; go("home"); toast("Ficha salva");
  }
  if (form.id === "start" && setup && !state.active) {
    const previousRest = state.rest;
    const rest = setup.mode === "guided" ? Number(setup.rest) : 0;
    if (setup.mode === "guided") state.rest = rest;
    state.active = { plan: copy(setup.plan), profileId: state.scaleProfileId, program: setup.program, mode: setup.mode, rest, started: Date.now(), restUntil: 0,
      checked: setup.plan.exercises.map(item => Array(item.sets).fill(false)) };
    if (!save()) { state.active = null; state.rest = previousRest; return; }
    closeSheet(); go("session");
  }
});

function updateSessionClocks() {
  if (document.hidden || page !== "session" || !state.active) return;
  const active = state.active;
  const elapsed = document.querySelector("#elapsed");
  const elapsedText = clock(Math.max(0, Math.floor((Date.now() - active.started) / 1000)));
  if (elapsed && elapsed.textContent !== elapsedText) elapsed.textContent = elapsedText;
  const timer = document.querySelector("#remaining");
  if (!timer) return;
  const remaining = Math.max(0, Math.ceil((active.restUntil - Date.now()) / 1000));
  if (remaining) {
    const remainingText = clock(remaining);
    if (timer.textContent !== remainingText) timer.textContent = remainingText;
  }
  else {
    document.querySelector("#timer-panel").remove();
    toast("Descanso concluído");
  }
}
setInterval(updateSessionClocks, 250);
document.addEventListener("visibilitychange", updateSessionClocks);

if (state.plans.length || state.active || state.history.length) {
  loadCatalog().catch(error => toast(error.message)).finally(() => render());
} else {
  render();
  if (window.GymWellness?.hasSavedVideos?.()) loadCatalog().catch(error => console.warn(error));
}
