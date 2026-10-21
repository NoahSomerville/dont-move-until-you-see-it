// Builds puzzles.json from the Lichess puzzle database (CC0, https://database.lichess.org/#puzzles).
// Usage: curl -s https://database.lichess.org/lichess_db_puzzle.csv.zst | zstdcat | node build-puzzles.mjs
//   (or: zstdcat lichess_db_puzzle.csv.zst | node build-puzzles.mjs)
// Output format (compact, one array per puzzle):
//   [id, fen, solution UCI moves (space separated), rating, opponent's last move UCI]
// fen is the position AFTER the opponent's first move (Lichess FEN is the position before it);
// mate-in-N is implied by the solution length (1 move = mate in 1, 3 moves = mate in 2).
import fs from 'fs';
import readline from 'readline';
import { Chess } from './vendor/chess.js';

const CFG = {
  minRating: 400, maxRating: 1999, band: 200,   // bands 400-599, 600-799, ... 1800-1999
  minPopularity: 90, minPlays: 300, maxRatingDeviation: 90,
  perType: 5000,                                 // target per mate-in-1 / mate-in-2
};

const cand = { 1: [], 2: [] };
let rows = 0, prefiltered = 0, rejected = 0;
const u = s => ({ from: s.slice(0, 2), to: s.slice(2, 4), promotion: s[4] });
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const l of rl) {
  if (!rows++ || !l) continue;
  const [id, fen, moves, rating, rd, pop, plays, themes] = l.split(',');
  const t = ' ' + themes + ' ';
  const n = t.includes(' mateIn1 ') ? 1 : t.includes(' mateIn2 ') ? 2 : 0;
  if (!n) continue;
  const R = +rating, P = +pop, N = +plays;
  if (P < CFG.minPopularity || N < CFG.minPlays || +rd > CFG.maxRatingDeviation || R < CFG.minRating || R > CFG.maxRating) continue;
  const mv = moves.split(' ');
  if (mv.length !== 2 * n) continue;
  prefiltered++;
  try {
    const g = new Chess(fen);
    g.move(u(mv[0]));               // opponent's move that sets up the puzzle
    const pfen = g.fen();
    for (const m of mv.slice(1)) g.move(u(m));
    if (!g.isCheckmate()) { rejected++; continue; }
    cand[n].push({ id, fen: pfen, sol: mv.slice(1).join(' '), rating: R, pop: P, plays: N, last: mv[0] });
  } catch (e) { rejected++; continue; }
}
console.log('rows', rows - 1, 'passed filters', prefiltered, 'rejected by chess.js check', rejected);

const out = [];
const report = {};
for (const n of [1, 2]) {
  const buckets = {};
  for (const p of cand[n]) (buckets[Math.floor(p.rating / CFG.band)] ||= []).push(p);
  const keys = Object.keys(buckets).sort((a, b) => a - b);
  keys.forEach(k => buckets[k].sort((a, b) => (b.pop * Math.log(b.plays)) - (a.pop * Math.log(a.plays))));
  // round-robin across bands so every band gets an equal share (a short band just runs out)
  const picked = []; let i = 0;
  while (picked.length < CFG.perType) {
    let added = false;
    for (const k of keys) if (buckets[k][i]) { picked.push(buckets[k][i]); added = true; if (picked.length >= CFG.perType) break; }
    if (!added) break; i++;
  }
  picked.sort((a, b) => a.rating - b.rating);
  report['mateIn' + n] = { candidates: cand[n].length, picked: picked.length, min: picked[0].rating, max: picked.at(-1).rating,
    bands: Object.fromEntries(keys.map(k => [`${k * CFG.band}-${k * CFG.band + CFG.band - 1}`, [buckets[k].length, picked.filter(p => Math.floor(p.rating / CFG.band) == k).length]])) };
  out.push(...picked);
}
console.log(JSON.stringify(report, null, 1));
fs.writeFileSync('puzzles.json', '[\n' + out.map(p => JSON.stringify([p.id, p.fen, p.sol, p.rating, p.last])).join(',\n') + '\n]\n');
console.log('wrote', out.length, 'puzzles,', fs.statSync('puzzles.json').size, 'bytes');
