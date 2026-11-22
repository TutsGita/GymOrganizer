"""Create exercise metadata from a wger exerciseinfo/video/license snapshot."""
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

assets = Path(__file__).resolve().parents[1] / "app/src/main/assets"
data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
legacy = json.loads((assets / "catalog.js").read_text("utf-8").split("=", 1)[1].strip().rstrip(";"))
licenses = {row["id"]: row for row in data["licenses"] if row["id"] in (1, 2, 3, 4)}
def key(name):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", name.lower()))
def credit(row):
    license_ = licenses[row["license"]]
    return {
        "author": row.get("license_author") or ", ".join(row.get("author_history", [])) or "wger e colaboradores",
        "license": license_["short_name"],
        "url": license_["url"]
    }
videos = defaultdict(list)
for video in data["videos"]:
    uri = urlparse(video["video"])
    if (uri.scheme, uri.netloc) == ("https", "wger.de") and uri.path.startswith("/media/exercise-video/") and video["license"] in licenses:
        videos[video["exercise"]].append(video)
muscle_map = {
    "abs":"abdominals", "biceps":"biceps", "triceps":"triceps", "chest":"chest",
    "shoulders":"shoulders", "lats":"lats", "traps":"traps", "quads":"quadriceps",
    "glutes":"glutes", "hamstrings":"hamstrings", "calves":"calves", "obliques":"obliques",
    "forearms":"forearms", "lower back":"lower back", "upper back":"middle back"
}
equipment_map = {"none (bodyweight)":"body only", "dumbbell":"dumbbell", "barbell":"barbell",
                 "kettlebell":"kettlebells", "pull-up bar":"body only", "sz-bar":"e-z curl bar"}

def muscle_keys(rows):
    return list(dict.fromkeys(muscle_map[m["name_en"].lower()] for m in rows
                              if (m.get("name_en") or "").lower() in muscle_map))

en_to_ids = defaultdict(set)
for row in data["exercises"]:
    for t in row["translations"]:
        if t["language"] == 2:
            en_to_ids[key(t["name"])].add(row["id"])
legacy_key = {key(row["name"]): row["id"] for row in legacy}
# Instructions written for verified video entries without usable source text.
video_notes = {
    205: ("Afundo estacionário com halteres", "Dê um passo à frente e mantenha essa posição com um halter em cada mão. Flexione os dois joelhos para descer e empurre o chão com o pé da frente para voltar. Troque a perna após a série."),
    341: ("Agachamento no Smith", "Apoie a barra na parte alta das costas e destrave o aparelho. Flexione os joelhos e o quadril para descer, mantendo os pés firmes. Estenda as pernas e trave a barra ao terminar."),
    366: ("Cadeira flexora", "Alinhe os joelhos ao eixo da máquina e posicione o apoio acima dos calcanhares. Flexione os joelhos e volte devagar."),
    367: ("Flexora em pé", "Ajuste a máquina para apoiar o rolo atrás do tornozelo. Flexione o joelho de uma perna sem balançar o tronco e volte com controle."),
    375: ("Leg press no hack", "Apoie as costas no encosto e os pés na plataforma. Solte a trava, flexione os joelhos com controle e pressione a plataforma para voltar. Trave o aparelho no fim."),
    477: ("Barra fixa assistida", "Selecione a assistência e apoie-se na plataforma. Puxe-se até aproximar o queixo da barra e desça com controle."),
    543: ("Desenvolvimento na máquina", "Ajuste o banco para que as alças fiquem na altura dos ombros. Pressione para cima, mantendo as costas apoiadas, e volte devagar."),
    575: ("Encolhimento de ombros no Smith", "Segure a barra com os braços estendidos. Eleve os ombros em direção às orelhas sem girá-los e abaixe com controle."),
    802: ("Afundo caminhando com barra", "Apoie a barra na parte alta das costas. Dê um passo à frente, flexione os joelhos e empurre o chão com o pé da frente. Continue alternando as pernas."),
    803: ("Tríceps unilateral na polia", "Com o cabo na polia alta, segure a alça com uma mão e mantenha o cotovelo junto ao corpo. Estenda o braço e retorne devagar.")
}
video_matches = {
    46: "Barbell_Lunge", 73: "Barbell_Bench_Press_-_Medium_Grip", 75: "Dumbbell_Bench_Press",
    91: "Barbell_Curl", 92: "Dumbbell_Bicep_Curl", 95: "Standing_Biceps_Cable_Curl",
    194: "Dips_-_Triceps_Version", 222: "Face_Pull", 245: "Lying_Dumbbell_Tricep_Extension",
    257: "Front_Barbell_Squat", 294: "Barbell_Hip_Thrust", 341: "Smith_Machine_Squat",
    348: "Side_Lateral_Raise", 365: "Lying_Leg_Curls", 366: "Seated_Leg_Curl",
    507: "Romanian_Deadlift", 512: "Seated_Cable_Rows",
    537: "Incline_Dumbbell_Press", 538: "Barbell_Incline_Bench_Press_-_Medium_Grip",
    567: "Dumbbell_Shoulder_Press", 570: "Barbell_Shrug", 590: "Seated_Calf_Raise",
    659: "Triceps_Pushdown", 802: "Barbell_Walking_Lunge", 803: "Cable_One_Arm_Tricep_Extension"
}
rows = []
matched = set()
video_aliases = {}
for exercise in data["exercises"]:
    i = exercise["id"]
    eligible = [t for t in exercise["translations"] if t["license"] in licenses]
    langs = {lang: next((t for t in eligible if t["language"] == lang and t.get("description_source")), None) for lang in (7, 2)}
    pt, en = langs[7], langs[2]
    selected = pt or en
    original_video_note = videos[i] and (not selected or len(selected["description_source"].strip()) < 5)
    if (not selected or not pt) and not videos[i]:
        continue
    old = legacy_key.get(key(en["name"])) if en and en_to_ids[key(en["name"])] == {i} else None
    if old in matched:
        old = None
    if old:
        matched.add(old)
    item = {"id": old or f"wger-{i}", "source": f"https://wger.de/en/exercise/{i}/view/"}
    if original_video_note:
        name, instruction = video_notes[i]
        item.update(name=name, instructions=[instruction], portuguese=True)
    else:
        item.update(name="Barra fixa pronada" if i == 475 else selected["name"], portuguese=bool(pt),
                    instructions=[line.strip() for line in selected["description_source"].splitlines() if line.strip()],
                    credit=credit(selected))
    if not old:
        item.update({"images": [], "primaryMuscles": muscle_keys(exercise["muscles"]),
                     "secondaryMuscles": muscle_keys(exercise["muscles_secondary"]),
                     "equipment": next((equipment_map[e["name"].lower()] for e in exercise["equipment"]
                                        if e["name"].lower() in equipment_map), "")})
    if videos[i]:
        v = min(videos[i], key=lambda v: (v["codec"] != "h264", v["size"]))
        item["video"] = {"url": v["video"], "size": v["size"], "credit": credit(v)}
        if i in video_matches and video_matches[i] != item["id"]:
            video_aliases[video_matches[i]] = item["video"]
    rows.append(item)
(assets / "wger-catalog.js").write_text("window.WGER_EXERCISES = " + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";\n", "utf-8")
(assets / "wger-videos.js").write_text("window.WGER_VIDEO_ALIASES = " + json.dumps(video_aliases, ensure_ascii=False, separators=(",", ":")) + ";\n", "utf-8")
print(f"{len(rows)} entries, {len(matched)} existing IDs, {sum('video' in row for row in rows)} with video")
