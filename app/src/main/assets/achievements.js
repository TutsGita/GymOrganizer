"use strict";

const roadRun = entry => entry.sport === "Run" || entry.sport === "TrailRun";
const cycling = entry => entry.sport === "Ride" || entry.sport === "MountainBikeRide";
const cardioSport = entry => !["Mobility", "Warmup", "Workout"].includes(entry.sport);
const benchPress = new Set(["Barbell_Bench_Press_-_Medium_Grip", "wger-73"]);
const majorGroups = new Map([
  ["legs", ["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors", "hip flexors", "shins"]],
  ["chest", ["chest"]], ["back", ["lats", "middle back", "lower back", "traps"]],
  ["arms", ["biceps", "triceps", "forearms"]], ["shoulders", ["shoulders"]],
  ["core", ["abdominals", "obliques"]]
]);
const daySerial = day => Math.floor(Date.parse(day + "T00:00:00Z") / 86400000);
const weekSerial = serial => serial - ((serial + 3) % 7 + 7) % 7;

function increment(map, key, count = 1) {
  map.set(key, (map.get(key) || 0) + count);
}

function longestRun(values, step = 1) {
  let previous;
  let count = 0, best = 0;
  for (const value of [...values].sort((a,b) => a-b)) {
    count = value === previous + step ? count + 1 : 1;
    best = Math.max(count, best);
    previous = value;
  }
  return best;
}

function goalCoverage(workoutWeeks, trainingDays, weeklyTarget, today) {
  const weeks = [...workoutWeeks].filter(([,count]) => count >= weeklyTarget).map(([week]) => week).sort((a,b) => a-b);
  let streakStart = -Infinity, previous = -Infinity, best = 0;
  for (const week of weeks) {
    if (week !== previous + 7) {
      streakStart = week;
      while (!trainingDays.has(streakStart)) streakStart++;
    }
    best = Math.max(best, Math.min(today, week + 6) - streakStart + 1);
    previous = week;
  }
  return best;
}

function dailyGoalStreak(trainingDays, workoutWeeks, weeklyTarget) {
  let previous = -Infinity, start = 0;
  for (const day of [...trainingDays].sort((a,b)=>a-b)) {
    if (day !== previous+1) start = day;
    if (day-start >= 29) {
      let compliant = true;
      for (let week=weekSerial(day-29)+7; week+6<=day; week+=7) {
        if ((workoutWeeks.get(week) || 0)<weeklyTarget) { compliant=false; break; }
      }
      if (compliant) return true;
    }
    previous = day;
  }
  return false;
}

function plannedProgress(sessions, activityDays, restDays) {
  const programs = new Map(), weeks = new Map();
  const today = daySerial(localDate(Date.now()));
  for (const {entry, day} of sessions) {
    const link = entry.program;
    if (!link?.id || !link.slots?.[link.index] || !entry.total || entry.sets < entry.total) continue;
    const mode = link.mode ?? state.programs.find(p => p.id === link.id)?.mode;
    const key = JSON.stringify([link.id, mode, link.slots]);
    if (!programs.has(key)) programs.set(key, {mode, slots:link.slots, records:[]});
    programs.get(key).records.push({day,index:link.index});
    if (mode !== "weekly" || link.index !== day - weekSerial(day)) continue;
    const week = weekSerial(day);
    const weekKey = JSON.stringify([key,week]);
    if (!weeks.has(weekKey)) weeks.set(weekKey,{key, week, slots:link.slots, done:new Set()});
    weeks.get(weekKey).done.add(link.index);
  }
  let weekly = false, recovery = false, documentedRecovery = false, program = false, project = false;
  const successfulWeeks = new Map();
  for (const {key,week,slots,done} of weeks.values()) {
    if (slots.some((slot,i) => slot && !done.has(i))) continue;
    weekly = true;
    if (week + 6 > today) continue;
    if (!successfulWeeks.has(key)) successfulWeeks.set(key, []);
    successfulWeeks.get(key).push(week);
    const rest = slots.flatMap((slot,i) => slot ? [] : [week + i]);
    if (!rest.length || rest.some(day => activityDays.has(day))) continue;
    recovery = true;
    if (rest.every(day => restDays.has(day))) documentedRecovery = true;
  }
  for (const item of programs.values()) {
    if (item.mode !== "sequence") continue;
    const done = new Set(item.records.map(record => record.index));
    if (item.slots.some((slot,i) => slot && !done.has(i))) continue;
    program = true;
    const days = item.records.map(record => record.day);
    project ||= Math.max(...days) - Math.min(...days) >= 29;
  }
  for (const done of successfulWeeks.values()) {
    program ||= done.length > 0;
    project ||= longestRun(done,7) >= 5;
  }
  return {weekly,recovery,documentedRecovery,program,project};
}

function achievementFacts(profileId) {
  const profile = state.scaleProfiles[profileId];
  const activities = profile?.outdoorActivities || [];
  const sessions = state.history.flatMap((entry,index) => (entry.profileId || "personal") === profileId && entry.sets > 0
    ? [{entry,index,day:daySerial(localDate(entry.started ?? entry.ended))}] : []).sort((a,b) => a.entry.ended-b.entry.ended);
  const days = new Set(sessions.map(s => s.day));
  const allMovement = new Set([...days, ...activities.filter(a => !["Warmup", "Mobility"].includes(a.sport))
    .map(a => daySerial(a.start.slice(0,10)))]);
  const workoutMonths = new Map(), workoutYears = new Map();
  const workoutWeeks = new Map(), volumeByExercise = new Map(), recordBest = new Map(), previousLoads = new Map();
  const musclesSeen = new Set(), muscleSessions = new Map(), exercises = new Set(), improved = new Set();
  const habits = habitInfo(profile || {});
  const restDays = new Set((habits.restDays || []).map(daySerial));
  const goals = habits.goals || [];
  const cardio = activities.filter(cardioSport);
  let reps = 0, volume = 0, sets = 0, seconds = 0, records = 0, overload = false, firstLoad = null, bench = null;
  for (const session of sessions) {
    const {entry, day, index} = session;
    increment(workoutWeeks, weekSerial(day));
    const date = localDate(entry.started ?? entry.ended);
    increment(workoutMonths, date.slice(0,7));
    increment(workoutYears, date.slice(0,4));
    const workoutGroups = new Set(), loads = new Map();
    sets += entry.sets;
    seconds += entry.seconds || 0;
    for (const record of entry.records || []) {
      if (!record.sets?.length) continue;
      exercises.add(record.id);
      const primary = record.primaryMuscles?.length ? record.primaryMuscles : exerciseFor(record).primaryMuscles || [];
      for (const [group, members] of majorGroups) {
        if (members.some(muscle => primary.includes(muscle))) workoutGroups.add(group);
      }
      for (const set of record.sets) {
        if (!(set.reps > 0)) continue;
        reps += set.reps;
        if (!(set.weight > 0)) continue;
        firstLoad ??= {action:"history-entry",value:index};
        if (benchPress.has(record.id) && set.weight >= 100) bench = {action:"history-entry",value:index};
        volume += set.weight * set.reps;
        increment(volumeByExercise, record.id, set.weight * set.reps);
        loads.set(record.id, Math.max(loads.get(record.id) || 0,set.weight));
      }
    }
    for (const group of workoutGroups) { musclesSeen.add(group); increment(muscleSessions, group); }
    for (const [id, load] of loads) {
      if (previousLoads.has(id) && load > previousLoads.get(id)) overload = true;
      if (recordBest.has(id) && load > recordBest.get(id)) { records++; improved.add(id); }
      recordBest.set(id, Math.max(load, recordBest.get(id) || 0));
      previousLoads.set(id, load);
    }
  }
  const dayGaps = [...allMovement].sort((a,b) => a-b);
  let comeback = 0;
  for (let i = 1; i < dayGaps.length; i++) {
    if (days.has(dayGaps[i])) comeback = Math.max(comeback, dayGaps[i] - dayGaps[i-1] - 1);
  }
  const weeklyTarget = habits.weekly || 0;
  const successful = [...workoutWeeks].filter(([,count]) => weeklyTarget > 0 && count >= weeklyTarget).map(([week]) => week);
  const currentDay = daySerial(localDate(Date.now()));

  return {
    activities, sessions, firstLoad, bench, reps, volume, sets, seconds, records, overload, improved:improved.size,
    liftVolume:Math.max(0,...volumeByExercise.values()), exercises:exercises.size, musclesSeen:musclesSeen.size, muscleSessions,
    trainingDays:days.size, consecutiveDays:longestRun(days), consecutiveWeeks:longestRun(workoutWeeks.keys(),7),
    goalDays:weeklyTarget ? goalCoverage(workoutWeeks, days, weeklyTarget, currentDay) : 0,
    dailyGoal:weeklyTarget > 0 && dailyGoalStreak(days,workoutWeeks,weeklyTarget), weeklyGoal:successful.length > 0,
    month:Math.max(0,...workoutMonths.values()), year:Math.max(0,...workoutYears.values()),
    morning:sessions.some(({entry}) => new Date(entry.started ?? entry.ended).getHours() === 5),
    night:sessions.some(({entry}) => new Date(entry.started ?? entry.ended).getHours() >= 22),comeback,
    cardio, cardioKm:cardio.reduce((n,a)=>n+(a.km || 0),0), cardioMinutes:cardio.reduce((n,a)=>n+a.minutes,0),
    sports:new Set(cardio.map(a=>a.sport)).size,
    goals:goals.length, completedGoals:goals.filter(g=>g.done).length,
    longGoal:goals.some(g=> (g.done ? daySerial(g.done) : currentDay) - daySerial(g.created) >= 90),
    rest:[...restDays].filter(day=>!allMovement.has(day)).length, mobility:activities.filter(a=>a.sport === "Mobility").length, warmup:activities.filter(a=>a.sport === "Warmup").length,
    planned:plannedProgress(sessions,allMovement,restDays)
  };
}

const medalRules = [];
function medal(category, id, name, hint, check, target = "history") {
  medalRules.push({category,id,name,hint,check,target});
}
function level(category, field, name, count, hint, target) {
  medal(category, field+"-"+count, name, hint, data => data[field] >= count, target);
}
const gym = "Consistência", strength = "Força", volume = "Volume", variety = "Variedade",
  cardio = "Cardio", plans = "Metas e planos", rest = "Recuperação", extras = "Marcos";
const run = (id,name,hint,predicate) => medal(cardio,id,name,hint,
  d=>d.activities.find(predicate) || false,"activities");
run("first-run","Primeiros passos","Registre uma corrida.", roadRun);
run("five","Clube dos 5K","Corra 5 km em uma atividade.",a=>roadRun(a)&&a.km>=5);
run("pace6","Pace 6","Corra 5 km ou mais a 6:00 min/km ou mais rápido.",a=>roadRun(a)&&a.km>=5&&a.minutes<=6*a.km);
run("ten","Dez na conta","Corra 10 km em uma atividade.",a=>roadRun(a)&&a.km>=10);
run("half","Meia maratona","Corra 21,0975 km em uma atividade.",a=>roadRun(a)&&a.km>=21.0975);
run("marathon-single","Maratona completa","Corra 42,195 km em uma atividade.",a=>roadRun(a)&&a.km>=42.195);
run("ride25","Giro de 25","Pedale 25 km em uma atividade.",a=>cycling(a)&&a.km>=25);
run("ride50","Meia centena","Pedale 50 km em uma atividade.",a=>cycling(a)&&a.km>=50);
medal(gym,"first-gym","Primeiro Passo","Finalize um treino com uma série concluída.",d=>d.sessions.length>0);
for (const [n,name] of [[3,"Começando Bem"],[5,"Semana de Ferro"],[30,"Um Mês de Dedicação"],[100,"Veterano da Academia"],[250,"Incansável"],[500,"Lenda da Academia"]]) {
  medal(gym,"sessions-"+n,name,`Complete ${n} treinos.`,d=>d.sessions.length>=n);
}
level(gym,"trainingDays","Meio Milhar",500,"Treine em 500 dias diferentes.");
level(gym,"consecutiveWeeks","Rotina Criada",2,"Treine em duas semanas consecutivas.");
medal(gym,"steel","Disciplina de Aço","Treine em 30 dias seguidos e cumpra a meta semanal configurada nas semanas completas desse período.",
  d=>d.dailyGoal);
medal(strength,"bench100","Monstro","Conclua uma série de supino reto com barra com pelo menos 100 kg.",d=>d.bench);
medal(strength,"first-load","Primeiro Quilo","Conclua uma série com carga.",d=>d.firstLoad);
medal(strength,"overload","Sobrecarga Progressiva","Aumente a carga em relação ao treino anterior do mesmo exercício.",d=>d.overload);
for (const [n,name] of [[1,"Mais Forte"],[5,"Quebrando Limites"],[10,"Força Bruta"],[20,"Mestre da Força"]]) {
  level(strength,"records",name,n,n===1?"Supere a melhor carga anterior em um exercício.":`Supere ${n} recordes pessoais de carga.`);
}
for (const [n,name] of [[100,"Centenário"],[500,"Meio Caminho"],[1000,"Monstro da Academia"]]) {
  level(strength,"liftVolume",name,n,`Some ${formatted(n)} kg de volume em um mesmo exercício (carga × repetições).`);
}
level(strength,"improved","Evolução Constante",5,"Supere sua melhor carga em cinco exercícios diferentes.");
for (const [n,name] of [[100,"Primeiro Centenário"],[1000,"Máquina de Repetições"],[10000,"Volume Insano"]]) {
  level(volume,"reps",name,n,`Complete ${formatted(n)} repetições registradas.`);
}
for (const [n,name] of [[1000,"Tonelagem Inicial"],[10000,"Uma Montanha de Peso"],[100000,"Gigante de Aço"]]) {
  level(volume,"volume",name,n,`Some ${n / 1000} t de volume (carga × repetições).`);
}
level(volume,"sets","Persistência",50,"Complete 50 séries.");
level(volume,"sets","Volume de Respeito",500,"Complete 500 séries.");
level(volume,"seconds","Maratonista de Ferro",360000,"Acumule 100 horas de musculação.");
for (const [n,name] of [[5,"Curioso"],[15,"Explorador"],[30,"Sem Monotonia"]]) {
  level(variety,"exercises",name,n,`Conclua séries em ${n} exercícios diferentes.`);
}
level(variety,"musclesSeen","Corpo Completo",6,"Treine pernas, peito, costas, braços, ombros e abdômen.");
medal(variety,"master-gym","Mestre da Academia","Treine todos os seis grupos em sessões distintas.",
  d=>{
    const candidates = [...majorGroups].map(([,members]) => d.sessions.filter(({entry}) =>
      entry.records?.some(record => record.sets?.length &&
        (record.primaryMuscles?.length ? record.primaryMuscles : exerciseFor(record).primaryMuscles || []).some(m=>members.includes(m)))).map(s=>s.index));
    const matched = new Map();
    function assign(group,seen) {
      for (const session of candidates[group]) {
        if (seen.has(session)) continue;
        seen.add(session);
        if (!matched.has(session) || assign(matched.get(session),seen)) { matched.set(session,group); return true; }
      }
      return false;
    }
    return candidates.every((_,group)=>assign(group,new Set()));
  });
for (const [group,name,label] of [["legs","Pernas de Aço","pernas"],["chest","Peitoral de Titânio","peitoral"],
  ["back","Costas de Gigante","costas"],["arms","Braços de Ferro","braços"],["shoulders","Ombros de Aço","ombros"]]) {
  medal(variety,group+"20",name,`Treine ${label} em 20 sessões.`,d=>d.muscleSessions.get(group)>=20);
}
run("first-cardio","Primeiro Suor","Registre sua primeira atividade cardiovascular.",cardioSport);
for (const [n,name] of [[5,"Primeiros 5 km"],[10,"Dez Quilômetros"],[42.195,"Maratonista"],[100,"Centenário Cardio"]]) {
  level(cardio,"cardioKm",name,n,`Acumule ${String(n).replace(".",",")} km de cardio.`,"activities");
}
medal(cardio,"cardio20","Coração de Ferro","Registre 20 atividades cardiovasculares.",d=>d.cardio.length>=20,"activities");
level(cardio,"cardioMinutes","Resistência de Aço",3000,"Acumule 50 horas de cardio.","activities");
level(cardio,"sports","Sempre em Movimento",10,"Registre cardio em dez modalidades distintas.","activities");
level(plans,"goals","Primeiro Objetivo",1,"Crie uma meta pessoal.","trainingHabits");
for (const [n,name] of [[1,"Meta Cumprida"],[5,"Determinação"],[10,"Imparável"]]) {
  level(plans,"completedGoals",name,n,n===1?"Conclua a primeira meta.":`Conclua ${n} metas pessoais.`,"trainingHabits");
}
medal(plans,"perfect-plan","Planejamento Perfeito","Conclua todos os treinos do plano nas datas de uma semana.",d=>d.planned.weekly);
medal(plans,"programme","Compromisso","Complete uma sequência inteira ou uma semana de um plano.",d=>d.planned.program);
medal(plans,"project","Projeto Evolução","Complete um plano em cinco semanas seguidas ou uma sequência com registros ao longo de pelo menos 30 dias.",d=>d.planned.project);
medal(plans,"transformation","Transformação","Mantenha uma meta registrada por 90 dias.",d=>d.longGoal,"trainingHabits");
level(rest,"rest","Descanso Merecido",1,"Registre um dia de descanso planejado.","trainingHabits");
medal(rest,"balance","Equilíbrio","Complete uma semana do plano e registre todos os dias de descanso cumpridos.",d=>d.planned.documentedRecovery);
medal(rest,"smart","Recuperação Inteligente","Complete uma semana do plano sem treinar nos dias de descanso.",d=>d.planned.recovery);
level(rest,"mobility","Mobilidade em Dia",10,"Registre dez sessões de mobilidade ou alongamento.","activities");
level(rest,"warmup","Aquecimento Completo",10,"Registre dez aquecimentos.","activities");
level(rest,"goalDays","Consistência Saudável",30,"Cumpra a meta semanal de treinos por pelo menos 30 dias.","trainingHabits");
medal(extras,"morning","Novo Habitante","Inicie às 5h um treino que você concluiu.",d=>d.morning);
medal(extras,"night","Coruja da Academia","Inicie às 22h ou depois um treino que você concluiu.",d=>d.night);
level(extras,"comeback","A Lenda Retorna",30,"Volte a treinar após 30 dias sem atividade.");
level(extras,"comeback","Ressurgimento",90,"Volte a treinar após 90 dias sem atividade.");
level(extras,"month","O Primeiro de Muitos",10,"Complete dez treinos em um mês.");
medal(extras,"week","Semana Perfeita","Cumpra a meta semanal de treinos.",d=>d.weeklyGoal,"trainingHabits");
level(extras,"year","Ano de Ferro",100,"Complete 100 treinos em um ano.");

function earnedAchievements(profileId = state.scaleProfileId) {
  const facts = achievementFacts(profileId);
  const results = medalRules.map(rule => {
    const hit = rule.check(facts);
    let source = null;
    if (hit) {
      source = hit.action ? hit : hit.id ? {action:"view-activity", value:hit.id} : {action:rule.target, value:""};
    }
    return {...rule,source};
  });
  const count = results.filter(rule=>rule.source).length;
  const hall = [...new Set(results.map(rule=>rule.category))]
    .some(category=>results.filter(rule=>rule.category===category).every(rule=>rule.source));
  for (const [id,name,hint,earned] of [
    ["collector","Colecionador","Desbloqueie 25 medalhas da lista.",count>=25],
    ["hunter","Caçador de Troféus","Desbloqueie 50 medalhas da lista.",count>=50],
    ["hall","Hall da Fama","Desbloqueie todas as medalhas de uma categoria.",hall]
  ]) results.push({id,name,hint,category:"Coleção",source:earned ? {action:"achievements",value:""} : null});
  return results;
}

function achievementKeys(profileId) {
  return new Set(earnedAchievements(profileId).filter(rule => rule.source).map(rule => rule.id));
}

function announceAchievements(before, profileId) {
  const unlocked = earnedAchievements(profileId).filter(rule => rule.source && !before.has(rule.id));
  if (!unlocked.length) return false;
  toast(unlocked.length === 1 ? `Medalha desbloqueada: ${unlocked[0].name}` : `${unlocked.length} medalhas desbloqueadas!`);
  return true;
}

let achievementCategory = "";
function achievements() {
  const rules = earnedAchievements();
  const total = rules.filter(rule => rule.source).length;
  const categories = [...new Set(rules.map(rule => rule.category))];
  const shown = achievementCategory ? categories.filter(category => category === achievementCategory) : categories;
  return heading("Conquistas", true) + `<div class="stack">
    <section class="glass stack">
      ${scaleProfilePicker()}
      <p><strong>${total} de ${rules.length} medalhas</strong></p>
      ${button("trainingHabits", "Metas e recuperação", "list")}
      <label class="field">Categoria<select id="achievement-category">
        <option value="">Todas</option>${categories.map(category=>`<option ${category===achievementCategory?"selected":""}>${category}</option>`).join("")}
      </select></label>
      <progress class="progress-track" max="${rules.length}" value="${total}" aria-label="Medalhas desbloqueadas"></progress>
      <small>Corrija ou exclua o registro para recalcular a medalha. Se outro registro cumprir a meta, ela continua desbloqueada.</small>
    </section>
    ${shown.map((category, index) => {
      const group = rules.filter(rule=>rule.category === category);
      return `<details class="glass achievement-category" ${index===0?"open":""}>
        <summary>${category} · ${group.filter(rule=>rule.source).length}/${group.length}</summary>
        <div class="stack">${group.map(({name,hint,source}) => `<article class="glass stack achievement ${source ? "earned" : ""}">
          <div class="row"><span class="tile-icon">${glyph("medal")}</span>
            <div class="grow"><h3>${name}</h3><small>${source ? "Desbloqueada" : "Bloqueada"}</small></div></div>
          <p>${hint}</p>
          ${source && source.action !== "achievements" ? button(source.action, source.value === "" ? "Ver histórico" : "Ver registro", "next", "", source.value) : ""}
        </article>`).join("")}</div></details>`;
    }).join("")}
  </div>`;
}

function editHistoryLoads(index) {
  const entry = state.history[index];
  if (!entry?.records?.length) return;
  openSheet("Corrigir cargas", `<form id="history-loads" class="stack" data-index="${index}">
    ${entry.records.map((record, exercise) => record.sets.length ? `<section class="glass stack">
      <h3>${escaped(record.name)}</h3>${record.sets.map((set, order) => {
        const minimum = set.drops?.length ? (Math.round(set.drops[0] * 100) + 1) / 100 : 0;
        return `<label class="field">Série ${set.number} · Carga (kg)
          <input type="number" name="load" data-record="${exercise}" data-set-index="${order}" min="${minimum}" max="9999"
            step=".01" value="${set.weight}" required></label>`;
      }).join("")}</section>` : "").join("")}
    <button class="primary">Salvar correção</button></form>`);
}

function saveHistoryLoads(form) {
  const index = Number(form.dataset.index);
  const previous = state.history[index];
  if (!previous || !form.reportValidity()) return;
  const entry = copy(previous);
  for (const input of form.querySelectorAll('[name="load"]')) {
    entry.records[Number(input.dataset.record)].sets[Number(input.dataset.setIndex)].weight = input.valueAsNumber;
  }
  state.history[index] = entry;
  if (!save()) { state.history[index] = previous; return; }
  closeSheet();
  render(true);
  toast("Cargas corrigidas.");
}

function removeHistoryEntry(index) {
  if (!state.history[index]) return;
  const previous = state.history;
  state.history = previous.filter((entry, at) => index !== at);
  if (!save()) { state.history = previous; return; }
  closeSheet();
  render(true);
  toast("Sessão excluída.");
}
