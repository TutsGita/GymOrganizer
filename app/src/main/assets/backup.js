"use strict";

const backupFormat = 1;
const backupMarker = "gym-organizer-backup";
let pendingBackup = null;

const isPlainObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

function backupData() {
  return {
    type: backupMarker,
    format: backupFormat,
    exportedAt: new Date().toISOString(),
    data: state
  };
}

function backupFilename() {
  const now = new Date();
  const two = value => String(value).padStart(2, "0");
  return `gym-organizer-backup-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}.json`;
}

// Returns { data } with the validated state, or { error } in Portuguese.
function validateBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch (error) { return { error: "O arquivo não é um JSON válido." }; }
  if (!isPlainObject(parsed) || parsed.type !== backupMarker) {
    return { error: "O arquivo não é um backup do Gym Organizer." };
  }
  if (!Number.isInteger(parsed.format) || parsed.format < 1) return { error: "Formato de backup desconhecido." };
  if (parsed.format > backupFormat) return { error: "O backup foi criado por uma versão mais nova do app. Atualize o Gym Organizer." };
  const data = parsed.data;
  if (!isPlainObject(data)) return { error: "O backup não contém dados." };
  if (!Array.isArray(data.plans) || !Array.isArray(data.history)) return { error: "O backup está incompleto: faltam planos ou histórico." };
  for (const key of ["programs", "custom"]) {
    if (data[key] !== undefined && !Array.isArray(data[key])) return { error: `O backup está corrompido: "${key}" inválido.` };
  }
  if (data.rest !== undefined && !(Number.isFinite(data.rest) && data.rest >= 0)) return { error: "O backup está corrompido: descanso inválido." };
  if (data.active !== undefined && data.active !== null && !isPlainObject(data.active)) return { error: "O backup está corrompido: treino em andamento inválido." };
  const profiles = data.scaleProfiles;
  if (!isPlainObject(profiles) || !Object.keys(profiles).length) return { error: "O backup não tem nenhum perfil." };
  for (const [id, person] of Object.entries(profiles)) {
    if (!isPlainObject(person) || typeof person.name !== "string" || !isPlainObject(person.weights)) {
      return { error: `O backup está corrompido: perfil "${id}" inválido.` };
    }
  }
  if (!Object.hasOwn(profiles, data.scaleProfileId)) data.scaleProfileId = Object.keys(profiles)[0];
  return { data };
}

function backupSummary(data) {
  const profiles = Object.values(data.scaleProfiles);
  return [
    plural(data.plans.length, "ficha", "fichas"),
    plural((data.programs || []).length, "plano", "planos"),
    plural(data.history.length, "treino no histórico", "treinos no histórico"),
    plural(profiles.length, "perfil", "perfis"),
    plural(profiles.reduce((sum, person) => sum + Object.keys(person.weights).length, 0), "pesagem", "pesagens")
  ];
}

function exportBackup() {
  if (!window.GymBackup) { toast("O backup está disponível no Android."); return; }
  try {
    window.GymBackup.exportJson(JSON.stringify(backupData()), backupFilename());
  } catch (error) {
    console.error(error);
    toast("Não foi possível preparar o backup.");
  }
}

function importBackup() {
  if (!window.GymBackup) { toast("O backup está disponível no Android."); return; }
  window.GymBackup.pickJson();
}

window.gymBackupLoaded = (text, failure) => {
  if (failure || typeof text !== "string") { toast(failure || "Não foi possível ler o arquivo."); return; }
  const result = validateBackup(text);
  if (result.error) { toast(result.error); return; }
  pendingBackup = result.data;
  const current = backupSummary(state);
  const incoming = backupSummary(result.data);
  openSheet("Substituir dados?", `<div class="stack">
    <p><strong>Backup selecionado:</strong> ${escaped(incoming.join(", "))}.</p>
    <p><strong>Neste aparelho agora:</strong> ${escaped(current.join(", "))}.</p>
    <p class="muted">Todos os dados atuais serão substituídos. Isso não pode ser desfeito. Exporte um backup antes, se quiser manter uma cópia.</p>
    ${button("confirm-import-backup", "Substituir dados", "history", "danger")}
  </div>`);
};

function confirmImportBackup() {
  const incoming = pendingBackup;
  pendingBackup = null;
  if (!incoming) return;
  const previousState = localStorage.getItem(storageKey);
  const previousActive = localStorage.getItem(sessionStorageKey);
  try {
    localStorage.setItem(storageKey, JSON.stringify(incoming));
    if (incoming.active) localStorage.setItem(sessionStorageKey, JSON.stringify(incoming.active));
    else localStorage.removeItem(sessionStorageKey);
  } catch (error) {
    console.error(error);
    try {
      if (previousState === null) localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, previousState);
      if (previousActive === null) localStorage.removeItem(sessionStorageKey); else localStorage.setItem(sessionStorageKey, previousActive);
    } catch (restoreError) { console.error(restoreError); }
    toast("Não foi possível restaurar. Seus dados atuais foram mantidos.");
    return;
  }
  location.reload();
}
