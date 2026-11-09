/* Exercice d'Arabe pour Français — application web (PWA), sans dépendance.
   Données : data/<niveau>.json (banque générée par tools/build_bank.py). Progression : localStorage du navigateur. */
"use strict";

const VERSION = "1.0.0";
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Expert"];
const CATS = {
  alphabet: ["🔤", "Alphabet"], vocabulaire: ["📚", "Vocabulaire"], grammaire: ["🧩", "Grammaire"], conjugaison: ["⏳", "Conjugaison"],
  orthographe: ["✍️", "Orthographe"], prononciation: ["🗣️", "Prononciation"], ecoute: ["🎧", "Écoute et dictée"],
  lecture: ["📖", "Lecture"], expressions: ["💬", "Expressions"], communication: ["🤝", "Communication"],
  phrases: ["🔤", "Phrases"], oral: ["🎤", "Oral au micro"], image: ["🖼️", "Trouver l'image"], perso: ["⭐", "Mes exercices"],
};
CATS.phrases[0] = "🧱";
const SRS_DAYS = [0, 1, 3, 7, 14, 30, 60];
const EXAM_SECTIONS = [
  ["co", "Compréhension de l'oral", ["ecoute", "prononciation"], 90],
  ["ce", "Compréhension des écrits", ["lecture"], 90],
  ["ml", "Maîtrise de la langue", ["grammaire", "vocabulaire", "conjugaison", "orthographe", "expressions"], 45],
  ["eo", "Expression orale", ["oral"], 60],
];
const WRITING_MIN = { A1: 10, A2: 15, B1: 25, B2: 35, C1: 40, C2: 45, Expert: 45 };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isAr = s => /[؀-ۿ]/.test(s || "");
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const now = () => Date.now();
const DAY = 86400000;

/* ================================================================ texte arabe */
const HAR = /[ً-ٰٟـ]/g;
const strip = s => String(s || "").replace(HAR, "");
const norm = s => strip(s).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[.,!?؟،؛:;«»"'()…\-—–_/]/g, " ")
  .replace(/\s+/g, " ").trim().toLowerCase();
const fold = s => norm(s).replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ء/g, "");
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
const similarity = (a, b) => { a = fold(a).replace(/ /g, ""); b = fold(b).replace(/ /g, ""); const L = Math.max(a.length, b.length); return L ? 1 - lev(a, b) / L : 0; };

/* ================================================================ stockage */
const KEY = "exercice-arabe-v1";
let DB = { profiles: {}, current: null, custom: [] };
function load() { try { const d = JSON.parse(localStorage.getItem(KEY) || "null"); if (d && d.profiles) DB = Object.assign(DB, d); } catch (e) { /* stockage indisponible */ } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast("Impossible d'enregistrer la progression (stockage plein ou bloqué)."); } }
const DEFAULT_SET = { level: "A1", cats: [], size: 10, showFr: true, harakat: true, translit: true, sfx: true, rate: 0.85, voice: "", autoplay: true, kb: true, oral: true, theme: "" };
function newProfile(name) {
  const id = "p" + now().toString(36);
  DB.profiles[id] = { id, name, created: now(), set: { ...DEFAULT_SET }, res: {}, srs: {}, sessions: [], stats: {}, placement: null, exams: [], writings: [] };
  DB.current = id; save(); return DB.profiles[id];
}
const P = () => DB.profiles[DB.current];
const S = () => Object.assign({ ...DEFAULT_SET }, P().set);

/* ================================================================ banque */
const BANK = {}; let SUMMARY = null, ALPHA = null, WRITING = null;
async function getJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(u); return r.json(); }
async function loadLevel(lv) { if (!BANK[lv]) BANK[lv] = await getJSON(`data/${lv.toLowerCase()}.json`); return BANK[lv]; }
async function loadAll() { await Promise.all(LEVELS.map(loadLevel)); return LEVELS.flatMap(l => BANK[l]).concat(customExercises()); }
function customExercises() { return (DB.custom || []).map(e => ({ ...e, cat: "perso" })); }
async function byId() { const all = await loadAll(); const m = {}; all.forEach(e => (m[e.id] = e)); return m; }

/* ================================================================ sons et voix */
let actx = null;
function beep(ok) {
  if (!S().sfx) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = ok ? [660, 880] : [300, 220];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(); o.type = "sine"; o.frequency.value = f;
      const t = actx.currentTime + i * 0.12; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.2);
    });
  } catch (e) { /* pas de son */ }
}
let VOICES = [];
function refreshVoices() { try { VOICES = speechSynthesis.getVoices().filter(v => /^ar/i.test(v.lang)); } catch (e) { VOICES = []; } }
if ("speechSynthesis" in window) { refreshVoices(); speechSynthesis.onvoiceschanged = refreshVoices; }
function pickVoice() { const want = S().voice; return VOICES.find(v => v.voiceURI === want) || VOICES.find(v => /ar-SA/i.test(v.lang)) || VOICES[0] || null; }
function speak(text, slow) {
  if (!text || !("speechSynthesis" in window)) { toast("La lecture à voix haute n'est pas disponible sur ce navigateur."); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/___/g, "…"));
    const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "ar-SA";
    u.rate = slow ? 0.55 : S().rate;
    speechSynthesis.speak(u);
    if (!VOICES.length) refreshVoices();
  } catch (e) { /* ignore */ }
}
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

/* ================================================================ utilitaires d'affichage */
function toast(msg, ms = 2600) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms); }
function arText(s, ex) { // voyelles selon l'option, sauf exercices où elles sont imposées
  if (!isAr(s)) return esc(s);
  if (ex && ex.nov) return esc(strip(s));
  if (ex && ex.vow) return esc(s);
  return esc(S().harakat ? s : strip(s));
}
function wrapAr(s, ex, cls = "") { return isAr(s) ? `<span class="ar ${cls}" lang="ar">${arText(s, ex)}</span>` : esc(s); }
function explainHTML(s) { return esc(s).replace(/([؀-ۿ][؀-ۿً-ٰٟ\s،؛؟ـ.!]*[؀-ۿً-ٰٟ]|[؀-ۿ])/g, m => `<span class="ar" lang="ar">${S().harakat ? m : strip(m)}</span>`); }
function header(title, sub, back = true, right = "") {
  return `<header class="top">${back ? `<button class="icon-btn" data-go="home" aria-label="Retour à l'accueil">←</button>` : ""}
  <div class="brand">${back ? "" : `<div class="mark" aria-hidden="true">ع</div>`}<div><h1>${esc(title)}</h1>${sub ? `<small>${esc(sub)}</small>` : ""}</div></div>${right}</header>`;
}
function fmtDate(t) { return new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
function fmtDur(s) { s = Math.round(s); const m = Math.floor(s / 60); return m ? `${m} min ${String(s % 60).padStart(2, "0")}` : `${s} s`; }
function applyTheme() { const t = DB.current ? S().theme : ""; if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
function bindGo(root = app) {
  $$("[data-go]", root).forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
}
function go(view, arg) {
  if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) { }
  stopTimer();
  const views = { home, profiles, options, history, alphabet, editor, writingPick, certificate };
  (views[view] || home)(arg);
  window.scrollTo(0, 0);
}

/* ================================================================ profils */
function profiles(first) {
  const list = Object.values(DB.profiles);
  app.innerHTML = `${header("Exercice d'Arabe", "pour francophones · A1 → Expert", !first && !!DB.current)}
  ${first ? `<p class="ar prompt text" lang="ar">أَهْلًا وَسَهْلًا</p><p class="muted" style="text-align:center">Bienvenue ! Créez votre profil pour garder votre progression sur cet appareil.</p>` : "<h2>Profils</h2>"}
  <div class="list">${list.map(p => `<div class="item"><div class="row" style="justify-content:space-between">
    <button class="btn ghost" data-pick="${p.id}" style="flex:1;justify-content:flex-start">👤 ${esc(p.name)}${p.id === DB.current ? " ✓" : ""}</button>
    <button class="icon-btn" data-del="${p.id}" aria-label="Supprimer le profil ${esc(p.name)}">🗑️</button></div>
    <div class="confirm small" data-confirm="${p.id}" hidden>Supprimer « ${esc(p.name)} » et toute sa progression ?
      <button class="mini" data-yes="${p.id}">Oui, supprimer</button> <button class="mini" data-no>Annuler</button></div></div>`).join("")}</div>
  <form id="newp" class="field" style="margin-top:16px"><label for="pname">Nouveau profil</label>
    <div class="row"><input id="pname" maxlength="30" placeholder="Votre prénom" required style="flex:1;min-width:0">
    <button class="btn primary" type="submit">Créer</button></div></form>
  <p class="small muted">Les profils et la progression restent dans ce navigateur. Pour changer d'appareil, utilisez « Sauvegarder ma progression » dans les options.</p>`;
  bindGo();
  $$("[data-pick]").forEach(b => b.onclick = () => { DB.current = b.dataset.pick; save(); applyTheme(); go("home"); });
  $$("[data-del]").forEach(b => b.onclick = () => { $(`[data-confirm="${b.dataset.del}"]`).hidden = false; });
  $$("[data-no]").forEach(b => b.onclick = () => (b.parentElement.hidden = true));
  $$("[data-yes]").forEach(b => b.onclick = () => {
    delete DB.profiles[b.dataset.yes]; if (DB.current === b.dataset.yes) DB.current = Object.keys(DB.profiles)[0] || null; save();
    DB.current ? profiles() : profiles(true);
  });
  $("#newp").onsubmit = e => { e.preventDefault(); const n = $("#pname").value.trim(); if (!n) return; newProfile(n); applyTheme(); home(true); };
}

/* ================================================================ accueil */
function dueIds() { const p = P(), t = now(); return Object.keys(p.srs).filter(id => p.srs[id].d <= t); }
function levelProgress(lv) {
  const tot = SUMMARY ? Object.values(SUMMARY.levels[lv]).reduce((a, b) => a + b, 0) : 0;
  const ok = Object.entries(P().res).filter(([id, v]) => v === 1 && id.startsWith(lv + "-")).length;
  return { tot, ok, pct: tot ? Math.round(100 * ok / tot) : 0 };
}
function catCount(lv, c) { if (c === "perso") return (DB.custom || []).filter(e => e.level === lv).length; return SUMMARY ? (SUMMARY.levels[lv][c] || 0) : 0; }

function home(justCreated) {
  const p = P(), s = S();
  const lv = s.level;
  const avail = Object.keys(CATS).filter(c => catCount(lv, c) > 0 && (c !== "oral" || s.oral));
  const sel = s.cats.filter(c => avail.includes(c));
  const due = dueIds().length;
  const n = sel.length ? sel.reduce((a, c) => a + catCount(lv, c), 0) : avail.reduce((a, c) => a + catCount(lv, c), 0);
  app.innerHTML = `${header("Exercice d'Arabe", "👤 " + p.name, false,
    `<button class="icon-btn" data-go="profiles" aria-label="Changer de profil">👤</button><button class="icon-btn" data-go="options" aria-label="Options">⚙️</button>`)}
  ${justCreated === true ? `<div class="note">Profil créé. Vous ne savez pas par quel niveau commencer ? Faites le <b>test de niveau</b> (18 questions, 5 minutes).</div>` : ""}
  <h3>Niveau</h3>
  <div class="levels">${LEVELS.map(l => { const g = levelProgress(l); return `<button class="lvl" data-lvl="${l}" aria-pressed="${l === lv}">
    <b>${l}</b><span>${g.tot} exercices</span><div class="bar"><i style="width:${g.pct}%"></i></div><span>${g.pct} % réussi</span></button>`; }).join("")}</div>
  <h3>Catégories <span class="small" style="text-transform:none;letter-spacing:0;font-weight:400">— aucune choisie = toutes, en alternance</span></h3>
  <div class="chips">${Object.keys(CATS).filter(c => catCount(lv, c) > 0).map(c => `<button class="chip" data-cat="${c}" aria-pressed="${sel.includes(c)}" ${c === "oral" && !s.oral ? "disabled" : ""}>
    ${CATS[c][0]} ${CATS[c][1]} <span class="n">${catCount(lv, c)}</span></button>`).join("")}</div>
  <h3>Questions par série</h3>
  <div class="seg" role="group" aria-label="Nombre de questions">${[5, 10, 20, 30].map(k => `<button data-size="${k}" aria-pressed="${s.size === k}">${k}</button>`).join("")}</div>
  <div class="actions">
    <button class="btn primary wide" id="start">▶ Commencer · ${lv}<span class="small" style="font-weight:400">(${n} exercices)</span></button>
    <button class="tile" id="review"><b>🔁 Réviser</b><span>${due ? `<span class="due">${due} à revoir aujourd'hui</span>` : "Erreurs et révisions espacées"}</span></button>
    <button class="tile" id="placement"><b>🎯 Test de niveau</b><span>${p.placement ? "Dernier résultat : " + p.placement.level : "18 questions, A1 → C2"}</span></button>
    <button class="tile" id="exam"><b>📝 Examen blanc</b><span>4 épreuves chronométrées · ${lv}</span></button>
    <button class="tile" data-go="writingPick"><b>✒️ Expression écrite</b><span>Sujets avec modèle de réponse</span></button>
    <button class="tile" data-go="alphabet"><b>🔤 L'alphabet</b><span class="ar" lang="ar">أ ب ت ث ج ح خ</span></button>
    <button class="tile" data-go="history"><b>📊 Historique</b><span>${p.sessions.length} séries · graphiques</span></button>
    <button class="tile" data-go="editor"><b>⭐ Mes exercices</b><span>${(DB.custom || []).length} exercice(s) ajouté(s)</span></button>
    <button class="tile" data-go="certificate"><b>🏅 Attestation</b><span>Résumé de votre progression</span></button>
  </div>
  <p class="small muted" style="margin-top:22px">Arabe littéraire (fuṣḥā) avec voyelles · ${SUMMARY ? SUMMARY.total.toLocaleString("fr-FR") : ""} exercices · fonctionne hors ligne une fois ouvert. v${VERSION}</p>`;
  bindGo();
  $$("[data-lvl]").forEach(b => b.onclick = () => { p.set.level = b.dataset.lvl; save(); home(); });
  $$("[data-cat]").forEach(b => b.onclick = () => {
    const c = b.dataset.cat; const cs = new Set(p.set.cats || []); cs.has(c) ? cs.delete(c) : cs.add(c); p.set.cats = [...cs]; save(); home();
  });
  $$("[data-size]").forEach(b => b.onclick = () => { p.set.size = +b.dataset.size; save(); home(); });
  $("#start").onclick = () => startSession({ level: lv, cats: sel });
  $("#review").onclick = () => startSession({ review: true });
  $("#placement").onclick = startPlacement;
  $("#exam").onclick = () => startExam(lv);
}

/* ================================================================ séries */
let SESS = null;
async function startSession({ level, cats, review }) {
  app.innerHTML = `<p class="loading">Préparation de la série…</p>`;
  const s = S(), p = P();
  const size = s.size;
  let chosen = [];
  if (review) {
    const all = await byId();
    const due = new Set(dueIds());
    let pool = Object.keys(p.res).filter(id => all[id] && (due.has(id) || p.res[id] === 0)).map(id => all[id]);
    if (!s.oral) pool = pool.filter(e => e.type !== "speak");
    shuffle(pool); pool.sort((a, b) => due.has(b.id) - due.has(a.id));
    chosen = pool.slice(0, size);
    if (!chosen.length) { toast("Rien à réviser pour l'instant : faites quelques séries d'abord !"); return home(); }
  } else {
    let pool = (await loadLevel(level)).concat(customExercises().filter(e => e.level === level));
    if (!s.oral) pool = pool.filter(e => e.type !== "speak");
    if (cats && cats.length) pool = pool.filter(e => cats.includes(e.cat));
    const due = new Set(dueIds());
    const groups = {};
    pool.forEach(e => (groups[e.cat] = groups[e.cat] || []).push(e));
    const queues = Object.values(groups).map(g => {
      const late = shuffle(g.filter(e => due.has(e.id))), rest = g.filter(e => !due.has(e.id));
      const fresh = shuffle(rest.filter(e => !(e.id in p.res))), failed = shuffle(rest.filter(e => p.res[e.id] === 0)), done = shuffle(rest.filter(e => p.res[e.id] === 1));
      return late.slice(0, 3).concat(failed.slice(0, 2), fresh, failed.slice(2), late.slice(3), done);
    });
    while (chosen.length < size && queues.some(q => q.length)) {
      shuffle(queues).forEach(q => { if (q.length && chosen.length < size) chosen.push(q.shift()); });
    }
    shuffle(chosen);
  }
  SESS = { mode: review ? "review" : "serie", level: review ? "Révision" : level, ex: chosen, i: 0, ok: 0, t0: now(), log: [], cats };
  showExercise();
}

async function startPlacement() {
  app.innerHTML = `<p class="loading">Préparation du test…</p>`;
  const okCats = ["grammaire", "vocabulaire", "conjugaison", "expressions", "orthographe", "lecture"];
  const picked = [];
  for (const lv of LEVELS.slice(0, 6)) {
    const pool = (await loadLevel(lv)).filter(e => ["qcm", "fill"].includes(e.type) && okCats.includes(e.cat) && !e.audio && !e.dict);
    const by = {}; pool.forEach(e => (by[e.cat] = by[e.cat] || []).push(e));
    const cs = shuffle(Object.keys(by));
    for (let i = 0; i < 3 && cs.length; i++) { const g = by[cs[i % cs.length]]; picked.push(g.splice(Math.floor(Math.random() * g.length), 1)[0]); }
  }
  SESS = { mode: "placement", level: "Test", ex: picked, i: 0, ok: 0, t0: now(), log: [] };
  showExercise();
}

async function startExam(level) {
  app.innerHTML = `<p class="loading">Préparation de l'examen…</p>`;
  const s = S(), p = P();
  const pool0 = await loadLevel(level);
  const picked = [], sec = []; let limit = 0;
  const canOral = !!SR && s.oral;
  for (const [key, , cats, spq] of EXAM_SECTIONS) {
    if (key === "eo" && !canOral) continue;
    let pool = pool0.filter(e => cats.includes(e.cat) && (key === "eo" ? e.type === "speak" : ["qcm", "fill"].includes(e.type)));
    if (key === "co") pool = pool.filter(e => e.audio);
    if (key === "ce" || key === "ml") pool = pool.filter(e => !e.audio && !e.dict);
    shuffle(pool); pool.sort((a, b) => (a.id in p.res) - (b.id in p.res));
    let chosen = [];
    if (key === "ml") {
      const g = {}; pool.forEach(e => (g[e.cat] = g[e.cat] || []).push(e));
      while (chosen.length < 10 && Object.values(g).some(x => x.length)) Object.values(g).forEach(x => { if (x.length && chosen.length < 10) chosen.push(x.shift()); });
    } else chosen = pool.slice(0, 10);
    chosen.forEach(e => { picked.push(e); sec.push(key); });
    limit += spq * chosen.length;
  }
  if (!picked.length) { toast("Pas assez d'exercices pour un examen à ce niveau."); return home(); }
  SESS = { mode: "exam", level, ex: picked, sec, i: 0, ok: 0, t0: now(), log: [], limit, end: now() + limit * 1000 };
  app.innerHTML = `${header("Examen blanc · " + level, "Simulation non officielle")}
  <p>Épreuves : ${[...new Set(sec)].map(k => EXAM_SECTIONS.find(x => x[0] === k)[1]).join(" · ")}.</p>
  <p>${picked.length} questions · durée totale <b>${fmtDur(limit)}</b>. La correction s'affiche à la fin. Réussite : 50/100 au total et au moins 20 % à chaque épreuve.</p>
  ${canOral ? "" : `<div class="note">L'épreuve orale est omise : la reconnaissance vocale n'est pas disponible ici (essayez Chrome sur Android, ou Safari récent sur iPhone).</div>`}
  <button class="btn primary block" id="go">Commencer l'examen</button>`;
  bindGo();
  $("#go").onclick = () => { SESS.t0 = now(); SESS.end = now() + limit * 1000; showExercise(); };
}

let TIMER = null;
function stopTimer() { clearInterval(TIMER); TIMER = null; }
function tickTimer() {
  const el = $("#timer"); if (!el || !SESS || SESS.mode !== "exam") return;
  const left = Math.max(0, Math.round((SESS.end - now()) / 1000));
  el.textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  if (!left) { stopTimer(); toast("Temps écoulé !"); finish(true); }
}

/* ================================================================ affichage d'un exercice */
let CUR = null; // état de l'exercice affiché
function showExercise() {
  const ex = SESS.ex[SESS.i], s = S();
  const exam = SESS.mode === "exam";
  CUR = { ex, answered: false, t: now(), order: [], heard: "" };
  const tagCat = CATS[ex.cat] || ["", ex.cat];
  const showTr = s.translit && ex.tr && !exam;
  const showFr = ex.fr && (ex.frq || s.showFr || ex.type === "speak");
  let body = "";
  if (ex.text) body += `<div class="reading">${ex.title ? `<h4 lang="ar">${arText(ex.title, ex)}</h4>` : ""}<div class="ar" lang="ar">${arText(ex.text, ex)}</div>
    ${ex.tfr && !exam && s.showFr ? `<details><summary>Traduction du texte</summary>${esc(ex.tfr)}</details>` : ""}</div>`;
  body += `<div class="tag">${tagCat[0]} ${esc(tagCat[1])} · ${esc(ex.level)}</div><p class="ins">${esc(ex.ins)}</p>`;
  if (ex.emoji && (ex.big_emoji || ex.cat === "image")) body += `<div class="emoji" aria-hidden="true">${ex.emoji}</div>`;
  if (ex.ar) body += `<p class="prompt ${ex.big ? "big" : ""} ${ex.ar.length > 40 ? "text" : ""} ${isAr(ex.ar) ? "ar" : ""}" lang="${isAr(ex.ar) ? "ar" : "fr"}">${arText(ex.ar, ex)}</p>`;
  if (showTr) body += `<p class="tr">${esc(ex.tr)}</p>`;
  if (showFr) body += `<p class="fr">${esc(ex.fr)}</p>`;
  if (ex.audio) body += `<div class="listen"><button class="btn primary" id="play">🔊 Écouter</button><button class="btn ghost" id="slow">🐢 Lentement</button></div>`;
  else if (ex.ar && isAr(ex.ar) && !ex.ar.includes("___") && ex.type !== "speak" && !exam && !/prononce|lettre|syllabe/i.test(ex.ins))
    body += `<div class="listen"><button class="btn ghost" id="play">🔊 Écouter</button></div>`;

  if (ex.type === "qcm") {
    const two = ex.choices.length === 2 || (ex.choices.every(c => c.t.length <= 3) && ex.choices.length === 4);
    body += `<div class="choices ${two ? "two" : ""}">${ex.choices.map((c, i) => `<button class="choice ${isAr(c.t) ? "ar" : ""}" data-i="${i}" ${isAr(c.t) ? 'lang="ar"' : ""}>
      ${arText(c.t, ex)}<small hidden>${esc(c.fr || "")}</small></button>`).join("")}</div>`;
  } else if (ex.type === "fill") {
    const arIn = (Array.isArray(ex.answer) ? ex.answer : [ex.answer]).some(isAr);
    const useKb = arIn && s.kb;
    body += `<input id="ans" class="answer-in ${arIn ? "ar-in" : ""}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
      ${arIn ? 'lang="ar" dir="rtl"' : 'inputmode="numeric"'} ${useKb ? 'inputmode="none"' : ""} aria-label="Votre réponse" placeholder="${arIn ? "اُكْتُبْ هُنَا" : "Votre réponse"}">
      ${arIn ? `<div class="under"><button class="linkish" id="kbtoggle">${useKb ? "⌨️ Utiliser le clavier du téléphone" : "⌨️ Utiliser le clavier arabe intégré"}</button>
      <span class="small muted">Voyelles facultatives</span></div>${useKb ? keyboardHTML() : ""}` : ""}`;
  } else if (ex.type === "order") {
    body += `<div class="order-line" id="line" aria-label="Votre phrase"></div><div class="order-pool" id="pool">${ex.words.map((w, i) => `<button class="word" data-w="${i}" lang="ar">${arText(w, ex)}</button>`).join("")}</div>
      <div class="under"><button class="linkish" id="reset">↺ Recommencer</button></div>`;
  } else if (ex.type === "speak") {
    body += `<div class="listen"><button class="btn ghost" id="model">🔊 Modèle</button><button class="btn ghost" id="modelslow">🐢 Lentement</button></div>`;
    if (SR) body += `<button class="mic" id="mic" aria-label="Parler">🎤</button><p class="heard ar" id="heard" lang="ar"></p><p class="small muted" style="text-align:center">Touchez le micro, puis lisez à voix haute.</p>`;
    else body += `<div class="note">La reconnaissance vocale n'est pas disponible dans ce navigateur. Écoutez le modèle, répétez à voix haute, puis évaluez-vous.</div>
      <div class="actions"><button class="btn ghost" id="selfko">À retravailler</button><button class="btn primary" id="selfok">Je l'ai bien dit</button></div>`;
  }
  const needCheck = ex.type === "fill" || ex.type === "order";
  app.innerHTML = `<header class="top"><button class="icon-btn" id="quit" aria-label="Quitter la série">✕</button>
    <div class="progress"><i style="width:${100 * SESS.i / SESS.ex.length}%"></i></div>
    <span class="counter">${SESS.i + 1} / ${SESS.ex.length}</span>${exam ? `<span class="timer" id="timer"></span>` : ""}</header>
    <main>${body}<div id="fb"></div></main>
    <div class="sticky-foot"><button class="btn primary block" id="next" ${needCheck ? "" : "hidden"}>${needCheck ? "Vérifier" : "Suivant"}</button>
    ${ex.type === "speak" && !exam ? `<button class="linkish" id="skip" style="display:block;margin:6px auto 0">Passer (je ne peux pas parler maintenant)</button>` : ""}</div>
    <div id="quitbox" class="note" hidden>Quitter la série ? Les réponses déjà données sont enregistrées.
      <button class="mini" id="quityes">Quitter</button> <button class="mini" id="quitno">Continuer</button></div>`;
  $("#quit").onclick = () => { $("#quitbox").hidden = false; $("#quitbox").scrollIntoView({ behavior: "smooth" }); };
  $("#quitno").onclick = () => ($("#quitbox").hidden = true);
  $("#quityes").onclick = () => { stopTimer(); if (SESS.log.length && SESS.mode !== "exam") finish(); else go("home"); };
  if (exam) { tickTimer(); stopTimer(); TIMER = setInterval(tickTimer, 1000); }

  const audioText = ex.audio || (ex.type === "order" ? ex.answer : ex.ar);
  if ($("#play")) $("#play").onclick = () => speak(audioText);
  if ($("#slow")) $("#slow").onclick = () => speak(audioText, true);
  if (ex.audio && s.autoplay) setTimeout(() => speak(ex.audio), 250);

  if (ex.type === "qcm") $$(".choice").forEach(b => b.onclick = () => { if (!CUR.answered) answer(ex.choices[+b.dataset.i].t, b); });
  if (ex.type === "fill") {
    const inp = $("#ans");
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#next").click(); } });
    if (!(s.kb && inp.classList.contains("ar-in"))) setTimeout(() => inp.focus({ preventScroll: true }), 50);
    bindKeyboard(inp);
    if ($("#kbtoggle")) $("#kbtoggle").onclick = () => { P().set.kb = !s.kb; save(); const v = inp.value; showExercise(); $("#ans").value = v; };
  }
  if (ex.type === "order") {
    const draw = () => {
      $("#line").innerHTML = CUR.order.map((i, k) => `<button class="word" data-k="${k}" lang="ar">${arText(ex.words[i], ex)}</button>`).join("");
      $$("#pool .word").forEach(b => (b.hidden = CUR.order.includes(+b.dataset.w)));
      $$("#line .word").forEach(b => b.onclick = () => { if (!CUR.answered) { CUR.order.splice(+b.dataset.k, 1); draw(); } });
    };
    $$("#pool .word").forEach(b => b.onclick = () => { if (!CUR.answered) { CUR.order.push(+b.dataset.w); draw(); } });
    $("#reset").onclick = () => { if (!CUR.answered) { CUR.order = []; draw(); } };
  }
  if (ex.type === "speak") {
    $("#model").onclick = () => speak(ex.say || ex.answer);
    $("#modelslow").onclick = () => speak(ex.say || ex.answer, true);
    if ($("#mic")) $("#mic").onclick = () => listen(ex);
    if ($("#selfok")) $("#selfok").onclick = () => answer("(auto-évaluation)", null, true);
    if ($("#selfko")) $("#selfko").onclick = () => answer("(auto-évaluation)", null, false);
    if ($("#skip")) $("#skip").onclick = () => { SESS.ex.splice(SESS.i, 1); if (SESS.i >= SESS.ex.length) finish(); else showExercise(); };
  }
  $("#next").onclick = () => {
    if (!CUR.answered) {
      if (ex.type === "fill") { const v = $("#ans").value; if (!v.trim()) return toast("Écrivez une réponse."); answer(v); }
      else if (ex.type === "order") { if (!CUR.order.length) return toast("Touchez les mots dans l'ordre."); answer(CUR.order.map(i => ex.words[i]).join(" ")); }
      return;
    }
    next();
  };
}

/* ---------------- clavier arabe */
const KB_ROWS = [["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج"], ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"],
  ["ذ", "ئ", "ء", "ؤ", "ر", "ى", "ة", "و", "ز", "ظ", "د"], ["أ", "إ", "آ", "ـَ", "ـِ", "ـُ", "ـْ", "ـّ", "ـً"]];
function keyboardHTML() {
  return `<div class="kbd" id="kbd" role="group" aria-label="Clavier arabe">${KB_ROWS.map(r => `<div class="kr">${r.map(k => `<button type="button" class="${k.startsWith("ـ") ? "h" : ""}" data-k="${k.replace("ـ", "")}">${k}</button>`).join("")}</div>`).join("")}
  <div class="kr"><button type="button" class="w" data-k="⌫" aria-label="Effacer">⌫</button><button type="button" class="w" data-k=" " style="flex:5 1 0">espace</button><button type="button" class="w" data-k="⏎" aria-label="Valider">✓</button></div></div>`;
}
function bindKeyboard(inp) {
  const kb = $("#kbd"); if (!kb) return;
  kb.addEventListener("pointerdown", e => e.preventDefault());
  $$("button", kb).forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.k;
    let st = inp.selectionStart ?? inp.value.length, en = inp.selectionEnd ?? inp.value.length;
    if (document.activeElement !== inp) { st = en = inp.value.length; }
    if (k === "⏎") return $("#next").click();
    if (k === "⌫") { if (st === en && st > 0) st--; inp.value = inp.value.slice(0, st) + inp.value.slice(en); inp.setSelectionRange(st, st); return; }
    inp.value = inp.value.slice(0, st) + k + inp.value.slice(en); inp.setSelectionRange(st + k.length, st + k.length);
  }));
}

/* ---------------- micro */
let REC = null;
function listen(ex) {
  const mic = $("#mic");
  if (REC) { try { REC.stop(); } catch (e) { } return; }
  try {
    REC = new SR(); REC.lang = "ar-SA"; REC.interimResults = false; REC.maxAlternatives = 5;
    mic.classList.add("on"); $("#heard").textContent = "…";
    REC.onresult = e => {
      const alts = [...e.results[0]].map(a => a.transcript);
      let best = alts[0], sc = 0;
      alts.forEach(a => { const v = similarity(a, ex.answer); if (v > sc) { sc = v; best = a; } });
      CUR.heard = best; $("#heard").textContent = best;
      answer(best, null, sc >= 0.8, sc);
    };
    REC.onerror = e => {
      const m = { "not-allowed": "Micro refusé : autorisez le micro pour ce site dans les réglages du navigateur.", "no-speech": "Je n'ai rien entendu. Réessayez plus près du micro.",
        network: "La reconnaissance vocale a besoin d'Internet sur ce navigateur." }[e.error] || "Le micro ne répond pas (" + e.error + ").";
      toast(m, 4000); $("#heard").textContent = "";
    };
    REC.onend = () => { mic && mic.classList.remove("on"); REC = null; };
    REC.start();
  } catch (e) { REC = null; mic.classList.remove("on"); toast("Impossible de démarrer le micro."); }
}

/* ---------------- correction */
function checkAnswer(ex, given) {
  if (ex.type === "qcm") return { ok: given === ex.answer };
  const exp = Array.isArray(ex.answer) ? ex.answer : [ex.answer];
  if (exp.some(a => norm(a) === norm(given))) return { ok: true };
  if (exp.some(a => fold(a) === fold(given))) {
    if (ex.cat === "orthographe") return { ok: false, near: "Presque : attention aux lettres hamza, ة / ه ou ى / ي." };
    return { ok: true, near: "Accepté, mais vérifiez l'orthographe exacte (hamza, ة, ى)." };
  }
  return { ok: false };
}
function answer(given, btn, forced, score) {
  const ex = CUR.ex, exam = SESS.mode === "exam";
  if (CUR.answered) return;
  CUR.answered = true;
  const res = forced !== undefined ? { ok: !!forced } : checkAnswer(ex, given);
  const ok = res.ok;
  record(ex, ok);
  SESS.log.push({ id: ex.id, ok, given, ex, sec: SESS.sec ? SESS.sec[SESS.i] : null, score });
  if (ok) SESS.ok++;
  if (exam) { // pas de correction pendant l'examen
    if (btn) btn.classList.add("chosen");
    $("#next").hidden = false; $("#next").textContent = SESS.i + 1 < SESS.ex.length ? "Question suivante" : "Terminer l'examen";
    if (ex.type !== "qcm" && ex.type !== "speak") $("#next").click();
    return;
  }
  beep(ok);
  if (ex.type === "qcm") $$(".choice").forEach((b, i) => {
    const c = ex.choices[i]; if (c.t === ex.answer) b.classList.add("good"); else if (b === btn) b.classList.add("bad");
    const sm = $("small", b); if (sm.textContent) sm.hidden = false; b.disabled = true;
  });
  const good = Array.isArray(ex.answer) ? ex.answer[0] : ex.answer;
  const say = ex.say || (isAr(good) ? good : "");
  const tr = say && S().translit ? (ex.type === "speak" ? ex.tr : "") : "";
  $("#fb").innerHTML = `<div class="feedback ${ok ? "ok" : "ko"}" role="status">
    <div class="verdict">${ok ? "✓ Bonne réponse" : "✗ Ce n'est pas ça"}${score !== undefined ? ` · compris à ${Math.round(score * 100)} %` : ""}</div>
    ${res.near ? `<p class="small">${esc(res.near)}</p>` : ""}
    ${!ok || ex.type !== "qcm" ? `<div class="small muted">Réponse attendue :</div><div class="good-ans">${wrapAr(good, ex.nov ? ex : { vow: true })}
      ${say ? `<button class="mini" id="sayg" aria-label="Écouter la réponse">🔊</button><button class="mini" id="saygs" aria-label="Écouter lentement">🐢</button>` : ""}</div>` : ""}
    ${!ok && given && ex.type !== "qcm" && given !== "(auto-évaluation)" ? `<div class="small muted">Votre réponse : ${wrapAr(given)}</div>` : ""}
    ${tr ? `<p class="tr" style="text-align:start">${esc(tr)}</p>` : ""}
    <div class="expl">${explainHTML(ex.explain)}</div>
    ${ok && ex.type === "qcm" && say ? `<p style="margin-top:8px"><button class="mini" id="sayg">🔊 Écouter</button></p>` : ""}</div>`;
  if ($("#sayg")) $("#sayg").onclick = () => speak(say);
  if ($("#saygs")) $("#saygs").onclick = () => speak(say, true);
  const nb = $("#next"); nb.hidden = false; nb.textContent = SESS.i + 1 < SESS.ex.length ? "Suivant →" : "Voir le résultat";
  if ($("#skip")) $("#skip").hidden = true;
  if ($("#kbd")) $("#kbd").hidden = true;
  $("#fb").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function record(ex, ok) {
  const p = P();
  if (SESS.mode !== "placement") {
    p.res[ex.id] = ok ? 1 : 0;
    const cur = p.srs[ex.id] || { b: 0, d: 0 };
    if (ok) { if (ex.id in p.srs) { cur.b = Math.min(cur.b + 1, SRS_DAYS.length - 1); cur.d = now() + SRS_DAYS[cur.b] * DAY; if (cur.b >= SRS_DAYS.length - 1) delete p.srs[ex.id]; else p.srs[ex.id] = cur; } }
    else p.srs[ex.id] = { b: 0, d: now() + 10 * 60000 };
  }
  const st = p.stats[ex.cat] = p.stats[ex.cat] || [0, 0]; st[0] += ok ? 1 : 0; st[1]++;
  save();
}
function next() { SESS.i++; if (SESS.i >= SESS.ex.length) finish(); else { showExercise(); window.scrollTo(0, 0); } }

/* ================================================================ fin de série */
function finish(timeout) {
  stopTimer();
  const p = P(), dur = (now() - SESS.t0) / 1000;
  const total = SESS.mode === "exam" ? SESS.ex.length : SESS.log.length;
  const pct = total ? Math.round(100 * SESS.ok / total) : 0;
  if (SESS.mode === "placement") return finishPlacement();
  if (SESS.mode === "exam") return finishExam(timeout);
  p.sessions.push({ t: now(), level: SESS.level, n: total, ok: SESS.ok, dur: Math.round(dur), mode: SESS.mode });
  if (p.sessions.length > 500) p.sessions = p.sessions.slice(-500);
  save();
  const wrong = SESS.log.filter(l => !l.ok);
  app.innerHTML = `${header("Résultat", SESS.level)}
  <div class="score"><b>${SESS.ok}/${total}</b><span>${pct >= 80 ? "Excellent ! مُمْتَاز" : pct >= 50 ? "Bien joué, continuez !" : "Courage, les erreurs reviendront en révision."}</span></div>
  <div class="stats"><div class="stat"><b>${pct} %</b><span>réussite</span></div><div class="stat"><b>${fmtDur(dur)}</b><span>durée</span></div>
  <div class="stat"><b>${dueIds().length}</b><span>à revoir</span></div></div>
  ${wrong.length ? `<h2>À retenir</h2><div class="list">${wrong.map(l => { const g = Array.isArray(l.ex.answer) ? l.ex.answer[0] : l.ex.answer;
    return `<div class="item"><span class="small muted">${esc(l.ex.ins)}</span>${l.ex.ar ? `<span>${wrapAr(l.ex.ar, l.ex)}</span>` : ""}<span>→ ${wrapAr(g, { vow: true })}</span></div>`; }).join("")}</div>` : ""}
  <div class="actions"><button class="btn primary" id="again">↻ Nouvelle série</button><button class="btn ghost" data-go="home">Accueil</button></div>`;
  bindGo();
  $("#again").onclick = () => SESS.mode === "review" ? startSession({ review: true }) : startSession({ level: SESS.level, cats: SESS.cats });
}
function finishPlacement() {
  const per = {}; SESS.log.forEach(l => { const a = per[l.ex.level] = per[l.ex.level] || [0, 0]; a[0] += l.ok ? 1 : 0; a[1]++; });
  let level = "Expert";
  for (const lv of LEVELS.slice(0, 6)) if (per[lv] && per[lv][0] < Math.min(2, per[lv][1])) { level = lv; break; }
  const p = P(); p.placement = { t: now(), level, per }; p.set.level = level; save();
  app.innerHTML = `${header("Test de niveau", "Résultat")}
  <div class="score"><b>${level}</b><span>Niveau conseillé pour commencer</span></div>
  <div class="table-wrap"><table><thead><tr><th>Niveau</th><th>Bonnes réponses</th></tr></thead><tbody>
  ${LEVELS.slice(0, 6).map(l => `<tr><td>${l}</td><td>${per[l] ? per[l][0] + " / " + per[l][1] : "—"}</td></tr>`).join("")}</tbody></table></div>
  <p class="small muted" style="margin-top:10px">Le niveau conseillé est le premier où vous avez eu moins de 2 bonnes réponses sur 3. Il est sélectionné sur l'accueil.</p>
  <button class="btn primary block" data-go="home">Commencer au niveau ${level}</button>`;
  bindGo();
}
function finishExam(timeout) {
  const per = {};
  SESS.ex.forEach((e, i) => { const k = SESS.sec[i]; per[k] = per[k] || [0, 0]; per[k][1]++; });
  SESS.log.forEach(l => { if (l.ok) per[l.sec][0]++; });
  const pcts = {}; Object.entries(per).forEach(([k, [c, n]]) => (pcts[k] = n ? Math.round(100 * c / n) : 0));
  const vals = Object.values(pcts); const total = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  const passed = total >= 50 && vals.every(v => v >= 20);
  const p = P(); p.exams.push({ t: now(), level: SESS.level, total, pcts, passed }); p.sessions.push({ t: now(), level: SESS.level, n: SESS.ex.length, ok: SESS.ok, dur: Math.round((now() - SESS.t0) / 1000), mode: "exam" }); save();
  const answered = new Map(SESS.log.map(l => [l.ex, l]));
  app.innerHTML = `${header("Examen blanc · " + SESS.level, timeout ? "Temps écoulé" : "Terminé")}
  <div class="score"><b>${total}/100</b><span>${passed ? "✓ Examen réussi" : "✗ Pas encore : 50/100 et 20 % par épreuve sont nécessaires"}</span></div>
  <div class="catbars">${Object.entries(pcts).map(([k, v]) => `<div class="catbar"><span>${esc(EXAM_SECTIONS.find(x => x[0] === k)[1])}</span><div class="track"><i style="width:${v}%"></i></div><span class="v">${v} %</span></div>`).join("")}</div>
  <h2>Correction</h2><div class="list">${SESS.ex.map((e, i) => { const l = answered.get(e); const g = Array.isArray(e.answer) ? e.answer[0] : e.answer;
    return `<div class="item"><span class="small muted">${i + 1}. ${esc(e.ins)} ${l ? (l.ok ? "✓" : "✗") : "— sans réponse"}</span>${e.ar ? `<span>${wrapAr(e.ar, e)}</span>` : ""}
    ${l && !l.ok && l.given ? `<span class="small">Votre réponse : ${wrapAr(l.given)}</span>` : ""}<span>→ ${wrapAr(g, { vow: true })}</span></div>`; }).join("")}</div>
  <p class="small muted" style="margin-top:10px">Simulation non officielle inspirée des examens du CECRL.</p>
  <button class="btn primary block" data-go="home">Accueil</button>`;
  bindGo();
}

/* ================================================================ historique */
async function history() {
  const p = P();
  const ses = p.sessions.slice(-30);
  const W = 640, H = 200, padL = 34, padB = 22, padT = 10;
  const x = i => padL + (ses.length > 1 ? i * (W - padL - 10) / (ses.length - 1) : (W - padL) / 2);
  const y = v => padT + (100 - v) * (H - padT - padB) / 100;
  const pts = ses.map((s, i) => [x(i), y(s.n ? 100 * s.ok / s.n : 0)]);
  const chart = ses.length ? `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Réussite des 30 dernières séries">
    ${[0, 50, 100].map(v => `<line x1="${padL}" x2="${W - 6}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${v} %</text>`).join("")}
    <path d="M${pts.map(p => p.join(",")).join(" L")} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z" fill="var(--lapis-soft)" stroke="none"/>
    <polyline points="${pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="var(--lapis)" stroke-width="2.5" stroke-linejoin="round"/>
    ${pts.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="${i === pts.length - 1 ? 5 : 3}" fill="${i === pts.length - 1 ? "var(--gold)" : "var(--lapis)"}"/>`).join("")}
    <text x="${padL}" y="${H - 4}">${fmtDate(ses[0].t)}</text><text x="${W - 6}" y="${H - 4}" text-anchor="end">${fmtDate(ses[ses.length - 1].t)}</text></svg>`
    : `<p class="muted">Aucune série pour l'instant. Votre courbe de progression apparaîtra ici.</p>`;
  const cats = Object.entries(p.stats).filter(([, v]) => v[1]).sort((a, b) => b[1][1] - a[1][1]);
  const totalAns = cats.reduce((a, [, v]) => a + v[1], 0), totalOk = cats.reduce((a, [, v]) => a + v[0], 0);
  app.innerHTML = `${header("Historique", p.name)}
  <div class="stats"><div class="stat"><b>${p.sessions.length}</b><span>séries</span></div><div class="stat"><b>${totalAns}</b><span>réponses</span></div>
  <div class="stat"><b>${totalAns ? Math.round(100 * totalOk / totalAns) : 0} %</b><span>réussite</span></div></div>
  <h2>Réussite par série</h2>${chart}
  <h2>Par catégorie</h2><div class="catbars">${cats.length ? cats.map(([c, [o, n]]) => `<div class="catbar"><span>${(CATS[c] || ["", c]).join(" ")}</span>
    <div class="track"><i style="width:${Math.round(100 * o / n)}%"></i></div><span class="v">${Math.round(100 * o / n)} %</span></div>`).join("") : `<p class="muted">—</p>`}</div>
  <h2>Par niveau</h2><div class="catbars">${LEVELS.map(l => { const g = levelProgress(l); return `<div class="catbar"><span>${l} <span class="muted small">${g.ok}/${g.tot}</span></span><div class="track"><i style="width:${g.pct}%;background:var(--gold)"></i></div><span class="v">${g.pct} %</span></div>`; }).join("")}</div>
  <h2>Dernières séries</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Niveau</th><th>Score</th><th>Durée</th></tr></thead><tbody>
  ${p.sessions.slice(-40).reverse().map(s => `<tr><td>${fmtDate(s.t)}</td><td>${{ serie: "Série", review: "Révision", exam: "Examen", writing: "Rédaction" }[s.mode] || s.mode}</td><td>${esc(s.level)}</td>
    <td>${s.ok}/${s.n}</td><td>${fmtDur(s.dur)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Aucune série.</td></tr>`}</tbody></table></div>
  ${p.exams.length ? `<h2>Examens blancs</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Niveau</th><th>Note</th><th>Résultat</th></tr></thead><tbody>
  ${p.exams.slice().reverse().map(e => `<tr><td>${fmtDate(e.t)}</td><td>${e.level}</td><td>${e.total}/100</td><td>${e.passed ? "✓ réussi" : "✗"}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
  bindGo();
}

/* ================================================================ alphabet */
async function alphabet() {
  ALPHA = ALPHA || await getJSON("data/alphabet.json");
  const sh = (l, j) => j ? `${l}ـ ـ${l}ـ ـ${l}` : `ـ${l}`;
  app.innerHTML = `${header("L'alphabet arabe", "28 lettres · touchez pour écouter")}
  <p class="small">L'arabe s'écrit de droite à gauche. La plupart des lettres changent de forme selon leur place : <b>début ـ milieu ـ fin</b>.
  Six lettres (ا د ذ ر ز و) ne s'attachent jamais à la lettre suivante. Le trait doré marque les <b>lettres solaires</b> : devant elles, le ل de l'article ال ne se prononce pas.</p>
  <div class="alpha">${ALPHA.map(a => `<button class="letter ${a.sun ? "sun" : ""}" data-say="${esc(a.n)}" title="${esc(a.d)}">
    <span class="ar" lang="ar">${a.l}</span><span class="forms ar" lang="ar">${sh(a.l, a.j)}</span><b>${esc(a.nt)}</b><small>${esc(a.t)}</small></button>`).join("")}</div>
  <h2>Les voyelles (ḥarakāt)</h2>
  <div class="table-wrap"><table><thead><tr><th>Signe</th><th>Nom</th><th>Son</th></tr></thead><tbody>
  ${[["بَ", "fatḥa", "a"], ["بِ", "kasra", "i"], ["بُ", "ḍamma", "u"], ["بْ", "sukūn", "pas de voyelle"], ["بّ", "shadda", "consonne doublée"],
    ["بًا", "tanwīn fatḥ", "-an"], ["بٍ", "tanwīn kasr", "-in"], ["بٌ", "tanwīn ḍamm", "-un"], ["بَا", "fatḥa + alif", "ā long"], ["بُو", "ḍamma + wāw", "ū long"], ["بِي", "kasra + yāʾ", "ī long"]]
    .map(r => `<tr><td><button class="mini ar" data-say="${r[0]}" lang="ar" style="font-size:24px">${r[0]}</button></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table></div>
  <button class="btn primary block" style="margin-top:16px" id="drill">S'entraîner sur l'alphabet</button>`;
  bindGo();
  $$("[data-say]").forEach(b => b.onclick = () => speak(b.dataset.say));
  $("#drill").onclick = () => { P().set.level = "A1"; P().set.cats = ["alphabet"]; save(); startSession({ level: "A1", cats: ["alphabet"] }); };
}

/* ================================================================ expression écrite */
const CONNECTORS = ("و|ثم|لكن|لكن|لان|لأن|لذلك|لذا|اولا|ثانيا|اخيرا|بالاضافة|كما|ايضا|اما|حيث|بينما|رغم|مع ذلك|غير ان|بيد ان|في رايي|من جهة|من ناحية|في الختام|ختاما|خلاصة|وبالتالي|بالتالي|اذن|اذا|عندما|بعد ذلك|قبل|علاوة|فضلا|على سبيل المثال|مثلا|مثل|لكي|حتى|كي|فان|اذ|لعل|ربما|وهكذا|من ثم").split("|");
const NEED_CONN = { A1: 1, A2: 2, B1: 3, B2: 5, C1: 6, C2: 7 };
const OPEN_W = /(عزيز|مرحبا|السلام عليكم|حضرة|سيدي|اهلا)/, CLOSE_W = /(تحيات|مع السلامة|الى اللقاء|تفضلوا|شكرا|التقدير|الاحترام|اراك)/;
function scoreWriting(task, text) {
  const t = fold(text), words = t.split(" ").filter(Boolean), n = words.length;
  const found = task.elements.map(el => new RegExp(el.kw.split("|").map(k => fold(k) || k).join("|")).test(t));
  const consigne = Math.round(10 * found.filter(Boolean).length / task.elements.length);
  const longueur = n >= task.min && n <= task.max * 1.3 ? 4 : n >= task.min * 0.75 ? 3 : n >= task.min * 0.5 ? 2 : n > 5 ? 1 : 0;
  const conns = new Set(CONNECTORS.map(fold).filter(c => c.length > 1 && (` ${t} `.includes(` ${c} `)) || false));
  const wa = words.filter(w => w.startsWith("و") && w.length > 2).length;
  const nc = conns.size + (wa ? 1 : 0), need = NEED_CONN[task.level] || 4;
  const connecteurs = Math.min(4, Math.round(4 * nc / need));
  const ttr = n ? new Set(words).size / n : 0;
  const lexique = n < 5 ? 0 : ttr >= 0.65 ? 4 : ttr >= 0.55 ? 3 : ttr >= 0.45 ? 2 : 1;
  const letter = /lettre|courriel|message|carte/.test(task.form);
  let structure = 0;
  if (letter) structure = (OPEN_W.test(t) ? 1.5 : 0) + (CLOSE_W.test(t) ? 1.5 : 0);
  else structure = Math.min(3, (text.split(/\n\s*\n|\n/).filter(x => x.trim()).length >= 2 ? 1 : 0) + (/(في الختام|ختاما|خلاصه|وبالتالي|لذلك|وهكذا)/.test(t) ? 1 : 0) + (n >= task.min ? 1 : 0));
  structure = Math.round(structure);
  const crit = { consigne, longueur, connecteurs, lexique, structure };
  return { crit, total: Object.values(crit).reduce((a, b) => a + b, 0), n, found, conns: [...conns] };
}
async function writingPick() {
  WRITING = WRITING || await getJSON("data/writing.json");
  const lv = S().level;
  app.innerHTML = `${header("Expression écrite", "Notation automatique partielle /25")}
  <p class="small">L'ordinateur vérifie la consigne, la longueur, les mots de liaison, la variété du vocabulaire et la structure. Il ne juge pas la grammaire fine : comparez ensuite avec le modèle.</p>
  <div class="list">${WRITING.map(w => `<button class="tile" data-w="${w.id}" ${w.level === lv ? 'style="border-color:var(--lapis)"' : ""}><b>${w.level} · ${esc(w.form)}</b><span>${esc(w.fr)}</span></button>`).join("")}</div>`;
  bindGo();
  $$("[data-w]").forEach(b => b.onclick = () => writing(WRITING.find(w => w.id === b.dataset.w)));
}
function writing(task) {
  const p = P(); const draftKey = "draft-" + task.id;
  let draft = ""; try { draft = sessionStorage.getItem(draftKey) || ""; } catch (e) { }
  const t0 = now();
  app.innerHTML = `${header("Expression écrite · " + task.level, task.form)}
  <p class="ins">${esc(task.fr)}</p>
  <p class="small muted">Éléments attendus : ${task.elements.map(e => esc(e.fr)).join(" · ")} · ${task.min} à ${task.max} mots · temps conseillé ${WRITING_MIN[task.level] || 30} min.</p>
  <textarea id="wtext" class="writebox" lang="ar" dir="rtl" aria-label="Votre texte" ${S().kb ? 'inputmode="none"' : ""}>${esc(draft)}</textarea>
  <div class="under"><span class="small muted" id="wc">0 mot</span><button class="linkish" id="kbtoggle">${S().kb ? "⌨️ Clavier du téléphone" : "⌨️ Clavier arabe intégré"}</button></div>
  ${S().kb ? keyboardHTML() : ""}
  <div class="sticky-foot"><button class="btn primary block" id="next">Corriger</button></div><div id="wres"></div>`;
  bindGo();
  const ta = $("#wtext");
  const upd = () => { const n = fold(ta.value).split(" ").filter(Boolean).length; $("#wc").textContent = `${n} mot${n > 1 ? "s" : ""}`; try { sessionStorage.setItem(draftKey, ta.value); } catch (e) { } };
  ta.addEventListener("input", upd); upd();
  bindKeyboard(ta); if ($("#kbd")) $$("#kbd button").forEach(b => b.addEventListener("click", upd));
  $("#kbtoggle").onclick = () => { p.set.kb = !S().kb; save(); writing(task); };
  $("#next").onclick = () => {
    if (fold(ta.value).split(" ").filter(Boolean).length < 3) return toast("Écrivez d'abord votre texte.");
    if ($("#kbd")) $("#kbd").hidden = true;
    const r = scoreWriting(task, ta.value);
    p.writings.push({ t: now(), id: task.id, level: task.level, total: r.total });
    p.sessions.push({ t: now(), level: task.level, n: 25, ok: r.total, dur: Math.round((now() - t0) / 1000), mode: "writing" }); save();
    const L = { consigne: ["Respect de la consigne", 10], longueur: ["Longueur", 4], connecteurs: ["Mots de liaison", 4], lexique: ["Variété du vocabulaire", 4], structure: ["Structure et formules", 3] };
    $("#wres").innerHTML = `<div class="score"><b>${r.total}/25</b><span>${r.n} mots</span></div>
    <div class="crit">${Object.entries(r.crit).map(([k, v]) => `<span>${L[k][0]}</span><b>${v} / ${L[k][1]}</b>`).join("")}</div>
    <h3>Consigne</h3><div class="list">${task.elements.map((e, i) => `<div class="item">${r.found[i] ? "✓" : "✗"} ${esc(e.fr)}</div>`).join("")}</div>
    ${r.conns.length ? `<p class="small" style="margin-top:8px">Mots de liaison repérés : <span class="ar" lang="ar">${esc(r.conns.join(" · "))}</span></p>` : ""}
    <h3>Modèle de réponse</h3><div class="reading"><div class="ar" lang="ar">${arText(task.model)}</div>
    <div class="listen"><button class="btn ghost" id="lm">🔊 Écouter le modèle</button></div></div>
    <h3>Auto-évaluation</h3><p class="small">Relisez : accords masculin/féminin, cas après les prépositions (génitif), verbe au singulier quand il précède le sujet, pronoms suffixes, hamza et ة.</p>`;
    $("#lm").onclick = () => speak(task.model);
    $("#next").textContent = "Retour aux sujets"; $("#next").onclick = () => go("writingPick");
    $("#wres").scrollIntoView({ behavior: "smooth" });
  };
}

/* ================================================================ mes exercices */
function editor() {
  const list = DB.custom || [];
  app.innerHTML = `${header("Mes exercices", "Ajoutez vos propres questions")}
  <form id="cf">
    <div class="row"><div class="field" style="flex:1;min-width:120px"><label for="ctype">Type</label><select id="ctype"><option value="qcm">Choix multiple</option><option value="fill">Réponse à écrire</option></select></div>
    <div class="field" style="flex:1;min-width:120px"><label for="clevel">Niveau</label><select id="clevel">${LEVELS.map(l => `<option ${l === S().level ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
    <div class="field"><label for="cins">Consigne (en français)</label><input id="cins" required placeholder="Ex. : Comment dit-on « une fenêtre » en arabe ?"></div>
    <div class="field"><label for="car">Texte arabe affiché (facultatif, ___ pour un trou)</label><input id="car" lang="ar" dir="rtl" class="ar"></div>
    <div class="field"><label for="cfr">Traduction française (facultatif)</label><input id="cfr"></div>
    <div class="field"><label for="cans">Bonne réponse</label><input id="cans" required lang="ar" dir="auto"></div>
    <div class="field" id="cwrongf"><label for="cwrong">Mauvaises réponses (séparées par ;)</label><input id="cwrong" dir="auto" placeholder="Au moins une"></div>
    <div class="field"><label for="cexp">Explication</label><textarea id="cexp"></textarea></div>
    <button class="btn primary block" type="submit">Ajouter l'exercice</button></form>
  <h2>${list.length} exercice(s)</h2>
  <div class="list">${list.map((e, i) => `<div class="item"><span class="small muted">${e.level} · ${e.type === "qcm" ? "QCM" : "à écrire"}</span><b>${esc(e.ins)}</b>
    ${e.ar ? wrapAr(e.ar) : ""}<span>→ ${wrapAr(Array.isArray(e.answer) ? e.answer[0] : e.answer)}</span><div><button class="mini" data-cdel="${i}">Supprimer</button></div></div>`).join("")}</div>
  <h2>Partager</h2><div class="row"><button class="btn ghost" id="cexport">⬇ Exporter (.json)</button><label class="btn ghost" for="cimport">⬆ Importer<input id="cimport" type="file" accept=".json,application/json" hidden></label></div>`;
  bindGo();
  const sync = () => ($("#cwrongf").hidden = $("#ctype").value !== "qcm"); $("#ctype").onchange = sync; sync();
  $("#cf").onsubmit = e => {
    e.preventDefault();
    const type = $("#ctype").value, ans = $("#cans").value.trim(), wrong = $("#cwrong").value.split(";").map(x => x.trim()).filter(Boolean);
    if (type === "qcm" && !wrong.length) return toast("Ajoutez au moins une mauvaise réponse.");
    const n = (DB.custom || []).reduce((m, x) => Math.max(m, +String(x.id).slice(2) || 0), 0) + 1;
    const ex = { id: "C-" + String(n).padStart(4, "0"), level: $("#clevel").value, cat: "perso", theme: "perso", type, ins: $("#cins").value.trim(),
      answer: type === "qcm" ? ans : [ans], explain: $("#cexp").value.trim() || `Réponse : ${ans}`, ar: $("#car").value.trim() || undefined, fr: $("#cfr").value.trim() || undefined,
      say: isAr(ans) ? ans : undefined, kb: true };
    if (type === "qcm") ex.choices = shuffle([ans, ...wrong].map(t => ({ t })));
    DB.custom = (DB.custom || []).concat(ex); save(); toast("Exercice ajouté."); editor();
  };
  $$("[data-cdel]").forEach(b => b.onclick = () => { DB.custom.splice(+b.dataset.cdel, 1); save(); editor(); });
  $("#cexport").onclick = () => download("mes-exercices-arabe.json", JSON.stringify(DB.custom || [], null, 1));
  $("#cimport").onchange = e => readFile(e.target.files[0], txt => {
    const data = JSON.parse(txt); let k = 0;
    (Array.isArray(data) ? data : []).forEach(x => { if (x && x.type && x.answer && x.ins) { x.id = "C-" + Date.now().toString(36) + k; x.cat = "perso"; DB.custom.push(x); k++; } });
    save(); toast(`${k} exercice(s) importé(s).`); editor();
  });
}
function download(name, text) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function readFile(f, cb) { if (!f) return; const r = new FileReader(); r.onload = () => { try { cb(r.result); } catch (e) { toast("Fichier illisible."); } }; r.readAsText(f); }

/* ================================================================ options */
function options() {
  const s = S(), p = P();
  const sw = (id, label, help) => `<label class="switch" for="${id}"><span>${label}${help ? `<small>${help}</small>` : ""}</span><input type="checkbox" id="${id}" ${s[id] ? "checked" : ""}></label>`;
  refreshVoices();
  app.innerHTML = `${header("Options", p.name)}
  <h3>Affichage</h3>
  ${sw("harakat", "Afficher les voyelles (ḥarakāt)", "Désactivez-les pour lire comme dans la presse (sauf conjugaison et grammaire).")}
  ${sw("translit", "Afficher la translittération", "Aide à la lecture en caractères latins (kitāb, madrasa…).")}
  ${sw("showFr", "Afficher la traduction française des questions", "Désactivez pour vous entraîner en immersion.")}
  ${sw("kb", "Clavier arabe intégré", "Pratique si votre téléphone n'a pas de clavier arabe.")}
  <div class="field" style="margin-top:12px"><label for="theme">Thème</label><select id="theme"><option value="">Comme le téléphone</option><option value="light" ${s.theme === "light" ? "selected" : ""}>Clair</option><option value="dark" ${s.theme === "dark" ? "selected" : ""}>Sombre</option></select></div>
  <h3>Son et voix</h3>
  ${sw("sfx", "Sons de bonne / mauvaise réponse")}
  ${sw("autoplay", "Lire l'audio automatiquement", "Pour les exercices d'écoute.")}
  ${sw("oral", "Exercices oraux au micro", SR ? "Reconnaissance vocale disponible." : "Non disponible dans ce navigateur : auto-évaluation à la place.")}
  <div class="field" style="margin-top:12px"><label for="voice">Voix arabe</label><select id="voice"><option value="">Automatique</option>${VOICES.map(v => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === s.voice ? "selected" : ""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("")}</select>
    ${VOICES.length ? "" : `<div class="note">Aucune voix arabe trouvée sur cet appareil. Android : Paramètres › Accessibilité › Synthèse vocale › Moteur Google › Installer les données vocales › Arabe. iPhone : Réglages › Accessibilité › Contenu énoncé › Voix › Arabe.</div>`}</div>
  <div class="field"><label for="rate">Vitesse de lecture : <span id="ratev">${s.rate}</span></label><input type="range" id="rate" min="0.5" max="1.2" step="0.05" value="${s.rate}"></div>
  <button class="btn ghost block" id="test">🔈 Tester la voix : <span class="ar" lang="ar">مَرْحَبًا، كَيْفَ حَالُكَ؟</span></button>
  <h3>Progression</h3>
  <div class="row"><button class="btn ghost" id="exp">⬇ Sauvegarder ma progression</button><label class="btn ghost" for="imp">⬆ Restaurer<input id="imp" type="file" accept=".json,application/json" hidden></label></div>
  <p class="small muted">La sauvegarde (.json) permet de passer à un autre téléphone ou navigateur.</p>
  <button class="btn ghost block" id="reset">Effacer la progression de ${esc(p.name)}</button>
  <div class="note" id="resetbox" hidden>Effacer toutes les réponses, séries et examens de ce profil ? <button class="mini" id="resetyes">Oui, effacer</button> <button class="mini" id="resetno">Annuler</button></div>
  <h3>À propos</h3>
  <p class="small">Exercice d'Arabe pour Français v${VERSION}. Arabe littéraire moderne (fuṣḥā). Les exercices sont en grande partie générés à partir de listes et vérifiés automatiquement ; ils n'ont pas été relus un par un par un enseignant. La note de prononciation mesure ce que le téléphone comprend, pas chaque son. L'attestation et l'examen blanc n'ont aucune valeur officielle.</p>`;
  bindGo();
  ["harakat", "translit", "showFr", "kb", "sfx", "autoplay", "oral"].forEach(k => ($("#" + k).onchange = e => { p.set[k] = e.target.checked; save(); }));
  $("#theme").onchange = e => { p.set.theme = e.target.value; save(); applyTheme(); };
  $("#voice").onchange = e => { p.set.voice = e.target.value; save(); speak("مَرْحَبًا"); };
  $("#rate").oninput = e => { p.set.rate = +e.target.value; $("#ratev").textContent = e.target.value; save(); };
  $("#test").onclick = () => { speak("مَرْحَبًا، كَيْفَ حَالُكَ؟"); beep(true); };
  $("#exp").onclick = () => download(`progression-arabe-${p.name}.json`, JSON.stringify({ app: "exercice-arabe", v: VERSION, profile: p }, null, 1));
  $("#imp").onchange = e => readFile(e.target.files[0], txt => {
    const d = JSON.parse(txt); if (!d.profile || !d.profile.res) throw new Error();
    const np = d.profile; np.id = "p" + now().toString(36); np.name = np.name + " (restauré)"; DB.profiles[np.id] = np; DB.current = np.id; save(); toast("Progression restaurée."); go("home");
  });
  $("#reset").onclick = () => ($("#resetbox").hidden = false);
  $("#resetno").onclick = () => ($("#resetbox").hidden = true);
  $("#resetyes").onclick = () => { Object.assign(p, { res: {}, srs: {}, sessions: [], stats: {}, placement: null, exams: [], writings: [] }); save(); toast("Progression effacée."); go("home"); };
}

/* ================================================================ attestation */
function certificate() {
  const p = P();
  const best = LEVELS.map(l => [l, levelProgress(l)]);
  const exams = p.exams.filter(e => e.passed).map(e => e.level);
  const ans = Object.values(p.stats).reduce((a, v) => a + v[1], 0), ok = Object.values(p.stats).reduce((a, v) => a + v[0], 0);
  app.innerHTML = `${header("Attestation", "Résumé imprimable")}
  <div class="cert"><div class="ar" lang="ar">شَهَادَةُ مُتَابَعَةٍ</div><h2>Attestation de suivi</h2>
  <p>Nous attestons que <b>${esc(p.name)}</b> s'entraîne à l'arabe littéraire avec « Exercice d'Arabe pour Français »
  depuis le ${fmtDate(p.created)}.</p>
  <div class="stats" style="margin:14px 0"><div class="stat"><b>${p.sessions.length}</b><span>séries</span></div><div class="stat"><b>${ans}</b><span>réponses</span></div><div class="stat"><b>${ans ? Math.round(100 * ok / ans) : 0} %</b><span>réussite</span></div></div>
  <div class="table-wrap"><table><thead><tr><th>Niveau</th><th>Exercices réussis</th></tr></thead><tbody>${best.map(([l, g]) => `<tr><td>${l}</td><td>${g.ok} / ${g.tot} (${g.pct} %)</td></tr>`).join("")}</tbody></table></div>
  <p style="margin-top:12px">${p.placement ? `Test de niveau : <b>${p.placement.level}</b> (${fmtDate(p.placement.t)}). ` : ""}${exams.length ? `Examen(s) blanc(s) réussi(s) : <b>${[...new Set(exams)].join(", ")}</b>.` : ""}</p>
  <p class="small muted">Document édité le ${fmtDate(now())}. Sans valeur officielle.</p></div>
  <button class="btn primary block noprint" style="margin-top:14px" id="print">🖨 Imprimer / enregistrer en PDF</button>`;
  bindGo();
  $("#print").onclick = () => { try { window.print(); } catch (e) { toast("Impression non disponible ici."); } };
}

/* ================================================================ démarrage */
async function boot() {
  load();
  applyTheme();
  try { SUMMARY = await getJSON("data/summary.json"); }
  catch (e) { app.innerHTML = `<p class="loading">Impossible de charger les exercices. Vérifiez la connexion puis rechargez la page.</p>`; return; }
  if (!DB.current || !DB.profiles[DB.current]) return profiles(true);
  home();
  LEVELS.slice(0, 2).forEach(l => loadLevel(l).catch(() => { }));
}
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { }));
}
boot();
