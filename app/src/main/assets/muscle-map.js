"use strict";

const muscleSections = {
  Superiores: ["neck", "traps", "shoulders", "chest", "biceps", "triceps", "forearms", "lats", "middle back"],
  Core: ["abdominals", "obliques", "lower back"],
  Inferiores: ["glutes", "quadriceps", "hamstrings", "calves", "abductors", "adductors", "hip flexors", "shins"]
};
const regionGroups = {
  neck: /^(neck-|nape$)/, traps: /^traps-/, shoulders: /^(shoulder-|deltoid-rear-)/,
  chest: /^chest-/, biceps: /^biceps-/, triceps: /^triceps-/, forearms: /^forearm-/,
  lats: /^lats-/, "middle back": /^traps-(mid|lower)-/, "lower back": /^lower-back-/,
  abdominals: /^abs-/, obliques: /^obliques-/, glutes: /^gluteus-/, quadriceps: /^quads-/,
  hamstrings: /^hamstrings-/, calves: /^calves-/, abductors: /^gluteus-medius-/,
  adductors: /^adductors-/, "hip flexors": /^hip-flexor-/, shins: /^tibialis-anterior-/
};

function muscleSummary(rows) {
  const tally = new Map();
  for (const row of rows) {
    const exercise = exerciseFor(row);
    const primary = new Set(exercise.primaryMuscles || []);
    const secondary = new Set(exercise.secondaryMuscles || []);
    for (const muscle of new Set([...primary, ...secondary])) {
      if (!tally.has(muscle)) tally.set(muscle, { primary: 0, secondary: 0 });
      tally.get(muscle)[primary.has(muscle) ? "primary" : "secondary"] += Number(row.sets) || 0;
    }
  }
  return tally;
}

function anatomyFigure(view, tally, label) {
  const active = [...tally].map(([key, count]) => [regionGroups[key], count]);
  const regions = window.BODY_MAP_VIEWS[view].map(([id, path]) => {
    const roles = active.filter(([pattern]) => pattern?.test(id)).map(([, count]) => count);
    const role = roles.some(count => count.primary) ? "main-muscle"
      : roles.some(count => count.secondary) ? "assist-muscle" : "neutral-muscle";
    return `<path class="${role}" d="${path}"/>`;
  }).join("");
  const viewBox = view === 0 ? "0 0 35 93" : "37 0 35 93";
  return `<figure><svg viewBox="${viewBox}" aria-hidden="true">${regions}</svg><figcaption>${label}</figcaption></figure>`;
}

function musclePanel(rows, showSeries = true) {
  const tally = muscleSummary(rows);
  if (!tally.size) return '<p class="muted">Nenhum grupo muscular informado.</p>';
  const ranking = [...tally].sort(([, a], [, b]) => b.primary - a.primary || b.secondary - a.secondary);
  const top = ranking.filter(([, count]) => count.primary).slice(0, 3);
  return `<section class="glass stack">
    <h3>Músculos trabalhados</h3>
    ${showSeries && top.length ? `<p>Maior foco: <strong class="accent">${top.map(([key]) => escaped(muscles[key] || key)).join(", ")}</strong></p>` : ""}
    <div class="anatomy">${anatomyFigure(0, tally, "Frente")}${anatomyFigure(1, tally, "Costas")}</div>
    <div class="row wrap"><small class="accent">● Principais</small><small class="assist-label">● Secundários</small></div>
    ${showSeries ? "<small>Séries planejadas por músculo. Uma série pode contar para vários grupos.</small>" : ""}
    ${Object.entries(muscleSections).map(([label, keys]) => {
      const entries = ranking.filter(([key]) => keys.includes(key));
      if (!entries.length) return "";
      return `<div><h3>${label}</h3>${entries.map(([key, count]) =>
        `<div class="row spread muscle-entry"><span>${escaped(muscles[key] || key)}</span>
        <small>${showSeries ? [count.primary && `${count.primary} principais`, count.secondary && `${count.secondary} secundárias`].filter(Boolean).join(" · ")
          : count.primary ? "Principal" : "Secundário"}</small></div>`).join("")}</div>`;
    }).join("")}
  </section>`;
}
