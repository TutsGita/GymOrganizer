// Testa a validação do backup sem Android: node tests/backup-test.cjs
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/backup.js"), "utf8");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const { validateBackup, backupSummary } = new Function("plural", "window", `${source}; return { validateBackup, backupSummary };`)(plural, {});

const state = {
  plans: [{ id: "a", name: "A", exercises: [] }], history: [{ id: "h" }], active: null, rest: 90,
  programs: [], custom: [],
  scaleProfiles: { personal: { name: "Eu", weights: { "2026-01-01": 80 } } }, scaleProfileId: "personal"
};
const wrap = (data, extra = {}) => JSON.stringify({ type: "gym-organizer-backup", format: 1, exportedAt: "x", data, ...extra });
const bad = (text, pattern) => { const r = validateBackup(text); assert.match(r.error || "", pattern); };

const ok = validateBackup(wrap(state));
assert.ok(ok.data && !ok.error);
assert.deepStrictEqual(backupSummary(ok.data), ["1 ficha", "0 planos", "1 treino no histórico", "1 perfil", "1 pesagem"]);
assert.strictEqual(validateBackup(wrap({ ...state, scaleProfileId: "inexistente" })).data.scaleProfileId, "personal");
bad("não é json", /JSON válido/);
bad("[]", /não é um backup/);
bad(JSON.stringify({ plans: [], history: [] }), /não é um backup/);
bad(wrap(state, { format: 2 }), /versão mais nova/);
bad(wrap(state, { format: "1" }), /desconhecido/);
bad(wrap({ ...state, plans: {} }), /incompleto/);
bad(wrap({ ...state, programs: "x" }), /programs/);
bad(wrap({ ...state, rest: -3 }), /descanso/);
bad(wrap({ ...state, active: [] }), /em andamento/);
bad(wrap({ ...state, scaleProfiles: {} }), /nenhum perfil/);
bad(wrap({ ...state, scaleProfiles: { p: { name: "x", weights: [] } } }), /perfil "p"/);
console.log("backup-test: ok");
