"""Outils pour l'arabe : voyelles, translittération, conjugaison des verbes réguliers (formes I à X)."""
import re

FATHA, KASRA, DAMMA, SUKUN, SHADDA = "َ", "ِ", "ُ", "ْ", "ّ"
FATHATAN, KASRATAN, DAMMATAN = "ً", "ٍ", "ٌ"
DAGGER = "ٰ"
HARAKAT = re.compile("[ً-ٰٟـ]")
SUN = set("تثدذرزسشصضطظلن")


def strip(s):
    """Retire les voyelles (harakat), la shadda et le tatwil."""
    return HARAKAT.sub("", s)


def fold(s):
    """Forme très tolérante : sans voyelles, alif/hamza unifiés, ى→ي, ة→ه (pour comparer des réponses)."""
    s = strip(s)
    s = re.sub("[أإآٱ]", "ا", s)
    s = s.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


CONS = {"ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "ḥ", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z",
        "س": "s", "ش": "sh", "ص": "ṣ", "ض": "ḍ", "ط": "ṭ", "ظ": "ẓ", "ع": "ʿ", "غ": "gh", "ف": "f", "ق": "q",
        "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "y", "ء": "ʾ", "أ": "ʾ", "إ": "ʾ",
        "ؤ": "ʾ", "ئ": "ʾ"}
VOW = {FATHA: "a", KASRA: "i", DAMMA: "u", FATHATAN: "an", KASRATAN: "in", DAMMATAN: "un"}


SPECIAL = {"الله": "allāh", "لله": "lillāh", "والله": "wallāh", "بالله": "billāh"}


def _word(w):
    sw = strip(w)
    if sw in SPECIAL:
        last = w[-1]
        return SPECIAL[sw] + (VOW.get(last, "") if sw != "لله" else "i")
    out = []
    nodbl = False
    i, n = 0, len(w)
    if w.startswith("ال") and n > 2:
        nxt = w[2] if w[2] != SUKUN else (w[3] if n > 3 else "")
        rest_i = 3 if w[2] == SUKUN else 2
        if nxt in SUN and nxt != "ل" or (nxt == "ل" and SHADDA in w[rest_i:rest_i + 3]):
            out.append("a" + CONS.get(nxt, nxt) + "-")
            nodbl = True
        else:
            out.append("al-")
        i = rest_i
    first = True
    while i < n:
        c = w[i]
        nxt = w[i + 1] if i + 1 < n else ""
        if c in "ـ":
            i += 1
            continue
        if c == "ا":
            if out and out[-1].endswith("an") and not first:     # alif du tanwîn : ـًا
                i += 1
                continue
            if first or i == 0:
                v = VOW.get(nxt, "")
                if v:
                    out.append(v)
                    i += 2
                else:
                    out.append("a" if nxt == "ل" else "i")
                    i += 1
                first = False
                continue
            if nxt == FATHATAN:
                out.append("an")
                i += 2
                continue
            if i == n - 1 and out and out[-1][-1:] in ("w", "ū"):   # alif muet de كَتَبُوا / مَشَوْا
                i += 1
                continue
            if out and out[-1].endswith("a"):
                out[-1] = out[-1][:-1] + "ā"
            elif out and out[-1].endswith("ū"):
                pass
            else:
                out.append("ā")
            i += 1
            continue
        if c == "آ":
            out.append("ā" if first else "ʾā")
            i += 1
            first = False
            continue
        if c == "ى":
            if out and out[-1].endswith("an"):
                i += 1
                continue
            if nxt == FATHATAN:
                out.append("an")
                i += 2
                continue
            if out and out[-1].endswith("a"):
                out[-1] = out[-1][:-1] + "ā"
            else:
                out.append("ā")
            i += 1
            continue
        if c == DAGGER:
            if out and out[-1].endswith("a"):
                out[-1] = out[-1][:-1] + "ā"
            else:
                out.append("ā")
            i += 1
            continue
        if c == "ة":
            v = VOW.get(nxt, "")
            if v and i + 2 < n:
                out.append("t" + v)
            else:
                out.append("a" if not (out and out[-1].endswith("a")) else "")
            i += 2 if v else 1
            continue
        if c in "وي" and nxt not in VOW and nxt != SHADDA:
            long_v = "ū" if c == "و" else "ī"
            short = "u" if c == "و" else "i"
            if out and out[-1].endswith(short) and nxt != SUKUN:
                out[-1] = out[-1][:-1] + long_v
                i += 1
                continue
            if out and out[-1].endswith("a") and nxt in (SUKUN, ""):
                out[-1] += "w" if c == "و" else "y"
                i += 2 if nxt == SUKUN else 1
                continue
        if c in CONS:
            t = CONS[c]
            if first and t == "ʾ":
                t = ""
            j = i + 1
            dbl = False
            vowel = ""
            while j < n and w[j] in (SHADDA, SUKUN, FATHA, KASRA, DAMMA, FATHATAN, KASRATAN, DAMMATAN):
                if w[j] == SHADDA:
                    dbl = True
                elif w[j] in VOW:
                    vowel = VOW[w[j]]
                j += 1
            if c == "إ" and not vowel:
                vowel = "i"
            if c == "أ" and not vowel and first:
                vowel = "a"
            out.append(t * (2 if dbl and t and not nodbl else 1) + vowel)
            nodbl = False
            i = j
            first = False
            continue
        i += 1                                                     # signe inconnu : ignoré
    s = "".join(out)
    return s.replace("--", "-")


def translit(text):
    """Translittération simplifiée (lecture de l'arabe vocalisé). Approximation pédagogique."""
    text = text.replace("،", ",").replace("؟", "?").replace("؛", ";")
    words = re.findall(r"[؀-ۿ]+|[^؀-ۿ]+", text)
    res = []
    for w in words:
        if re.match(r"[؀-ۿ]", w):
            res.append(_word(w))
        else:
            res.append(w.replace("،", ",").replace("؟", "?").replace("؛", ";"))
    return "".join(res).replace("،", ",").replace("؟", "?")


# ---------------------------------------------------------------- conjugaison
PRONOUNS = ["أَنَا", "أَنْتَ", "أَنْتِ", "هُوَ", "هِيَ", "نَحْنُ", "أَنْتُمْ", "أَنْتُنَّ", "هُمْ", "هُنَّ"]
PRON_FR = ["je", "tu (m.)", "tu (f.)", "il", "elle", "nous", "vous (m.)", "vous (f.)", "ils", "elles"]
PAST_SUF = [SUKUN + "تُ", SUKUN + "تَ", SUKUN + "تِ", FATHA, FATHA + "تْ", SUKUN + "نَا", SUKUN + "تُمْ", SUKUN + "تُنَّ",
            DAMMA + "وا", SUKUN + "نَ"]
PRES_PRE = ["أ", "ت", "ت", "ي", "ت", "ن", "ت", "ت", "ي", "ي"]
V = {"a": FATHA, "i": KASRA, "u": DAMMA}
FORMS_ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII", 10: "X"}


def _join(stem_c3, suffix, c3):
    """Assimile c3 + sukûn + même lettre (سَكَنْنَا → سَكَنَّا)."""
    if suffix.startswith(SUKUN) and len(suffix) > 1 and suffix[1] == c3:
        return stem_c3 + SHADDA + suffix[2:]
    return stem_c3 + suffix


def past_stem(r, form, pv="a"):
    c1, c2, c3 = r
    return {
        1: c1 + FATHA + c2 + V[pv] + c3,
        2: c1 + FATHA + c2 + SHADDA + FATHA + c3,
        3: c1 + FATHA + "ا" + c2 + FATHA + c3,
        4: "أَ" + c1 + SUKUN + c2 + FATHA + c3,
        5: "تَ" + c1 + FATHA + c2 + SHADDA + FATHA + c3,
        6: "تَ" + c1 + FATHA + "ا" + c2 + FATHA + c3,
        7: "اِنْ" + c1 + FATHA + c2 + FATHA + c3,
        8: "اِ" + c1 + SUKUN + "تَ" + c2 + FATHA + c3,
        10: "اِسْتَ" + c1 + SUKUN + c2 + FATHA + c3,
    }[form]


def pres_body(r, form, iv="a"):
    """Présent sans le préfixe de personne (mais avec sa voyelle)."""
    c1, c2, c3 = r
    return {
        1: FATHA + c1 + SUKUN + c2 + V[iv] + c3,
        2: DAMMA + c1 + FATHA + c2 + SHADDA + KASRA + c3,
        3: DAMMA + c1 + FATHA + "ا" + c2 + KASRA + c3,
        4: DAMMA + c1 + SUKUN + c2 + KASRA + c3,
        5: FATHA + "تَ" + c1 + FATHA + c2 + SHADDA + FATHA + c3,
        6: FATHA + "تَ" + c1 + FATHA + "ا" + c2 + FATHA + c3,
        7: FATHA + "نْ" + c1 + FATHA + c2 + KASRA + c3,
        8: FATHA + c1 + SUKUN + "تَ" + c2 + KASRA + c3,
        10: FATHA + "سْ" + "تَ" + c1 + SUKUN + c2 + KASRA + c3,
    }[form]


def pres_suffix(p, mood):
    if p == 2:
        return KASRA + ("ينَ" if mood == "ind" else "ي")
    if p in (6, 8):
        return DAMMA + ("ونَ" if mood == "ind" else "وا")
    if p in (7, 9):
        return SUKUN + "نَ"
    return {"ind": DAMMA, "sub": FATHA, "jus": SUKUN}[mood]


def conj_past(r, form, pv="a"):
    st = past_stem(r, form, pv)
    return [_join(st, s, r[2]) for s in PAST_SUF]


def conj_pres(r, form, iv="a", mood="ind"):
    body = pres_body(r, form, iv)
    res = []
    for p in range(10):
        res.append(_join(PRES_PRE[p] + body, pres_suffix(p, mood), r[2]))
    return res


def conj_imp(r, form, iv="a"):
    """Impératif : tu (m.), tu (f.), vous (m.)."""
    c1, c2, c3 = r
    stem = {
        1: ("اُ" if iv == "u" else "اِ") + c1 + SUKUN + c2 + V[iv] + c3,
        2: c1 + FATHA + c2 + SHADDA + KASRA + c3,
        3: c1 + FATHA + "ا" + c2 + KASRA + c3,
        4: "أَ" + c1 + SUKUN + c2 + KASRA + c3,
        5: "تَ" + c1 + FATHA + c2 + SHADDA + FATHA + c3,
        6: "تَ" + c1 + FATHA + "ا" + c2 + FATHA + c3,
        7: "اِنْ" + c1 + FATHA + c2 + KASRA + c3,
        8: "اِ" + c1 + SUKUN + "تَ" + c2 + KASRA + c3,
        10: "اِسْتَ" + c1 + SUKUN + c2 + KASRA + c3,
    }[form]
    return [stem + SUKUN, stem + KASRA + "ي", stem + DAMMA + "وا"]


def passive(r, form):
    """(passé 3e m. sg., présent 3e m. sg.) au passif, ou None."""
    c1, c2, c3 = r
    past = {
        1: c1 + DAMMA + c2 + KASRA + c3 + FATHA,
        2: c1 + DAMMA + c2 + SHADDA + KASRA + c3 + FATHA,
        3: c1 + DAMMA + "و" + c2 + KASRA + c3 + FATHA,
        4: "أُ" + c1 + SUKUN + c2 + KASRA + c3 + FATHA,
        8: "اُ" + c1 + SUKUN + "تُ" + c2 + KASRA + c3 + FATHA,
        10: "اُسْتُ" + c1 + SUKUN + c2 + KASRA + c3 + FATHA,
    }.get(form)
    pres = {
        1: "يُ" + c1 + SUKUN + c2 + FATHA + c3 + DAMMA,
        2: "يُ" + c1 + FATHA + c2 + SHADDA + FATHA + c3 + DAMMA,
        3: "يُ" + c1 + FATHA + "ا" + c2 + FATHA + c3 + DAMMA,
        4: "يُ" + c1 + SUKUN + c2 + FATHA + c3 + DAMMA,
        8: "يُ" + c1 + SUKUN + "تَ" + c2 + FATHA + c3 + DAMMA,
        10: "يُسْ" + "تَ" + c1 + SUKUN + c2 + FATHA + c3 + DAMMA,
    }.get(form)
    return (past, pres) if past else None


def participles(r, form, iv="a"):
    """(participe actif, participe passif) au masculin, forme de pause."""
    c1, c2, c3 = r
    act = {1: c1 + FATHA + "ا" + c2 + KASRA + c3,
           2: "مُ" + c1 + FATHA + c2 + SHADDA + KASRA + c3,
           3: "مُ" + c1 + FATHA + "ا" + c2 + KASRA + c3,
           4: "مُ" + c1 + SUKUN + c2 + KASRA + c3,
           5: "مُتَ" + c1 + FATHA + c2 + SHADDA + KASRA + c3,
           6: "مُتَ" + c1 + FATHA + "ا" + c2 + KASRA + c3,
           7: "مُنْ" + c1 + FATHA + c2 + KASRA + c3,
           8: "مُ" + c1 + SUKUN + "تَ" + c2 + KASRA + c3,
           10: "مُسْتَ" + c1 + SUKUN + c2 + KASRA + c3}[form]
    pas = {1: "مَ" + c1 + SUKUN + c2 + DAMMA + "و" + c3,
           2: "مُ" + c1 + FATHA + c2 + SHADDA + FATHA + c3,
           3: "مُ" + c1 + FATHA + "ا" + c2 + FATHA + c3,
           4: "مُ" + c1 + SUKUN + c2 + FATHA + c3,
           8: "مُ" + c1 + SUKUN + "تَ" + c2 + FATHA + c3,
           10: "مُسْتَ" + c1 + SUKUN + c2 + FATHA + c3}.get(form)
    return act, pas


if __name__ == "__main__":
    for w in ["كِتَاب", "الشَّمْس", "القَمَر", "مَدْرَسَة", "كَتَبُوا", "اِبْن", "أَب", "مُسْتَشْفَى", "هٰذَا", "سَيَّارَة",
              "كُرْسِيّ", "يَوْم", "غَدًا", "قُرًى", "الاِثْنَيْن", "مَاء", "سُؤَال", "شَيْءٍ", "عِشْرُونَ"]:
        print(w, translit(w))
    print(conj_past("كتب", 1, "a"))
    print(conj_pres("كتب", 1, "u"))
    print(conj_pres("سكن", 1, "u"))
    print(conj_past("سكن", 1, "a"))
    print(conj_past("علم", 5), conj_pres("علم", 2), conj_imp("رسل", 4), conj_imp("جمع", 8), passive("عمل", 10))
