"""Vérifie toute la banque : réponse présente dans les choix, choix distincts, champs requis, ordre des mots."""
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from arabic import strip, fold  # noqa: E402

DATA = Path(__file__).resolve().parent.parent / "data"
errors = Counter()
examples = {}


def err(kind, ex, msg=""):
    errors[kind] += 1
    examples.setdefault(kind, (ex["id"], msg))


n = 0
for f in sorted(DATA.glob("*.json")):
    if f.stem in ("writing", "summary", "alphabet"):
        continue
    for ex in json.loads(f.read_text(encoding="utf-8")):
        n += 1
        for k in ("id", "level", "cat", "type", "ins", "answer", "explain"):
            if not ex.get(k):
                err("champ manquant " + k, ex)
        t = ex["type"]
        if t == "qcm":
            ch = [c["t"] for c in ex.get("choices", [])]
            if ex["answer"] not in ch:
                err("réponse absente des choix", ex)
            if len(ch) < 2:
                err("moins de 2 choix", ex)
            if len(set(ch)) != len(ch):
                err("choix en double", ex, ch)
            if ex.get("nov") and len({strip(c) for c in ch}) != len(ch):
                err("choix identiques sans voyelles", ex, ch)
            if not ex.get("vow") and not ex.get("nov") and not ex.get("ltr") and len({fold(c) for c in ch}) != len(ch):
                err("choix identiques sans voyelles (à marquer vow)", ex, ch)
        elif t == "fill":
            if not isinstance(ex["answer"], list) or not all(ex["answer"]):
                err("fill sans réponse", ex)
        elif t == "order":
            if sorted(ex["words"]) != sorted(ex["answer"].split()):
                err("mots ≠ réponse", ex)
        elif t == "speak":
            if not ex.get("ar"):
                err("speak sans texte", ex)
        if "___" in ex.get("ar", "") and t == "speak":
            err("trou dans un exercice oral", ex)
print(f"{n} exercices vérifiés.")
if errors:
    for k, v in errors.items():
        print(f"  {k} : {v}   ex. {examples[k]}")
else:
    print("Aucune erreur.")
