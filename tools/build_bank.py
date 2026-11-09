"""Construit la banque d'exercices (data/<niveau>.json) à partir des fichiers de tools/content/.

    python tools/build_bank.py
"""
import json
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from arabic import (strip, fold, translit, conj_past, conj_pres, conj_imp, passive, participles,  # noqa: E402
                    PRONOUNS, PRON_FR, FORMS_ROMAN)
import lists as L  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "tools" / "content"
OUT = ROOT / "data"
LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Expert"]
LV = {l: i for i, l in enumerate(LEVELS)}
rnd = random.Random(2026)
bank = {l: [] for l in LEVELS}


def add(level, cat, theme, typ, ins, answer, explain, **kw):
    ex = {"level": level, "cat": cat, "theme": theme, "type": typ, "ins": ins, "answer": answer, "explain": explain}
    for k, v in kw.items():
        if v not in (None, "", [], False):
            ex[k] = v
    bank[level].append(ex)
    return ex


def lines(name):
    p = CONTENT / name
    for ln in p.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if ln and not ln.startswith("#"):
            yield ln


def pick(pool, good, n=3, key=strip):
    """n distracteurs distincts de `good` (et entre eux) une fois les voyelles retirées."""
    seen = {key(good)}
    res = []
    cand = list(pool)
    rnd.shuffle(cand)
    for c in cand:
        k = key(c)
        if k and k not in seen:
            seen.add(k)
            res.append(c)
            if len(res) == n:
                break
    return res


def choices(good, wrong, fr=None):
    """Liste de choix mélangée ; fr : dict texte -> traduction (affichée après la réponse)."""
    items = [good] + list(wrong)
    rnd.shuffle(items)
    out = []
    for t in items:
        c = {"t": t}
        if fr and fr.get(t):
            c["fr"] = fr[t]
        out.append(c)
    return out


def first_fr(fr):
    return fr.split(" / ")[0]


def nolabel(fr):
    """« un chat » -> « chat » (pour l'écrire dans une phrase française)."""
    return re.sub(r"^(un |une |des |du |de la |de l'|le |la |les |l')", "", first_fr(fr))


# ============================================================== vocabulaire
VOCAB = []          # dicts : level, ar, fr, theme, emoji, pl
for lv in LEVELS:
    for ln in lines(f"vocab_{lv}.txt"):
        f = ln.split("|") + ["", ""]
        VOCAB.append({"level": lv, "ar": f[0], "fr": f[1], "theme": f[2], "emoji": f[3], "pl": f[4]})
FR_OF = {v["ar"]: v["fr"] for v in VOCAB}


def near_level(v, span=1):
    return [w for w in VOCAB if abs(LV[w["level"]] - LV[v["level"]]) <= span and w["ar"] != v["ar"]]


for v in VOCAB:
    lv, ar, fr = v["level"], v["ar"], v["fr"]
    tr = translit(ar)
    same = [w for w in near_level(v) if w["theme"] == v["theme"]]
    pool = same if len(same) >= 3 else near_level(v, 2)
    # FR -> AR
    wrong = pick([w["ar"] for w in pool], ar)
    add(lv, "vocabulaire", v["theme"], "qcm", f"Comment dit-on « {first_fr(fr)} » en arabe ?", ar,
        f"« {fr} » se dit « {ar} » ({tr}).", choices=choices(ar, wrong, FR_OF), say=ar, tr=tr, emoji=v["emoji"])
    # AR -> FR
    wfr = pick([w["fr"] for w in pool], fr, key=lambda s: s.lower())
    add(lv, "vocabulaire", v["theme"], "qcm", "Que signifie ce mot ?", fr,
        f"« {ar} » ({tr}) signifie « {fr} ».", ar=ar, tr=tr, choices=choices(fr, wfr), say=ar, ltr=True)
    # pluriel
    if v["pl"]:
        others = [w["pl"] for w in VOCAB if w["pl"] and w["ar"] != ar]
        fake = []
        base = strip(ar)
        if not ar.endswith("ة"):
            fake += [ar + "ات" if not ar.endswith("ّ") else ar + "ون", ar + "ُونَ"]
        wrong = pick(fake + others, v["pl"])
        add(lv if lv != "A1" else "A2", "vocabulaire", "pluriel", "qcm", f"Quel est le pluriel de « {ar} » ({first_fr(fr)}) ?",
            v["pl"], f"Le pluriel de « {ar} » est « {v['pl']} » ({translit(v['pl'])}).",
            choices=choices(v["pl"], wrong[:3]), say=v["pl"], vow=True)
        if LV[lv] >= 1:
            add(LEVELS[min(LV[lv] + 1, 6)], "vocabulaire", "pluriel", "fill",
                f"Écrivez le pluriel de « {ar} » ({first_fr(fr)}).", [v["pl"]],
                f"« {ar} » → « {v['pl']} » ({translit(v['pl'])}).", say=v["pl"], kb=True)

# intrus (mots de même thème + 1 d'un autre thème)
themes = {}
for v in VOCAB:
    themes.setdefault((v["level"], v["theme"]), []).append(v)
for (lv, th), ws in themes.items():
    if len(ws) < 4 or th in ("adjectifs", "verbes"):
        continue
    others = [w for w in VOCAB if w["theme"] != th and abs(LV[w["level"]] - LV[lv]) <= 1 and w["theme"] not in ("adjectifs", "verbes")]
    for _ in range(max(2, len(ws) // 4)):
        three = rnd.sample(ws, 3)
        odd = rnd.choice(others)
        add(lv, "vocabulaire", "intrus", "qcm", f"Quel mot n'appartient pas au thème « {th} » ?", odd["ar"],
            f"« {odd['ar']} » ({odd['fr']}) n'est pas du thème « {th} ».",
            choices=choices(odd["ar"], [w["ar"] for w in three], FR_OF))

# contraires
opp_all = [a for _, a, b in L.OPPOSITES] + [b for _, a, b in L.OPPOSITES]
for lv, a, b in L.OPPOSITES:
    for x, y in ((a, b), (b, a)):
        wrong = pick([o for o in opp_all if o not in (x, y)], y)
        add(lv, "vocabulaire", "contraires", "qcm", f"Quel est le contraire de « {x} » ?", y,
            f"Le contraire de « {x} » ({translit(x)}) est « {y} » ({translit(y)}).", choices=choices(y, wrong, FR_OF), say=y)

# familles de racines et schèmes
all_root_words = [(w, s, r) for _, r, ws in L.ROOTS for w, s, _ in ws]
for lv, root, ws in L.ROOTS:
    other_roots = [r for _, r, _ in L.ROOTS if r != root]
    for w, sens, scheme in ws:
        add(lv, "vocabulaire", "racines", "qcm", f"Quelle est la racine du mot « {w} » ({sens}) ?", root,
            f"« {w} » vient de la racine {root} ; schème « {scheme} ».", choices=choices(root, rnd.sample(other_roots, 3)), vow=True)
    for _ in range(2):
        three = rnd.sample(ws, min(3, len(ws)))
        odd = rnd.choice([x for x in all_root_words if x[2] != root])
        add(LEVELS[min(LV[lv] + 1, 6)], "vocabulaire", "racines", "qcm", "Quel mot n'a pas la même racine que les autres ?", odd[0],
            f"« {odd[0]} » ({odd[1]}) vient de la racine {odd[2]} ; les autres viennent de {root}.",
            choices=choices(odd[0], [t[0] for t in three]), vow=True)
    places = [w for w, s, sc in ws if sc in ("مَفْعَل", "مَفْعَلَة")]
    agents = [w for w, s, sc in ws if sc == "فَاعِل"]
    if places:
        good = places[0]
        wrong = pick([w for w, s, sc in ws if w != good] + [x[0] for x in all_root_words], good)
        add(LEVELS[min(LV[lv] + 1, 6)], "vocabulaire", "schèmes", "qcm",
            f"Racine {root} : quel mot désigne un LIEU (schème مَفْعَل / مَفْعَلَة) ?", good,
            f"Le schème « مَفْعَل » sert à former des noms de lieu : « {good} » ({FR_OF.get(good) or dict((w, s) for w, s, _ in ws)[good]}).",
            choices=choices(good, wrong), vow=True)
    if agents:
        good = agents[0]
        wrong = pick([w for w, s, sc in ws if w != good], good)
        if len(wrong) >= 2:
            add(LEVELS[min(LV[lv] + 1, 6)], "vocabulaire", "schèmes", "qcm",
                f"Racine {root} : quel mot désigne CELUI QUI FAIT l'action (schème فَاعِل) ?", good,
                f"Le schème « فَاعِل » forme le participe actif (celui qui fait) : « {good} ».", choices=choices(good, wrong), vow=True)

# ============================================================== alphabet
letters = [a[0] for a in L.ALPHABET]
names_tr = [a[2] for a in L.ALPHABET]
for i, (ch, name_ar, name_tr, trl, desc, sun) in enumerate(L.ALPHABET):
    add("A1", "alphabet", "lettres", "qcm", "Comment s'appelle cette lettre ?", name_tr,
        f"« {ch} » s'appelle {name_tr} ({name_ar}) : {desc}.", ar=ch, big=True, choices=choices(name_tr, pick(names_tr, name_tr, key=str)),
        say=name_ar, ltr=True)
    add("A1", "alphabet", "lettres", "qcm", f"Quelle lettre s'appelle « {name_tr} » ?", ch,
        f"{name_tr} ({name_ar}) s'écrit « {ch} ».", choices=choices(ch, pick(letters, ch, key=str)), say=name_ar, big=True)
    add("A1", "alphabet", "sons", "qcm", f"Quelle lettre se prononce {desc} ?", ch,
        f"« {ch} » ({name_tr}) se translittère « {trl} ».", choices=choices(ch, pick(letters, ch, key=str)), big=True, say=name_ar)
    add("A1", "ecoute", "lettres", "qcm", "🔊 Écoutez le nom de la lettre : laquelle est-ce ?", ch,
        f"Vous avez entendu « {name_ar} » ({name_tr}) : la lettre « {ch} ».", audio=name_ar,
        choices=choices(ch, pick(letters, ch, key=str)), big=True)
    # formes
    joins = ch not in L.NON_JOINING
    forms = [("isolée", ch), ("finale", "ـ" + ch)]
    if joins:
        forms += [("initiale", ch + "ـ"), ("médiane", "ـ" + ch + "ـ")]
    for fname, shape in forms[1:]:
        other = [x for x in letters if x != ch]
        def shape_of(x, fname=fname):
            if fname == "finale":
                return "ـ" + x
            if x in L.NON_JOINING:
                return ("" if fname == "initiale" else "ـ") + x
            return x + "ـ" if fname == "initiale" else "ـ" + x + "ـ"
        add("A1", "alphabet", "formes", "qcm", f"Quelle lettre est écrite ici (forme {fname}) ?", ch,
            f"« {shape} » est la forme {fname} de « {ch} » ({name_tr}).", ar=shape, big=True,
            choices=choices(ch, pick(other, ch, key=str)))
    if not joins:
        add("A1", "alphabet", "formes", "qcm", f"La lettre « {ch} » ({name_tr}) peut-elle s'attacher à la lettre qui la suit ?",
            "Non", f"« {ch} » fait partie des 6 lettres qui ne s'attachent jamais à gauche : ا د ذ ر ز و.",
            choices=choices("Non", ["Oui", "Seulement en fin de mot"]), ltr=True)
    # lettres solaires / lunaires
    add("A2", "prononciation", "solaires", "qcm", f"« {ch} » ({name_tr}) est-elle une lettre solaire ou lunaire ?",
        "solaire" if sun else "lunaire",
        (f"« {ch} » est solaire : le ل de l'article ne se prononce pas, la lettre est doublée (ex. الشَّمْس = ash-shams)."
         if sun else f"« {ch} » est lunaire : le ل de l'article se prononce (ex. القَمَر = al-qamar)."),
        choices=choices("solaire" if sun else "lunaire", ["lunaire" if sun else "solaire"]), ltr=True)

# voyelles brèves / longues : lecture de syllabes
VOWS = [("َ", "a", "fatha"), ("ِ", "i", "kasra"), ("ُ", "u", "damma"), ("ْ", "", "soukoun")]
for ch, name_ar, name_tr, trl, desc, sun in L.ALPHABET[1:]:
    base = trl.split(" ")[0]
    if ch in "وي":
        base = ch == "و" and "w" or "y"
    opts = [(ch + v, base + s, vn) for v, s, vn in VOWS[:3]] + [(ch + "َا", base + "ā", "fatha + alif"),
                                                                 (ch + "ُو", base + "ū", "damma + wāw"),
                                                                 (ch + "ِي", base + "ī", "kasra + yāʾ")]
    for syl, rd, vn in rnd.sample(opts, 3):
        wrong = [o[1] for o in opts if o[1] != rd]
        add("A1", "alphabet", "voyelles", "qcm", "Comment se lit cette syllabe ?", rd,
            f"« {syl} » = {rd} ({vn}).", ar=syl, big=True, vow=True, choices=choices(rd, rnd.sample(wrong, 3)), say=syl, ltr=True)

# chiffres arabes (indiens)
for n in list(range(0, 21)) + [25, 30, 34, 47, 50, 58, 63, 76, 81, 99, 100, 250, 1000, 2026]:
    lv = "A1" if n <= 20 else "A2"
    wrong = pick([str(x) for x in (n + 1, n - 1 if n else 11, n * 2 + 3, int(str(n)[::-1]) if n > 9 else n + 10, n + 10)], str(n), key=str)
    add(lv, "alphabet", "chiffres", "qcm", "Quel est ce nombre ?", str(n),
        f"« {L.indic(n)} » s'écrit {n} avec les chiffres occidentaux. Les nombres se lisent de gauche à droite.",
        ar=L.indic(n), big=True, choices=choices(str(n), wrong), ltr=True)

# ============================================================== prononciation
words_pron = [v for v in VOCAB if " " not in v["ar"] and LV[v["level"]] <= 3]
for v in words_pron:
    lv, ar = v["level"], v["ar"]
    tr = translit(ar)
    pool = [w["ar"] for w in near_level(v)]
    wrong = pick(pool, ar)
    add(lv, "prononciation", "translittération", "qcm", f"Quel mot se prononce « {tr} » ?", ar,
        f"« {tr} » correspond à « {ar} » ({v['fr']}).", choices=choices(ar, wrong, FR_OF), say=ar, vow=True)
    wtr = [translit(w) for w in pick(pool, ar)]
    add(LEVELS[min(LV[lv] + 1, 6)] if lv == "A1" else lv, "prononciation", "translittération", "qcm",
        "Comment se prononce ce mot ?", tr, f"« {ar} » se prononce « {tr} » ({v['fr']}).", ar=ar, vow=True,
        choices=choices(tr, pick(wtr, tr, key=str)), say=ar, ltr=True)
# article + lettres solaires
nouns = [v for v in VOCAB if LV[v["level"]] <= 2 and v["theme"] not in ("verbes", "adjectifs", "jours", "couleurs")
         and not v["ar"].startswith("ال") and " " not in v["ar"] and v["ar"][0] in "".join(letters[1:]) and v["ar"][0] != "ل"]
for v in rnd.sample(nouns, min(70, len(nouns))):
    ar = v["ar"]
    first = ar[0]
    sun = first in "تثدذرزسشصضطظلن"
    if sun:
        defi = "ال" + first + "ّ" + ar[1:] if ar[1:2] != "ّ" else "ال" + ar
    else:
        defi = "الْ" + ar
    good = translit(defi)
    t0 = translit(ar)
    alt = ("al-" + t0) if sun else ("a" + L.ALPHABET[letters.index(first)][3].split(" ")[0] + "-" + t0)
    add(v["level"] if v["level"] != "A1" else "A2", "prononciation", "solaires", "qcm", "Comment se prononce ce mot avec l'article ?",
        good, (f"« {first} » est une lettre solaire : le ل ne se prononce pas et « {first} » est doublé."
               if sun else f"« {first} » est une lettre lunaire : le ل de l'article se prononce."),
        ar=defi, vow=True, choices=choices(good, [alt, ("ul-" if sun else "il-") + t0]), say=defi, ltr=True)
# paires minimales
for a, fa, b, fb, why in L.PAIRS:
    for x, fx, y, fy in ((a, fa, b, fb), (b, fb, a, fa)):
        add("A2", "prononciation", "paires", "qcm", f"Quel mot signifie « {fx} » ?", x, f"« {x} » = {fx} ; « {y} » = {fy}. {why}",
            choices=choices(x, [y], {x: fx, y: fy}), say=x, vow=True)
        add("B1", "ecoute", "paires", "qcm", "🔊 Écoutez : quel mot entendez-vous ?", x, f"Vous avez entendu « {x} » ({fx}). {why}",
            audio=x, choices=choices(x, [y], {x: fx, y: fy}), vow=True)
        add("B1", "oral", "paires", "speak", "🎤 Lisez ce mot à voix haute (attention au son difficile).", x,
            f"« {x} » ({translit(x)}) = {fx}. {why}", ar=x, fr=fx, tr=translit(x), say=x)

# ============================================================== orthographe
SUBST = [("ة", "ه"), ("ه", "ة"), ("ى", "ا"), ("ى", "ي"), ("ا", "ى"), ("أ", "ا"), ("ا", "أ"), ("إ", "ا"), ("أ", "إ"),
         ("س", "ص"), ("ص", "س"), ("ت", "ط"), ("ط", "ت"), ("ذ", "ز"), ("ز", "ذ"), ("ث", "س"), ("ض", "د"), ("ض", "ظ"),
         ("ظ", "ض"), ("ح", "ه"), ("ق", "ك"), ("ك", "ق"), ("ع", "ا"), ("ء", "ئ"), ("ئ", "ء"), ("ؤ", "و"), ("و", "ؤ")]


def misspell(word, n=3):
    w = strip(word)
    outs = set()
    tries = 0
    while len(outs) < n and tries < 200:
        tries += 1
        a, b = rnd.choice(SUBST)
        idx = [i for i, c in enumerate(w) if c == a]
        if not idx:
            continue
        i = rnd.choice(idx)
        m = w[:i] + b + w[i + 1:]
        if m != w and fold(m) != "" and m not in outs:
            outs.add(m)
    if len(outs) < n:                                     # voyelle longue ajoutée / retirée
        for i, c in enumerate(w):
            if c in "اوي" and i > 0 and len(outs) < n:
                outs.add(w[:i] + w[i + 1:])
    return list(outs)[:n]


for v in VOCAB:
    lv, ar, fr = v["level"], v["ar"], v["fr"]
    plain = strip(ar)
    alts = [ar] + ([] if v["theme"] == "verbes" else ["ال" + plain if not plain.startswith("ال") else plain[2:]])
    add(lv, "orthographe", "mots", "fill", f"Écrivez en arabe : « {first_fr(fr)} »", alts,
        f"« {fr} » s'écrit « {plain} » ({ar}). Les voyelles sont facultatives dans votre réponse.", say=ar, kb=True)
    bad = misspell(ar)
    if len(bad) >= 2:
        add(lv, "orthographe", "mots", "qcm", f"Quelle est la bonne orthographe du mot qui veut dire « {first_fr(fr)} » ?", plain,
            f"L'orthographe correcte est « {plain} » ({ar}).", choices=choices(plain, bad), nov=True, say=ar)
# tâ' marbûta / alif maqsûra / hamza : questions ciblées
for v in VOCAB:
    p = strip(v["ar"])
    if p.endswith("ة"):
        add(v["level"], "orthographe", "tâ' marbûta", "qcm", f"Comment se termine le mot « {first_fr(v['fr'])} » : {p[:-1]}… ?",
            "ة", f"« {p} » se termine par un tâ' marbûta (ة), marque fréquente du féminin.", choices=choices("ة", ["ه", "ت", "ا"]), nov=True)
    elif p.endswith("ى"):
        add(v["level"], "orthographe", "alif maqsûra", "qcm", f"Comment se termine le mot « {first_fr(v['fr'])} » : {p[:-1]}… ?",
            "ى", f"« {p} » se termine par un alif maqsûra (ى, sans points).", choices=choices("ى", ["ا", "ي", "ة"]), nov=True)
    for h in "أإؤئء":
        if h in p and LV[v["level"]] >= 1:
            i = p.index(h)
            masked = p[:i] + "…" + p[i + 1:]
            add(v["level"], "orthographe", "hamza", "qcm", f"Quel support de hamza manque dans « {masked} » ({first_fr(v['fr'])}) ?", h,
                f"On écrit « {p} » : la hamza s'écrit « {h} » ici.", choices=choices(h, [x for x in "أإؤئء" if x != h][:3]), nov=True)
            break

# ============================================================== conjugaison
VERBS = []
for ln in lines("verbs_sound.txt"):
    lv, root, form, pv, iv, sens, masdar = ln.split("|")
    form = int(form)
    pv = pv if pv != "-" else "a"
    iv = iv if iv != "-" else "a"
    past = conj_past(root, form, pv)
    pres = conj_pres(root, form, iv)
    VERBS.append({"level": lv, "root": root, "form": form, "sens": sens, "masdar": masdar, "past": past, "pres": pres,
                  "sub": conj_pres(root, form, iv, "sub"), "jus": conj_pres(root, form, iv, "jus"),
                  "imp": conj_imp(root, form, iv), "pass": passive(root, form), "inf": past[3], "weak": False,
                  "part": participles(root, form, iv)})
for ln in lines("verbs_weak.txt"):
    lv, inf, sens, typ, past, pres, imp, masdar = ln.split("|")
    VERBS.append({"level": lv, "inf": inf, "sens": sens, "type": typ, "past": past.split(";"), "pres": pres.split(";"),
                  "imp": imp.split(";") if imp != "-" else None, "masdar": masdar, "weak": True, "form": None})

TENSE_EXPL = {
    "past": "Passé (المَاضِي) : radical + suffixe de personne : ـْتُ (je), ـْتَ (tu m.), ـْتِ (tu f.), ـَ (il), ـَتْ (elle), ـْنَا (nous), ـْتُمْ (vous), ـُوا (ils), ـْنَ (elles).",
    "pres": "Présent (المُضَارِع) : préfixe أَـ (je), تَـ (tu, elle), يَـ (il, ils), نَـ (nous) ; suffixes ـِينَ (tu f.), ـُونَ (vous, ils), ـْنَ (vous f., elles).",
}
for vb in VERBS:
    lv = vb["level"]
    nlv = LV[lv]
    inf, sens = vb["inf"], vb["sens"]
    label = f"« {inf} » ({sens})"
    if vb["form"]:
        label += f", forme {FORMS_ROMAN[vb['form']]}"
    pers = [0, 1, 2, 3, 4, 5] if nlv == 0 else list(range(10))
    table_past = " · ".join(f"{PRONOUNS[p]} {vb['past'][p]}" for p in (0, 3, 4, 5, 8))
    table_pres = " · ".join(f"{PRONOUNS[p]} {vb['pres'][p]}" for p in (0, 3, 4, 5, 8))
    chosen = rnd.sample(pers, min(len(pers), 4))
    for k, p in enumerate(chosen):
        for tense, forms, tname in (("past", vb["past"], "au passé"), ("pres", vb["pres"], "au présent")):
            good = forms[p]
            expl = f"{PRONOUNS[p]} {good}.\n{TENSE_EXPL[tense]}\n{table_past if tense == 'past' else table_pres}"
            if k % 2 == 0:
                wrong = pick([f for i, f in enumerate(forms) if i != p] + [x for i, x in enumerate(vb["past" if tense == "pres" else "pres"])], good)
                add(lv, "conjugaison", "verbes", "qcm", f"Conjuguez {label} {tname} avec « {PRONOUNS[p]} » ({PRON_FR[p]}).",
                    good, expl, ar=f"{PRONOUNS[p]} ___", choices=choices(good, wrong), vow=True, say=f"{PRONOUNS[p]} {good}")
            else:
                add(lv, "conjugaison", "verbes", "fill", f"Écrivez le verbe {label} {tname} avec « {PRONOUNS[p]} » ({PRON_FR[p]}).",
                    [good], expl + "\n(Les voyelles sont facultatives dans votre réponse.)", ar=f"{PRONOUNS[p]} ___", kb=True,
                    say=f"{PRONOUNS[p]} {good}", vow=True)
    # futur / négations / subjonctif (A2+)
    if nlv >= 1:
        p = rnd.choice([0, 1, 3, 4, 5])
        good = "سَ" + vb["pres"][p]
        add(lv, "conjugaison", "futur", "qcm", f"Mettez {label} au futur avec « {PRONOUNS[p]} ».", good,
            f"Futur : « سَـ » (ou « سَوْفَ ») + présent : {good}.", ar=f"{PRONOUNS[p]} ___ غَدًا", vow=True,
            choices=choices(good, ["لَمْ " + vb["pres"][p], vb["past"][p], "قَدْ " + vb["past"][p]]), say=good)
    if nlv >= 2 and not vb["weak"]:
        p = rnd.choice([3, 4, 5, 8])
        add(lv, "conjugaison", "négation", "qcm", f"Niez au passé avec « لَمْ » : {PRONOUNS[p]} {vb['past'][p]}", "لَمْ " + vb["jus"][p],
            f"« لَمْ » + présent au jussif (مَجْزُوم) : {vb['jus'][p]}. Le sens est passé.", vow=True,
            choices=choices("لَمْ " + vb["jus"][p], pick(["لَمْ " + vb["past"][p], "لَا " + vb["past"][p], "لَمْ " + vb["sub"][p], "لَمْ " + vb["pres"][p]], "لَمْ " + vb["jus"][p], key=str)))
        add(lv, "conjugaison", "négation", "qcm", f"Niez au futur avec « لَنْ » : {PRONOUNS[p]} سَ{vb['pres'][p]}", "لَنْ " + vb["sub"][p],
            f"« لَنْ » + présent au subjonctif (مَنْصُوب) : {vb['sub'][p]}.", vow=True,
            choices=choices("لَنْ " + vb["sub"][p], pick(["لَنْ " + vb["pres"][p], "لَنْ " + vb["past"][p], "لَنْ سَ" + vb["pres"][p], "لَنْ " + vb["jus"][p]], "لَنْ " + vb["sub"][p], key=str)))
        p = rnd.choice([2, 6, 8])
        add(lv, "conjugaison", "subjonctif", "qcm", f"Complétez avec {label} au subjonctif (après « أَنْ »).", vb["sub"][p],
            f"Après « أَنْ », le verbe est au subjonctif : {vb['pres'][p]} → {vb['sub'][p]} (le ن final tombe).",
            ar=f"{PRONOUNS[p]} يُرِيدُ أَنْ ___".replace("يُرِيدُ", {2: "تُرِيدِينَ", 6: "تُرِيدُونَ", 8: "يُرِيدُونَ"}[p]), vow=True,
            choices=choices(vb["sub"][p], pick([vb["pres"][p], vb["past"][p], vb["jus"][p], "سَ" + vb["pres"][p]], vb["sub"][p], key=str)))
    # impératif
    if nlv >= 1 and vb.get("imp"):
        for i, (pr, fr_) in enumerate((("أَنْتَ", "tu m."), ("أَنْتِ", "tu f."), ("أَنْتُمْ", "vous"))):
            if i == 2 and nlv < 2:
                continue
            good = vb["imp"][i]
            wrong = pick([x for j, x in enumerate(vb["imp"]) if j != i] + [vb["pres"][[1, 2, 6][i]], vb["past"][[1, 2, 6][i]]], good)
            add(lv, "conjugaison", "impératif", "qcm", f"Donnez l'ordre avec {label} ({fr_}).", good,
                f"Impératif : « {good} ». On part du présent ({vb['pres'][[1, 2, 6][i]]}), on retire le préfixe et on met la fin au jussif.",
                ar=f"({pr}) ___ !", vow=True, choices=choices(good, wrong), say=good)
    # masdar
    if nlv >= 2:
        others = [w["masdar"] for w in VERBS if w is not vb]
        add(lv, "conjugaison", "masdar", "qcm", f"Quel est le nom verbal (مَصْدَر) de {label} ?", vb["masdar"],
            f"Le masdar de « {inf} » est « {vb['masdar']} » ({translit(vb['masdar'])}).", vow=True,
            choices=choices(vb["masdar"], pick(others, vb["masdar"])), say=vb["masdar"])
    # forme verbale
    if vb["form"] and nlv >= 2:
        good = FORMS_ROMAN[vb["form"]]
        wrong = rnd.sample([f for f in FORMS_ROMAN.values() if f != good], 3)
        pat = {1: "فَعَلَ", 2: "فَعَّلَ", 3: "فَاعَلَ", 4: "أَفْعَلَ", 5: "تَفَعَّلَ", 6: "تَفَاعَلَ", 7: "اِنْفَعَلَ", 8: "اِفْتَعَلَ", 10: "اِسْتَفْعَلَ"}[vb["form"]]
        add(LEVELS[min(nlv + 1, 6)], "conjugaison", "formes", "qcm", f"À quelle forme verbale appartient « {inf} » ?", good,
            f"« {inf} » suit le schème « {pat} » : forme {good} (racine {' '.join(vb['root'])}).", ar=inf, vow=True,
            choices=choices(good, wrong), ltr=True)
    # participes
    if vb["form"] and nlv >= 3:
        act, pas = vb["part"]
        add(lv, "conjugaison", "participes", "qcm", f"Quel est le participe actif (اِسْم الفَاعِل) de {label} ?", act,
            f"Participe actif de « {inf} » : « {act} »." + (f" Participe passif : « {pas} »." if pas else ""), vow=True,
            choices=choices(act, pick([pas or "", vb["masdar"], vb["pres"][3], vb["past"][3]], act)))
    # passif
    if vb.get("pass") and nlv >= 3 and vb["form"] in (1, 2, 3, 4, 8, 10):
        pp, pr = vb["pass"]
        add(LEVELS[min(nlv + 1, 6)], "conjugaison", "passif", "qcm", f"Quel est le passif au passé de {label} ?", pp,
            f"Passif du passé : « {pp} » (voyelles u – i). Présent passif : « {pr} ».", vow=True,
            choices=choices(pp, pick([vb["past"][3], pr, vb["pres"][3], vb["masdar"]], pp)))
        add(LEVELS[min(nlv + 1, 6)], "conjugaison", "passif", "qcm", f"Quel est le passif au présent de {label} ?", pr,
            f"Passif du présent : « {pr} » (préfixe en u, avant-dernière voyelle a).", vow=True,
            choices=choices(pr, pick([vb["pres"][3], pp, vb["past"][3], vb["masdar"]], pr)))

# ============================================================== grammaire
for ln in lines("grammar.txt"):
    lv, th, sent, good, wrong, fr, expl = ln.split("|")
    wrong = [w for w in wrong.split(";") if w]
    full = sent.replace("___", good.split(" / ")[0].replace("ـ", ""))
    add(lv, "grammaire", th, "qcm", "Choisissez la bonne réponse.", good, expl, ar=sent, fr=fr, vow=True, frq=True,
        choices=choices(good, wrong), say=full if "(" not in full else None)

# ============================================================== phrases
SENT = []
for ln in lines("sentences.txt"):
    lv, ar, fr = ln.split("|")
    SENT.append({"level": lv, "ar": ar, "fr": fr})
for s in SENT:
    lv, ar, fr = s["level"], s["ar"], s["fr"]
    pool = [x for x in SENT if x is not s and abs(LV[x["level"]] - LV[lv]) <= 1]
    w = pick([x["ar"] for x in pool], ar)
    add(lv, "phrases", "traduction", "qcm", f"Quelle phrase arabe veut dire « {fr} » ?", ar, f"« {fr} » = « {ar} »",
        choices=choices(ar, w, {x["ar"]: x["fr"] for x in SENT}), say=ar)
    wf = pick([x["fr"] for x in pool], fr, key=str.lower)
    add(lv, "phrases", "compréhension", "qcm", "Que signifie cette phrase ?", fr, f"« {ar} » ({translit(ar)}) = « {fr} »",
        ar=ar, tr=translit(ar), choices=choices(fr, wf), say=ar, ltr=True)
    words = re.sub(r"[.!؟?،]", "", ar).split()
    if 3 <= len(words) <= 10:
        shuffled = words[:]
        for _ in range(10):
            rnd.shuffle(shuffled)
            if shuffled != words:
                break
        add(lv, "phrases", "ordre", "order", "Remettez les mots dans l'ordre (de droite à gauche).", " ".join(words),
            f"Phrase correcte : « {ar} » ({fr})", fr=fr, words=shuffled, say=ar)
    # écoute
    add(lv, "ecoute", "phrases", "qcm", "🔊 Écoutez la phrase : que signifie-t-elle ?", fr, f"Vous avez entendu : « {ar} » ({fr}).",
        audio=ar, choices=choices(fr, wf), ltr=True)
    if len(words) <= 6:
        add(lv, "ecoute", "dictée", "fill", "🔊 Écoutez et écrivez la phrase (voyelles facultatives).", [ar],
            f"La phrase était : « {ar} » ({fr}).", audio=ar, dict=True, kb=True, say=ar)
    # oral
    add(lv, "oral", "phrases", "speak", "🎤 Lisez cette phrase à voix haute.", ar, f"« {ar} » se prononce : {translit(ar)}.",
        ar=ar, fr=fr, tr=translit(ar), say=ar)

# ============================================================== écoute (mots, nombres, heures, jours, mois)
for v in VOCAB:
    if " " in v["ar"]:
        continue
    lv, ar = v["level"], v["ar"]
    sim = sorted(near_level(v, 1), key=lambda w: -len(set(strip(w["ar"])) & set(strip(ar))))[:8]
    wrong = pick([w["ar"] for w in sim], ar)
    add(lv, "ecoute", "mots", "qcm", "🔊 Écoutez : quel mot entendez-vous ?", ar, f"Le mot entendu est « {ar} » ({v['fr']}).",
        audio=ar, choices=choices(ar, wrong, FR_OF), vow=True)
    if LV[lv] <= 3:
        add(lv, "ecoute", "dictée", "fill", "🔊 Écoutez et écrivez le mot (voyelles facultatives).", [ar],
            f"Le mot était « {strip(ar)} » ({ar}) : {v['fr']}.", audio=ar, dict=True, kb=True, say=ar)
        wf = pick([w["fr"] for w in near_level(v)], v["fr"], key=str.lower)
        add(lv, "ecoute", "sens", "qcm", "🔊 Écoutez : que signifie ce mot ?", v["fr"], f"Le mot entendu est « {ar} » : {v['fr']}.",
            audio=ar, choices=choices(v["fr"], wf), ltr=True)
    if LV[lv] <= 4:
        add(lv, "oral", "mots", "speak", "🎤 Prononcez ce mot.", ar, f"« {ar} » se prononce « {translit(ar)} ».",
            ar=ar, fr=v["fr"], tr=translit(ar), say=ar)

nums = list(range(0, 21)) + [21, 23, 25, 30, 34, 38, 40, 45, 50, 56, 60, 67, 70, 72, 80, 89, 90, 99, 100, 200, 300, 500, 1000, 2000]
for n in nums:
    w = L.number_word(n)
    lv = "A1" if n <= 10 else ("A2" if n <= 100 else "B1")
    near = [x for x in nums if x != n and abs(x - n) <= max(5, n // 3)] or nums
    wrong = pick([str(x) for x in near], str(n), key=str)
    add(lv, "ecoute", "nombres", "qcm", "🔊 Écoutez : quel nombre entendez-vous ?", str(n), f"« {w} » ({translit(w)}) = {n}.",
        audio=w, choices=choices(str(n), wrong), ltr=True)
    add(lv, "ecoute", "nombres", "fill", "🔊 Écoutez et écrivez le nombre en chiffres.", [str(n), L.indic(n)],
        f"« {w} » = {n} ({L.indic(n)}).", audio=w, dict=True, say=w, ltr=True)
    wa = pick([L.number_word(x) for x in near], w)
    add(lv, "vocabulaire", "nombres", "qcm", f"Comment dit-on {n} en arabe ?", w, f"{n} se dit « {w} » ({translit(w)}).",
        choices=choices(w, wa), say=w, vow=True)
for h, hw in enumerate(L.HOURS, 1):
    for part, mm in L.HOUR_PARTS:
        if mm != "00" and h % 3:
            continue
        txt = "السَّاعَةُ " + hw + part
        hh = h - 1 if mm == "45" else h
        hh = 12 if hh == 0 else hh
        good = f"{hh}h{mm}"
        wrong = [f"{(hh % 12) + 1}h{mm}", f"{hh}h{'30' if mm != '30' else '15'}", f"{((hh + 5) % 12) + 1}h{mm}"]
        add("A2", "ecoute", "heures", "qcm", "🔊 Écoutez : quelle heure est-il ?", good,
            f"« {txt} » = {good}." + (" « إِلَّا رُبْعًا » = moins le quart." if mm == "45" else ""),
            audio=txt, choices=choices(good, wrong), ltr=True)
days = [v for v in VOCAB if v["theme"] == "jours"]
for d in days:
    add("A1", "ecoute", "jours", "qcm", "🔊 Écoutez : quel jour entendez-vous ?", d["fr"], f"« {d['ar']} » = {d['fr']}.",
        audio=d["ar"], choices=choices(d["fr"], pick([x["fr"] for x in days], d["fr"], key=str)), ltr=True)
for m, (ma, mf) in enumerate(L.MONTHS):
    add("A2", "vocabulaire", "mois", "qcm", f"Comment dit-on « {mf} » en arabe ?", ma,
        f"« {mf} » se dit « {ma} » (noms utilisés en Égypte et au Maghreb ; au Proche-Orient on dit aussi كَانُون الثَّانِي, شُبَاط…).",
        choices=choices(ma, pick([x[0] for x in L.MONTHS], ma)), say=ma)

# ============================================================== expressions
EXPR = []
for ln in lines("expressions.txt"):
    f = ln.split("|")
    EXPR.append({"level": f[0], "type": f[1], "ar": f[2], "fr": f[3], "ex": f[4], "gap": f[5], "exfr": f[6] if len(f) > 6 else ""})
for e in EXPR:
    pool = [x for x in EXPR if x is not e and abs(LV[x["level"]] - LV[e["level"]]) <= 1]
    wf = pick([x["fr"] for x in pool], e["fr"], key=str.lower)
    add(e["level"], "expressions", e["type"], "qcm", "Que signifie cette expression ?", e["fr"],
        f"« {e['ar']} » ({translit(e['ar'])}) : {e['fr']}.", ar=e["ar"], tr=translit(e["ar"]), choices=choices(e["fr"], wf), say=e["ar"], ltr=True)
    wa = pick([x["ar"] for x in pool], e["ar"])
    add(e["level"], "expressions", e["type"], "qcm", f"Quelle expression veut dire « {e['fr']} » ?", e["ar"],
        f"« {e['fr']} » : « {e['ar']} ».", choices=choices(e["ar"], wa, {x["ar"]: x["fr"] for x in EXPR}), say=e["ar"])
    if e["ex"] != "-" and e["gap"]:
        full = e["ex"].replace("___", e["gap"]).replace("لِـ ", "لِ")
        add(e["level"], "expressions", e["type"], "fill", f"Complétez l'expression « {e['ar']} » ({e['fr']}).", [e["gap"]],
            f"« {full} » — {e['exfr']}", ar=e["ex"], fr=e["exfr"], kb=True, say=full, vow=True)

# ============================================================== communication
COMM = []
for ln in lines("communication.txt"):
    lv, th, prompt, pfr, good, gfr, wrong, expl = ln.split("|")
    COMM.append((lv, th, prompt, pfr, good, gfr, wrong.split(";"), expl))
for lv, th, prompt, pfr, good, gfr, wrong, expl in COMM:
    is_sit = th not in ("dialogues", "débat") or not re.search("[؀-ۿ]", prompt)
    if is_sit:
        add(lv, "communication", th, "qcm", f"Situation : {prompt}\nQue dites-vous ?", good, f"« {good} » ({gfr}). {expl}",
            choices=choices(good, wrong, {good: gfr}), say=good)
    else:
        add(lv, "communication", th, "qcm", "Quelle est la meilleure réponse ?", good, f"« {good} » ({gfr}). {expl}",
            ar="— " + prompt, fr=pfr, audio=prompt, choices=choices(good, wrong, {good: gfr}), say=good)
    words = re.sub(r"[.!؟?،…,]", "", good).split()
    if 3 <= len(words) <= 9 and "/" not in good:
        sh = words[:]
        for _ in range(10):
            rnd.shuffle(sh)
            if sh != words:
                break
        add(lv, "communication", th, "order", "Remettez la réponse dans l'ordre (de droite à gauche).", " ".join(words),
            f"Réponse correcte : « {good} » ({gfr}).", fr=gfr, words=sh, say=good)

# ============================================================== lecture
texts = []
cur = None
for ln in lines("reading.txt"):
    if ln.startswith("==="):
        lv, title = [x.strip() for x in ln[3:].split("|")]
        cur = {"level": lv, "title": title, "text": "", "fr": "", "q": []}
        texts.append(cur)
    elif ln.startswith("~"):
        cur["fr"] = ln[1:].strip()
    elif ln.startswith("?"):
        q, good, wrong, qfr = [x.strip() for x in ln[1:].split("|")]
        cur["q"].append((q, good, [w.strip() for w in wrong.split(";")], qfr))
    else:
        cur["text"] += (" " if cur["text"] else "") + ln
for t in texts:
    lv = t["level"]
    for q, good, wrong, qfr in t["q"]:
        add(lv, "lecture", "questions", "qcm", "Lisez le texte puis répondez à la question.", good,
            f"Réponse : « {good} ». Traduction du texte : {t['fr']}", title=t["title"], text=t["text"], ar=q, fr=qfr,
            choices=choices(good, wrong), tfr=t["fr"])
    sents = [s.strip() for s in re.split(r"(?<=[.!؟])\s+", t["text"]) if s.strip()]
    for s in sents:
        words = re.sub(r"[.!؟?،:«»]", "", s).split()
        if 4 <= len(words) <= 11:
            sh = words[:]
            for _ in range(10):
                rnd.shuffle(sh)
                if sh != words:
                    break
            add(lv, "lecture", "ordre", "order", f"Remettez dans l'ordre une phrase du texte « {t['title']} ».", " ".join(words),
                f"Phrase du texte : « {s} »", words=sh, say=s)
        cand = [w for w in words if len(strip(w)) >= 4 and not strip(w).startswith(("و", "ف"))]
        if cand and len(words) >= 5:
            gapw = rnd.choice(cand)
            gtxt = t["text"].replace(s, s.replace(gapw, "___", 1), 1)
            add(lv, "lecture", "texte à trous", "fill", "Lisez le texte et écrivez le mot qui manque (voyelles facultatives).", [gapw],
                f"La phrase complète est : « {s} »", title=t["title"], text=gtxt, kb=True, tfr=t["fr"])

# ============================================================== images
emo = [v for v in VOCAB if v["emoji"]]
for v in emo:
    pool = [w for w in emo if w is not v and abs(LV[w["level"]] - LV[v["level"]]) <= 1 and w["emoji"] != v["emoji"]]
    wrong = pick([w["ar"] for w in pool], v["ar"])
    add(v["level"], "image", v["theme"], "qcm", "Qu'est-ce que c'est ?", v["ar"], f"L'image montre « {v['ar']} » ({v['fr']}).",
        emoji=v["emoji"], big_emoji=True, choices=choices(v["ar"], wrong, FR_OF), say=v["ar"])
for lv, e, ar, fr in L.IMAGES:
    pool = [x for x in L.IMAGES if x[2] != ar and abs(LV[x[0]] - LV[lv]) <= 1]
    wrong = pick([x[2] for x in pool], ar)
    add(lv, "image", "actions", "qcm", "Que se passe-t-il sur l'image ?", ar, f"« {ar} » ({fr}).", emoji=e, big_emoji=True,
        choices=choices(ar, wrong, {x[2]: x[3] for x in L.IMAGES}), say=ar)

# ============================================================== sortie
CAT_ORDER = ["alphabet", "vocabulaire", "grammaire", "conjugaison", "orthographe", "prononciation", "ecoute", "lecture",
             "expressions", "communication", "phrases", "oral", "image"]
OUT.mkdir(exist_ok=True)
total = 0
summary = {}
for lv in LEVELS:
    exs = bank[lv]
    exs.sort(key=lambda e: CAT_ORDER.index(e["cat"]))
    for i, e in enumerate(exs, 1):
        e["id"] = f"{lv}-{i:05d}"
        e = {k: e[k] for k in ["id"] + [k for k in e if k != "id"]}
    exs = [{**{"id": e["id"]}, **{k: v for k, v in e.items() if k != "id"}} for e in exs]
    (OUT / f"{lv.lower()}.json").write_text(json.dumps(exs, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total += len(exs)
    summary[lv] = {c: sum(1 for e in exs if e["cat"] == c) for c in CAT_ORDER}

writing = []
for i, (lv, form, mn, mx, fr, elems, model) in enumerate(L.WRITING, 1):
    writing.append({"id": f"W{i:02d}", "level": lv, "form": form, "min": mn, "max": mx, "fr": fr,
                    "elements": [{"fr": a, "kw": b} for a, b in elems], "model": model})
(OUT / "writing.json").write_text(json.dumps(writing, ensure_ascii=False, indent=1), encoding="utf-8")
(OUT / "summary.json").write_text(json.dumps({"total": total, "levels": summary}, ensure_ascii=False, indent=1), encoding="utf-8")
print("Total :", total)
for lv in LEVELS:
    print(lv, sum(summary[lv].values()), summary[lv])

alpha = []
for ch, name_ar, name_tr, trl, desc, sun in L.ALPHABET:
    joins = ch not in L.NON_JOINING
    alpha.append({"l": ch, "n": name_ar, "nt": name_tr, "t": trl, "d": desc, "sun": sun, "j": joins})
(OUT / "alphabet.json").write_text(json.dumps(alpha, ensure_ascii=False), encoding="utf-8")
