"use strict";

window.COMMONS_EXERCISE_VIDEOS = Object.fromEntries([
  ["Barbell_Squat", "5/5c", "Squat_-_exercise_demonstration_video.webm", 566000],
  ["Bent_Over_Barbell_Row", "b/b2", "Bent-over_row_-_exercise_demonstration_video.webm", 376000],
  ["Barbell_Deadlift", "6/62", "Deadlift_-_exercise_demonstration_video.webm", 447000],
  ["Machine_Bench_Press", "7/70", "Muscle_Strengthening_at_the_Gym_-_Chest_Press.webm", 3566000, true],
  ["Pushups", "1/18", "Muscle_Strengthening_at_Home_-_Push-ups.webm", 6491000, true]
].map(([id, path, filename, size, publicDomain]) => [id, {
  url: `https://upload.wikimedia.org/wikipedia/commons/${path}/${filename}`,
  source: `https://commons.wikimedia.org/wiki/File:${filename}`,
  provider: "Wikimedia Commons",
  size,
  credit: publicDomain
    ? {author: "Centers for Disease Control and Prevention", license: "Domínio público (EUA)", url: "https://creativecommons.org/publicdomain/mark/1.0/"}
    : {author: "FitnessScape", license: "CC BY 3.0", url: "https://creativecommons.org/licenses/by/3.0/"}
}]));
