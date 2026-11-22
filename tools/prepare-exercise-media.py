"""Prepare credited offline thumbnails and pinned CC0 video references from public snapshots."""
import concurrent.futures
import io
import json
import re
import subprocess
import sys
import tempfile
import unicodedata
from collections import defaultdict
from pathlib import Path

import imageio_ffmpeg
import requests
from PIL import Image

assets = Path(__file__).resolve().parents[1] / "app/src/main/assets"
cache = Path(sys.argv[1])
cdn = "https://cdn.jsdelivr.net/gh/namnq/workout-free-videos@v2.0.0/"
galaxy_source = "https://github.com/namnq/workout-free-videos/tree/v2.0.0"
headers = {"User-Agent": "GymOrganizer/0.4.1 (https://github.com/TutsGita/GymOrganizer)"}

def read(path):
    return json.loads(path.read_text("utf-8-sig"))

def catalog(name):
    return json.loads((assets / name).read_text("utf-8").split("=", 1)[1].strip().rstrip(";"))

def key(name):
    return re.sub("[^a-z0-9]", "", unicodedata.normalize("NFKD", name.lower()))

legacy = catalog("catalog.js")
wger = catalog("wger-catalog.js")
data = read(cache / "wger-source.json")
images = read(cache / "wger-images-0.4.1.json")["results"]
galaxy = read(cache / "galaxy-0.4.1.json")
license_by_id = {i["id"]: i for i in data["licenses"] if i["id"] in (1, 2, 3, 4)}
wger_entries = defaultdict(set)
for row in wger:
    wger_entries[int(row["source"].split("/")[-3])].add(row["id"])
legacy_ids = {row["id"] for row in legacy}
legacy_keys = {key(row["name"]): row["id"] for row in legacy}
source_english = defaultdict(set)
for row in data["exercises"]:
    for translation in row["translations"]:
        if translation["language"] == 2:
            source_english[key(translation["name"])].add(row["id"])
for label, ids in source_english.items():
    if label in legacy_keys and len(ids) == 1:
        wger_entries[next(iter(ids))].add(legacy_keys[label])

# Same movement and equipment across the sources. Keep IDs from saved plans.
matches = {
    "barbell-back-squat": ["Barbell_Squat","Barbell_Full_Squat"],
    "military-press": ["Standing_Military_Press"],
    "dumbbell-lateral-raise": ["Side_Lateral_Raise"],
    "chest-dip": ["Dips_-_Chest_Version"],
    "close-grip-bench-press": ["Close-Grip_Barbell_Bench_Press"],
    "incline-bench-press": ["Barbell_Incline_Bench_Press_-_Medium_Grip"],
    "exercise-ball-dumbbell-bench-press": ["Dumbbell_Bench_Press_with_Neutral_Grip_on_Exercise_Ball"],
    "bent-over-low-pulley-rear-delt-fly": ["Bent_Over_Low-Pulley_Side_Lateral"],
    "ez-bar-skullcrusher": ["Lying_Triceps_Press"],
    "standing-barbell-curl": ["Barbell_Curl"],
    "dumbbell-hammer-preacher-curl": ["Preacher_Hammer_Dumbbell_Curl"],
    "barbell-upright-row": ["Upright_Barbell_Row"],
    "seated-cable-row": ["Seated_Cable_Rows"],
    "bent-over-row": ["Bent_Over_Barbell_Row"],
    "lat-pull-down": ["Wide-Grip_Lat_Pulldown"],
    "wide-grip-pull-up": ["Pullups"],
    "straight-arm-lat-pull-down": ["Straight-Arm_Pulldown"],
    "barbell-hip-thrust": ["Barbell_Hip_Thrust"],
    "hyperextension": ["Hyperextensions_Back_Extensions"],
    "good-mornings": ["Good_Morning"],
    "machine-hack-squat": ["Hack_Squat"],
    "stiff-leg-deadlift": ["Stiff-Legged_Barbell_Deadlift"],
    "exercise-ball-leg-curl": ["Ball_Leg_Curl"],
    "standing-machine-calf-raise": ["Standing_Calf_Raises"],
    "seated-calf-raise": ["Seated_Calf_Raise"],
    "45-degree-leg-press-calf-raise": ["Calf_Press_On_The_Leg_Press_Machine"],
    "weighted-crunch": ["Weighted_Crunches"],
    "hip-adduction-machine": ["Thigh_Adductor"],
    "it-band-foam-rolling": ["Iliotibial_Tract-SMR"],
}
chosen = defaultdict(list)
for image in sorted(images, key=lambda row: (not row["is_main"], row["id"])):
    author = image["license_author"] or ", ".join(image["author_history"])
    if image["license"] not in license_by_id or image["is_ai_generated"] or (not author and image["license"] != 3):
        continue
    url = image["image"]
    if not re.fullmatch(r"https://wger\.de/media/exercise-images/[A-Za-z0-9_./%()\-]+", url):
        continue
    if len(chosen[image["exercise"]]) < 2:
        chosen[image["exercise"]].append((image, author))

gallery = defaultdict(list)
jobs = {}
for exercise, photos in chosen.items():
    if not wger_entries[exercise]:
        continue
    for image, author in photos:
        lic = license_by_id[image["license"]]
        name = f"wger-{image['id']}.webp"
        record = {"file": name, "source": image["image"], "author": author or "wger", "license": lic["short_name"],
                  "licenseUrl": lic["url"], "provider": "wger", "edit": "Redimensionada"}
        jobs[name] = (image["image"], None)
        for id_ in wger_entries[exercise]:
            gallery[id_].append(record)

videos = {}
for exercise in galaxy:
    slug = exercise["slug"]
    ids = set(matches.get(slug, [legacy_keys.get(key(exercise["name"]))])) & legacy_ids
    if not ids:
        continue
    path = exercise["video"]["path"]
    if not re.fullmatch(r"media/video/[a-z0-9-]+\.mp4", path):
        raise ValueError(path)
    video = {"url": cdn + path, "size": exercise["video"]["bytes"],
             "provider": "Galaxy Fitness", "source": galaxy_source,
             "credit": {"author": "Galaxy Fitness / namnq", "license": "CC0 1.0",
                        "url": "https://creativecommons.org/publicdomain/zero/1.0/"}}
    for id_ in ids:
        videos[id_] = video
        if not gallery[id_]:
            name = f"galaxy-{slug}.webp"
            jobs[name] = (video["url"], 1.0)
            gallery[id_].append({"file": name, "source": galaxy_source, "author": video["credit"]["author"],
                                 "license": "CC0 1.0", "licenseUrl": video["credit"]["url"],
                                 "provider": "Galaxy Fitness", "edit": "Quadro extraído do vídeo"})

commons_text = (assets / "commons-videos.js").read_text("utf-8")
commons = json.loads(re.search(r"Object\.fromEntries\((\[.*?\])\.map", commons_text, re.S)[1])

def gallery_frame(id_, name, video, source, provider, credit, seconds):
    if gallery[id_]:
        return
    jobs[name] = (video, seconds)
    gallery[id_].append({"file": name, "source": source, "author": credit["author"],
                         "license": credit["license"], "licenseUrl": credit["url"],
                         "provider": provider, "edit": "Quadro extraído do vídeo"})

for id_, location, filename, _, *public_domain in commons:
    site = "https://commons.wikimedia.org/wiki/File:" + filename
    url = f"https://upload.wikimedia.org/wikipedia/commons/{location}/{filename}"
    credit = ({"author": "Centers for Disease Control and Prevention", "license": "Domínio público (EUA)",
               "url": "https://creativecommons.org/publicdomain/mark/1.0/"} if public_domain else
              {"author": "FitnessScape", "license": "CC BY 3.0", "url": "https://creativecommons.org/licenses/by/3.0/"})
    gallery_frame(id_, f"commons-{id_.lower()}.webp", url, site, "Wikimedia Commons", credit,
                  {"Pushups": 36.0, "Machine_Bench_Press": 15.0}.get(id_, 1.3))

name = "commons-leg-extension.webp"
jobs[name] = ("https://upload.wikimedia.org/wikipedia/commons/3/36/LegExtensionMachineExercise.JPG", None)
gallery["Leg_Extensions"].append({
    "file": name, "source": "https://commons.wikimedia.org/wiki/File:LegExtensionMachineExercise.JPG",
    "author": "GeorgeStepanek (atribuído no Commons), com Emily", "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/", "provider": "Wikimedia Commons",
    "edit": "Redimensionada"})

wger_videos = catalog("wger-videos.js")
wger_videos.update({row["id"]: row["video"] for row in wger if "video" in row})
lengths = {v["video"]: (v["duration"], v["id"]) for v in data["videos"]}
for id_, video in wger_videos.items():
    if video["size"] > 20 * 1024 * 1024:
        continue
    duration, pk = lengths[video["url"]]
    gallery_frame(id_, f"wger-frame-{pk}.webp", video["url"], video["url"], "wger",
                  video["credit"], max(0.25, float(duration) * .4))

output = assets / "photos"
output.mkdir(exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

def prepare(job):
    name, (url, frame) = job
    try:
        if (output / name).is_file():
            return name
        with requests.get(url, headers=headers, timeout=20) as response:
            response.raise_for_status()
            payload = response.content
        if frame is not None:
            with tempfile.TemporaryDirectory(dir=cache) as temp:
                local = Path(temp) / "clip"
                local.write_bytes(payload)
                payload = subprocess.run([ffmpeg, "-threads", "1", "-loglevel", "error", "-ss", str(frame),
                                          "-i", str(local), "-frames:v", "1", "-f", "image2pipe",
                                          "-vcodec", "png", "-threads", "1", "pipe:1"],
                                         capture_output=True, timeout=30, check=True).stdout
        with Image.open(io.BytesIO(payload)) as photo:
            photo.thumbnail((480, 480))
            photo.convert("RGB").save(output / name, "WEBP", quality=75)
        return name
    except Exception as error:
        print(f"Skipped {name}: {error}", flush=True)
        return None

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    prepared = set(pool.map(prepare, sorted(jobs.items())))
gallery = {id_: [record for record in gallery[id_] if record["file"] in prepared] for id_ in sorted(gallery)}
gallery = {id_: photos for id_, photos in gallery.items() if photos}
content = {"photos": gallery, "videos": dict(sorted(videos.items()))}
(assets / "exercise-media.js").write_text("window.GYM_EXERCISE_MEDIA = " + json.dumps(content, ensure_ascii=False, separators=(",", ":")) + ";\n", "utf-8")
print(f"{len(gallery)} exercises with photos; {len(videos)} with Galaxy videos; {len(prepared - {None})} files")
