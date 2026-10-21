import fs from 'fs';
import { Chess } from './vendor/chess.js';
const lines = fs.readFileSync('/workspace/dc-data/sample.csv','utf8').split('\n');
const hdr = lines[0].split(',');
const cand = {1:[],2:[]};
for (const l of lines.slice(1)) {
  if (!l) continue;
  const c = l.split(',');
  const [id,fen,moves,rating,rd,pop,plays,themes] = c;
  const t = themes.split(' ');
  const n = t.includes('mateIn1') ? 1 : t.includes('mateIn2') ? 2 : 0;
  if (!n) continue;
  const R=+rating, P=+pop, N=+plays;
  if (P < 85 || N < 300 || R < 500 || R > 1800 || +rd > 90) continue;
  const mv = moves.split(' ');
  if (mv.length !== 1 + 2*n - 1 + 0 && mv.length !== 2*n) {}
  if (mv.length !== 2*n) continue;
  try {
    const g = new Chess(fen);
    const u = s => ({from:s.slice(0,2), to:s.slice(2,4), promotion:s[4]});
    g.move(u(mv[0]));
    const pfen = g.fen();
    const san = [];
    for (const m of mv.slice(1)) san.push(g.move(u(m)).san);
    if (!g.isCheckmate()) continue;
    cand[n].push({id, fen: pfen, sol: mv.slice(1), san, rating: R, pop: P, plays: N, n, last: mv[0]});
  } catch(e) { continue; }
}
const out = [];
for (const n of [1,2]) {
  const buckets = {};
  for (const p of cand[n]) { const b = Math.floor(p.rating/200); (buckets[b] ||= []).push(p); }
  const keys = Object.keys(buckets).sort((a,b)=>a-b);
  keys.forEach(k => buckets[k].sort((a,b)=> (b.pop*Math.log(b.plays)) - (a.pop*Math.log(a.plays))));
  const picked = []; let i=0;
  while (picked.length < 300) { let added=false; for (const k of keys) { if (buckets[k][i]) { picked.push(buckets[k][i]); added=true; if (picked.length>=300) break; } } if(!added) break; i++; }
  picked.sort((a,b)=>a.rating-b.rating);
  console.log('mateIn'+n, 'candidates', cand[n].length, 'picked', picked.length, 'ratings', picked[0].rating, '-', picked.at(-1).rating, JSON.stringify(keys.map(k=>[k*200, picked.filter(p=>Math.floor(p.rating/200)==k).length])));
  out.push(...picked);
}
fs.writeFileSync('puzzles.json', JSON.stringify(out.map(({id,fen,sol,san,rating,n,last})=>({id,fen,sol,san,rating,n,last}))));
console.log(fs.statSync('puzzles.json').size);
