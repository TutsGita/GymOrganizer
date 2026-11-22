"""Generate offline pt-BR exercise text with the Argos English → Brazilian Portuguese model."""
import json
import sys
import re
from pathlib import Path

import ctranslate2
from sentencepiece import SentencePieceProcessor

assets = Path(__file__).resolve().parents[1] / "app/src/main/assets"
model = Path(sys.argv[1])
translator = ctranslate2.Translator(str(model / "model"), device="cpu", compute_type="int8", inter_threads=3, intra_threads=2)
processor = SentencePieceProcessor(model_file=str(model / "sentencepiece.model"))

def read_catalog(name):
    return json.loads((assets / name).read_text("utf-8").split("=", 1)[1].strip().rstrip(";"))

rows = {row["id"]: row for row in read_catalog("catalog.js")}
for row in read_catalog("wger-catalog.js"):
    if row["portuguese"]:
        rows.pop(row["id"], None)
    elif row.get("instructions"):
        rows[row["id"]] = row

lines = list(dict.fromkeys(text.strip() for row in rows.values() for text in [row["name"], *row.get("instructions", [])] if text.strip()))
results = {}
for start in range(0, len(lines), 64):
    texts = lines[start:start + 64]
    output = translator.translate_batch(processor.encode(texts, out_type=str), beam_size=3,
                                        max_batch_size=16, max_input_length=1024, max_decoding_length=1024)
    for source, result in zip(texts, output):
        translation = processor.decode(result.hypotheses[0]).replace("▁", " ")
        translation = re.sub(r"\s+([.,;:!?])", r"\1", re.sub(r" {2,}", " ", translation)).strip()
        results[source] = re.sub(r"\bdumbbells?\b", "halteres", translation, flags=re.I)
    if start % 1024 == 0:
        print(start, len(lines), flush=True)

def translated(text):
    result = results[text.strip()]
    return result if result and "<unk>" not in result else None

local = {}
for id_, row in rows.items():
    steps = [step for step in row.get("instructions", []) if step.strip()]
    localized = [translated(step) for step in steps]
    if localized and all(localized):
        local[id_] = [translated(row["name"]) or row["name"], localized]
local.update({
    "Iron_Cross": ["Cruz de ferro", ["Nas argolas, comece em apoio com os braços estendidos. Abra os braços lateralmente até aproximá-los da altura dos ombros. Volte ao apoio com controle."]],
    "One-Arm_Kettlebell_Swings": ["Swing unilateral com kettlebell", ["Segure o kettlebell com uma mão e leve o quadril para trás. Estenda o quadril para impulsionar o peso à frente. Deixe o peso voltar entre as pernas com controle."]],
    "Push_Press": ["Desenvolvimento com impulso", ["Comece com a barra apoiada na frente dos ombros. Flexione ligeiramente os joelhos e estenda as pernas para impulsionar a barra acima da cabeça. Baixe-a até os ombros com controle."]],
    "Side_Bridge": ["Prancha lateral", ["Apoie o antebraço no chão com o cotovelo abaixo do ombro. Eleve o quadril até alinhar o tronco e as pernas. Sustente a posição e troque de lado."]],
    "Side_Jackknife": ["Abdominal lateral canivete", ["Deite-se de lado com as pernas estendidas. Eleve o tronco e a perna de cima, aproximando o cotovelo do joelho. Retorne devagar e troque de lado."]],
})
(assets / "catalog-pt.js").write_text("window.GYM_EXERCISES_PT = " + json.dumps(local, ensure_ascii=False, separators=(",", ":")) + ";\n", "utf-8")
print(f"{len(local)} Portuguese records out of {len(rows)} candidates", flush=True)
