import { Chess, judgeMate, judgeFirst, solutionText, expandPuzzle } from './logic.js';

const $ = id => document.getElementById(id);
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const VS = '\uFE0E'; // force text (not emoji) rendering on iOS
const FILES = 'abcdefgh';

// ---------- persistent settings / stats ----------
const LS = 'dmuysi.';
const load = (k, d) => { try { const v = localStorage.getItem(LS + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch {} };

const settings = Object.assign({ mode: 'mixed', diff: 'all', flash: 5, labels: false }, load('settings', {}));
const stats = Object.assign({ solved: 0, tried: 0, streak: 0, best: 0 }, load('stats', {}));
let seen = new Set(load('seen', []));

// ---------- state ----------
let PUZZLES = [];
let cur = null;          // current puzzle
let phase = 'loading';   // ready | flash | solve1 | solve2 | done
let sel = null;          // selected from-square
let flashTimer = null, animTimer = null;
let m2 = null;           // mate-in-2 progress {first, reply, fenAfter}
let resultMarks = {};    // square -> css class shown after answering
let orientWhite = true;

// ---------- board rendering ----------
function squaresInOrder() {
  const out = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const rank = orientWhite ? 8 - r : r + 1;
    const file = orientWhite ? f : 7 - f;
    out.push({ sq: FILES[file] + rank, light: (file + rank) % 2 === 1, row: r, col: f });
  }
  return out;
}

function render(fen, { hide = false, last = null } = {}) {
  const board = $('board');
  const chess = fen ? new Chess(fen) : null;
  board.classList.toggle('hiddenPieces', hide);
  board.innerHTML = '';
  for (const s of squaresInOrder()) {
    const d = document.createElement('div');
    d.className = 'sq ' + (s.light ? 'l' : 'd');
    d.dataset.sq = s.sq;
    if (last && (last.slice(0, 2) === s.sq || last.slice(2, 4) === s.sq)) d.classList.add('last');
    if (sel === s.sq) d.classList.add('sel');
    if (resultMarks[s.sq]) d.classList.add(resultMarks[s.sq]);
    if (s.col === 0) d.insertAdjacentHTML('beforeend', `<span class="coord rank">${s.sq[1]}</span>`);
    if (s.row === 7) d.insertAdjacentHTML('beforeend', `<span class="coord file">${s.sq[0]}</span>`);
    const p = chess && chess.get(s.sq);
    if (p && !hide) d.insertAdjacentHTML('beforeend', `<span class="pc ${p.color}">${GLYPH[p.type]}${VS}</span>`);
    else if (hide && settings.labels) d.insertAdjacentHTML('beforeend', `<span class="name">${s.sq}</span>`);
    board.appendChild(d);
  }
}

// ---------- UI helpers ----------
function show(...ids) {
  for (const id of ['btnStart', 'btnHide', 'btnPeek', 'btnReplay', 'btnNext']) $(id).classList.toggle('hidden', !ids.includes(id));
}
function updateStats() {
  $('stScore').textContent = `${stats.solved}/${stats.tried}`;
  $('stStreak').textContent = stats.streak;
  $('stBest').textContent = stats.best;
}
const sideName = c => (c === 'w' ? 'White' : 'Black');
function turnInfo() {
  const side = cur.fen.split(' ')[1];
  $('infoMain').innerHTML = `<span class="turn-dot ${side}"></span>${sideName(side)} to move · Mate in ${cur.n}`;
  $('infoSub').textContent = `Board shown from ${sideName(side)}'s side (${side === 'w' ? 'rank 1' : 'rank 8'} at the bottom) · Puzzle rating ${cur.rating}`;
}
function setMsg(html) { $('msg').innerHTML = html; }

// ---------- puzzle selection ----------
function pool() {
  const lo = { all: 0, easy: 0, medium: 1000, hard: 1400 }[settings.diff];
  const hi = { all: 9999, easy: 999, medium: 1399, hard: 9999 }[settings.diff];
  return PUZZLES.filter(p => (settings.mode === 'mixed' || p.n === +settings.mode) && p.rating >= lo && p.rating <= hi);
}
let forcedId = new URLSearchParams(location.search).get('p'); // ?p=<lichess id> for testing/sharing
function pickPuzzle() {
  if (forcedId) { const f = PUZZLES.find(p => p.id === forcedId); forcedId = null; if (f) return f; }
  const all = pool();
  let fresh = all.filter(p => !seen.has(p.id));
  if (!fresh.length) { all.forEach(p => seen.delete(p.id)); fresh = all; }
  return fresh[Math.floor(Math.random() * fresh.length)];
}

// ---------- flow ----------
function clearTimers() { clearTimeout(flashTimer); clearInterval(animTimer); flashTimer = animTimer = null; }

function nextPuzzle() {
  clearTimers();
  cur = pickPuzzle();
  sel = null; m2 = null; resultMarks = {};
  orientWhite = cur.fen.split(' ')[1] === 'w';
  phase = 'ready';
  turnInfo();
  render(null, { hide: true });
  $('timerFill').style.transition = 'none'; $('timerFill').style.width = '0';
  const side = sideName(cur.fen.split(' ')[1]);
  $('overlayCard').innerHTML = `<b>Mate in ${cur.n}</b><br>You play <b style="font-size:inherit">${side}</b><br>The board flashes for ${settings.flash} s<div class="tap">Tap to show the puzzle</div>`;
  $('overlay').classList.remove('hidden');
  setMsg('');
  show('btnStart');
}

function startFlash() {
  if (phase !== 'ready') return;
  phase = 'flash';
  $('overlay').classList.add('hidden');
  render(cur.fen, { last: cur.last });
  setMsg('Memorize the position…');
  show('btnHide');
  const fill = $('timerFill');
  fill.style.transition = 'none'; fill.style.width = '100%';
  void fill.offsetWidth;
  fill.style.transition = `width ${settings.flash}s linear`;
  fill.style.width = '0%';
  flashTimer = setTimeout(hidePieces, settings.flash * 1000);
}

function hidePieces() {
  if (phase !== 'flash') return;
  clearTimers();
  const fill = $('timerFill'); fill.style.transition = 'none'; fill.style.width = '0';
  phase = 'solve1';
  render(cur.fen, { hide: true });
  setMsg(`Pieces are gone. ${cur.n === 2 ? 'Enter your first move' : 'Enter the mating move'}: tap the <b>from</b> square, then the <b>to</b> square.`);
  show('btnPeek');
}

function onSquare(sq) {
  if (phase !== 'solve1' && phase !== 'solve2') return;
  if (!sel) { sel = sq; render(null, { hide: true }); setMsg(`From <b>${sq}</b> → tap the destination square (tap ${sq} again to cancel)`); return; }
  if (sel === sq) { sel = null; render(null, { hide: true }); setMsg('Selection cleared. Tap the <b>from</b> square.'); return; }
  const from = sel, to = sq; sel = null;
  render(null, { hide: true });
  if (isPromotion(from, to)) return askPromotion(from, to);
  submit(from, to);
}

function isPromotion(from, to) {
  const fen = phase === 'solve2' ? m2.fenAfter : cur.fen;
  const c = new Chess(fen);
  return c.moves({ verbose: true }).some(m => m.from === from && m.to === to && m.promotion);
}

function askPromotion(from, to) {
  const side = (phase === 'solve2' ? m2.fenAfter : cur.fen).split(' ')[1];
  $('overlayCard').innerHTML = `Promote to:<div class="promo">${['q', 'r', 'b', 'n'].map(t => `<button data-p="${t}"><span class="pc ${side}">${GLYPH[t]}${VS}</span></button>`).join('')}</div>`;
  $('overlay').classList.remove('hidden');
  $('overlay').dataset.promo = '1';
  $('overlayCard').querySelectorAll('button').forEach(b => b.onclick = e => {
    e.stopPropagation();
    $('overlay').classList.add('hidden'); delete $('overlay').dataset.promo;
    submit(from, to, b.dataset.p);
  });
}

function submit(from, to, promo) {
  if (phase === 'solve1' && cur.n === 2) {
    const r = judgeFirst(cur.fen, cur.sol, from, to, promo);
    if (!r.legal) return finish(false, `${from}–${to} isn't a legal move in this position.`, from, to);
    if (!r.ok) return finish(false, `You played <b>${r.san}</b> — that doesn't force mate.`, from, to);
    if (r.mateNow) return finish(true, `<b>${r.san}</b> — that's mate in one! Even better.`, from, to);
    m2 = { first: r, fenAfter: r.fenAfter };
    phase = 'solve2';
    const opp = cur.fen.split(' ')[1] === 'w' ? 'Black' : 'White';
    const dots = opp === 'Black' ? '…' : '';
    resultMarks = {};
    render(null, { hide: true });
    setMsg(`✓ <b>${r.san}</b>${r.alt ? ' (works too!)' : ''}<br><span class="reply">${opp} plays ${dots}${r.reply.san}</span><br>Now find the mate.`);
    return;
  }
  const fen = phase === 'solve2' ? m2.fenAfter : cur.fen;
  const r = judgeMate(fen, from, to, promo);
  if (!r.legal) return finish(false, `${from}–${to} isn't a legal move ${phase === 'solve2' ? 'after that reply' : 'in this position'}.`, from, to);
  if (!r.ok) return finish(false, `<b>${r.san}</b> isn't checkmate.`, from, to);
  const alt = phase === 'solve1' ? r.uci.slice(0, 4) !== cur.sol[0].slice(0, 4) : r.uci.slice(0, 4) !== cur.sol[2]?.slice(0, 4);
  finish(true, `<b>${r.san}</b> — checkmate!${alt ? ' (different from the book answer, but it works)' : ''}`, from, to);
}

function finish(ok, text, from, to) {
  clearTimers();
  phase = 'done';
  stats.tried++;
  if (ok) { stats.solved++; stats.streak++; stats.best = Math.max(stats.best, stats.streak); } else stats.streak = 0;
  save('stats', stats); updateStats();
  seen.add(cur.id); save('seen', [...seen]);
  resultMarks = {};
  if (from) { resultMarks[from] = ok ? 'good' : 'badsq'; resultMarks[to] = ok ? 'good' : 'badsq'; }
  $('timerFill').style.transition = 'none'; $('timerFill').style.width = '0';
  render(cur.fen, { last: cur.last });
  setMsg(`<span class="${ok ? 'good' : 'bad'}">${ok ? 'Correct!' : 'Not quite.'}</span> ${text}<br><span class="sol">Solution: ${solutionText(cur)}</span>`);
  show('btnReplay', 'btnNext');
}

function peek() {
  if (phase !== 'solve1' && phase !== 'solve2') return;
  finish(false, 'You looked at the board again — counts as a miss.');
}

function replay() {
  clearTimers();
  resultMarks = {};
  const chess = new Chess(cur.fen);
  render(chess.fen(), { last: cur.last });
  let i = 0;
  animTimer = setInterval(() => {
    if (i >= cur.sol.length) { clearInterval(animTimer); return; }
    const u = cur.sol[i++];
    chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    render(chess.fen(), { last: u });
  }, 900);
}

// ---------- settings ----------
function applySettingsUI() {
  $('setMode').value = settings.mode; $('setDiff').value = settings.diff;
  $('setFlash').value = settings.flash; $('setFlashVal').textContent = settings.flash;
  $('setLabels').checked = settings.labels;
}
function bind() {
  $('board').addEventListener('click', e => { const s = e.target.closest('.sq'); if (s) onSquare(s.dataset.sq); });
  $('overlay').addEventListener('click', startFlash);
  $('btnStart').onclick = startFlash;
  $('btnHide').onclick = hidePieces;
  $('btnPeek').onclick = peek;
  $('btnReplay').onclick = replay;
  $('btnNext').onclick = nextPuzzle;
  $('btnSettings').onclick = () => { applySettingsUI(); $('dlgSettings').showModal(); };
  $('lnkAbout').onclick = e => { e.preventDefault(); $('dlgAbout').showModal(); };
  $('setFlash').oninput = e => { settings.flash = +e.target.value; $('setFlashVal').textContent = settings.flash; save('settings', settings); };
  $('setLabels').onchange = e => { settings.labels = e.target.checked; save('settings', settings); if (phase.startsWith('solve')) render(null, { hide: true }); };
  const poolChange = key => e => {
    settings[key] = e.target.value; save('settings', settings);
    if (phase === 'ready' || phase === 'done') nextPuzzle();
  };
  $('setMode').onchange = poolChange('mode');
  $('setDiff').onchange = poolChange('diff');
  $('btnResetStats').onclick = () => { Object.assign(stats, { solved: 0, tried: 0, streak: 0, best: 0 }); save('stats', stats); updateStats(); };
}

async function init() {
  bind(); updateStats(); applySettingsUI();
  try {
    PUZZLES = await (await fetch('puzzles.json')).json();
    PUZZLES = PUZZLES.map(expandPuzzle);
    // forget "seen" ids that are no longer in the set, so localStorage stays small
    const ids = new Set(PUZZLES.map(p => p.id));
    seen = new Set([...seen].filter(id => ids.has(id))); save('seen', [...seen]);
  } catch (e) { $('infoMain').textContent = 'Could not load puzzles.'; return; }
  window.__dc = { get cur() { return cur; }, get phase() { return phase; }, submit: (f, t, p) => submit(f, t, p), stats, settings };
  nextPuzzle();
}
init();
