"use strict";

const ranks = ["Ferro", "Bronze", "Prata", "Ouro", "Platina", "Diamante"];
const dailyMissions = [
  {key: "water", label: "Bater a meta de água", target: 1, xp: 25, action: "water"},
  {key: "food", label: "Atingir a faixa da meta calórica", target: 1, xp: 30, action: "nutrition"},
  {key: "training", label: "Concluir um treino ou registrar uma atividade", target: 1, xp: 35, action: "record"}
];
const weeklyMissions = [
  {key: "water", label: "Bater a meta de água em 5 dias", target: 5, xp: 100, action: "water"},
  {key: "food", label: "Atingir a faixa calórica em 4 dias", target: 4, xp: 120, action: "nutrition"},
  {key: "training", label: "Registrar atividade em 3 dias", target: 3, xp: 150, action: "record"}
];

const waterTotal = (drinks = []) => drinks.reduce((sum, drink) => sum + drink.ml, 0);

function hitNutrition(meals, target) {
  if (!target || !meals?.length || meals.some(food => !Number.isFinite(food.energy))) return false;
  const total = meals.reduce((sum, food) => sum + food.energy * food.portion / 100, 0);
  return total >= target * .9 && total <= target * 1.1;
}

function profileProgress(now = Date.now(), profileId = state.scaleProfileId) {
  const person = state.scaleProfiles[profileId];
  const wellness = person.wellness || {};
  const date = localDate(now);
  const today = daySerial(date);
  const week = weekSerial(today);
  const days = new Map();
  const mark = (day, key) => {
    const serial = daySerial(day);
    if (!Number.isFinite(serial) || serial > today) return;
    if (!days.has(serial)) days.set(serial, new Set());
    days.get(serial).add(key);
  };

  let xp = 0;
  for (const workout of state.history) {
    if ((workout.profileId || "personal") !== profileId || !workout.sets || workout.ended > now) continue;
    const completed = workout.records
      ? workout.records.filter(record => record.sets?.length).length
      : Math.max(0, Number(workout.exercises) || 0);
    xp += completed * 15;
    mark(localDate(workout.ended), "training");
  }
  for (const activity of person.outdoorActivities || []) mark(activity.start.slice(0, 10), "training");
  for (const [day, entries] of Object.entries(wellness.water || {})) {
    const target = wellness.waterTargets?.[day] ?? (day === date ? wellness.waterGoal || 2000 : 0);
    if (target > 0 && waterTotal(entries) >= target) mark(day, "water");
  }
  const currentKcal = caloricEstimate(person, wellness.nutritionGoal)?.kcal;
  for (const [day, meals] of Object.entries(wellness.meals || {})) {
    const target = wellness.nutritionTargets?.[day] ?? (day === date ? currentKcal : null);
    if (hitNutrition(meals, target)) mark(day, "food");
  }

  const weeks = new Map();
  for (const [serial, done] of days) {
    const start = weekSerial(serial);
    if (!weeks.has(start)) weeks.set(start, {water: 0, food: 0, training: 0});
    const counts = weeks.get(start);
    for (const mission of dailyMissions) {
      if (!done.has(mission.key)) continue;
      xp += mission.xp;
      counts[mission.key]++;
    }
  }
  for (const counts of weeks.values()) {
    for (const mission of weeklyMissions) {
      if (counts[mission.key] >= mission.target) xp += mission.xp;
    }
  }

  let level = 1;
  let remaining = xp;
  let required = 100;
  while (level < 60 && remaining >= required) {
    remaining -= required;
    level++;
    required += 35;
  }
  return {
    xp, level, remaining, required, rank: Math.floor((level - 1) / 10),
    daily: days.get(today) || new Set(), weekly: weeks.get(week) || {},
    hasKcal: Boolean(wellness.nutritionTargets?.[date] || currentKcal)
  };
}

function rankCard(progress = profileProgress()) {
  const name = activeScaleProfile().name;
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase("pt-BR") || "?";
  const {level, xp, rank, remaining, required} = progress;
  return `<section class="glass stack profile-rank rank-${rank}">
    <div class="row"><div class="rank-avatar" aria-hidden="true">${escaped(initial)}</div>
      <div class="grow"><h2>${escaped(name)}</h2><small>Nível ${level} · ${ranks[rank]}</small></div></div>
    ${level === 60 ? "<p>Nível máximo</p>" : `<progress class="progress-track" aria-label="Progresso até o próximo nível"
      max="${required}" value="${remaining}"></progress><small>${formatted(remaining)} / ${formatted(required)} XP para o próximo nível</small>`}
    <small>${formatted(xp)} XP acumulados</small>
  </section>`;
}

function missions() {
  const progress = profileProgress();
  const missionList = (list, countFor) => `<ul class="mission-list">${list.map(mission => {
    const count = Math.min(countFor(mission.key), mission.target);
    return `<li class="row spread"><div class="grow"><h3>${mission.label}</h3>
      <small>${count === mission.target ? "Concluída" : `${count}/${mission.target}`} · ${mission.xp} XP</small></div>
      ${count < mission.target ? iconButton(mission.action, mission.label, "next") : glyph("check")}</li>`;
  }).join("")}</ul>`;
  return heading("Missões", true) + `<div class="stack">${rankCard(progress)}
    <section class="glass stack"><div class="row spread"><h2>Diárias</h2><small>Renovam à meia-noite</small></div>
      ${missionList(dailyMissions, key => Number(progress.daily.has(key)))}</section>
    <section class="glass stack"><div class="row spread"><h2>Semanais</h2><small>Renovam na segunda-feira</small></div>
      ${missionList(weeklyMissions, key => progress.weekly[key] || 0)}</section>
    <small>Cada exercício com pelo menos uma série concluída vale 15 XP. Corrigir ou excluir um registro recalcula a pontuação.</small>
    <small>${progress.hasKcal ? "A missão de alimentação usa uma faixa de 10% em torno da meta estimada." : "Configure sua meta em Nutrição para habilitar as missões de alimentação."}
      A meta é uma estimativa.</small>
  </div>`;
}
