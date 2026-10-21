import fs from 'fs';
import { Chess, judgeMate, judgeFirst, solutionText, expandPuzzle } from './logic.js';
const P = JSON.parse(fs.readFileSync('./puzzles.json', 'utf8')).map(expandPuzzle);
let fails = 0, alt1 = 0, alt2 = 0, wrongOk = 0;
const assert = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } };
for (const p of (process.env.QUICK ? P.filter(p=>p.n===1).slice(0,40).concat(P.filter(p=>p.n===2).slice(0,40)) : P)) {
  const s = p.sol;
  if (p.n === 1) {
    const r = judgeMate(p.fen, s[0].slice(0,2), s[0].slice(2,4));
    assert(r.ok, 'm1 sol ' + p.id);
    // every legal move: mate <=> ok
    const c = new Chess(p.fen);
    for (const m of c.moves({verbose:true})) {
      c.move(m); const mate = c.isCheckmate(); c.undo();
      const j = judgeMate(p.fen, m.from, m.to);
      if (j.ok && m.from+m.to !== s[0].slice(0,4)) alt1++;
      if (!m.promotion || m.promotion==='q') assert(j.ok === mate || (j.ok && !mate && m.promotion), 'm1 consistency ' + p.id + ' ' + m.san);
    }
    assert(!judgeMate(p.fen, 'a1', 'a1').legal, 'illegal');
  } else {
    const r = judgeFirst(p.fen, s, s[0].slice(0,2), s[0].slice(2,4));
    assert(r.ok && !r.alt && r.reply.uci.slice(0,4) === s[1].slice(0,4), 'm2 first ' + p.id);
    const r2 = judgeMate(r.fenAfter, s[2].slice(0,2), s[2].slice(2,4));
    assert(r2.ok, 'm2 final ' + p.id);
    // check some wrong first moves are rejected and alternatives valid
    const c = new Chess(p.fen);
    for (const m of c.moves({verbose:true}).slice(0, 12)) {
      if (m.from+m.to === s[0].slice(0,4)) continue;
      const j = judgeFirst(p.fen, s, m.from, m.to);
      if (j.ok && !j.mateNow) {
        alt2++;
        // verify: some mate exists after the reply
        const cc = new Chess(j.fenAfter);
        const any = cc.moves({verbose:true}).some(x => { cc.move(x); const mt = cc.isCheckmate(); cc.undo(); return mt; });
        assert(any, 'alt2 has mate ' + p.id);
      }
    }
  }
}
console.log('puzzles', P.length, 'm1', P.filter(p=>p.n===1).length, 'm2', P.filter(p=>p.n===2).length);
console.log('alt mates-in-1 accepted', alt1, 'alt mate-in-2 first moves accepted', alt2, 'fails', fails);
const m2s = P.filter(p=>p.n===2);
console.log(solutionText(P[0]), '|', solutionText(m2s[0]), m2s[0].fen);
// data checks: unique ids, n is 1 or 2, sol length matches n, rating range
{
  const ids = new Set(P.map(p=>p.id));
  assert(ids.size === P.length, 'duplicate ids');
  for (const p of P) { assert((p.n===1||p.n===2) && p.sol.length === 2*p.n-1, 'shape ' + p.id); assert(p.rating >= 400 && p.rating <= 1999, 'rating ' + p.id); }
  // app difficulty buckets (same thresholds as app.js pool())
  const B = { easy:[0,999], medium:[1000,1399], hard:[1400,9999] };
  for (const [k,[lo,hi]] of Object.entries(B)) for (const n of [1,2]) {
    const c = P.filter(p=>p.n===n && p.rating>=lo && p.rating<=hi).length;
    console.log('pool', k, 'mateIn'+n, c); assert(c > 0, 'empty pool ' + k + n);
  }
  if (fails) { console.log('FAILED', fails); process.exit(1); }
}

// Synthetic alternative-first-move test: Ra7 (book) and Rb7 both force mate.
{
  const fen = '7k/8/8/8/8/8/1R6/K1R5 w - - 0 1'.replace('K1R5','R1K5');
  const sol = ['a1a7', 'h8g8', 'b2b8'];
  const a = judgeFirst(fen, sol, 'a1', 'a7');
  const b = judgeFirst(fen, sol, 'b2', 'b7');
  const w = judgeFirst(fen, sol, 'a1', 'a8');
  const x = judgeFirst(fen, sol, 'e4', 'e5');
  console.log('book', a.ok, a.reply.san, '| alt', b.ok, b.alt, b.reply.san, '| wrong Ra8+', w.ok, '| illegal', x.legal);
  const fin = judgeMate(b.fenAfter, 'a1', 'a8');
  console.log('alt final Ra8#', fin.ok, fin.san);
  if (!(a.ok && b.ok && b.alt && !w.ok && !x.legal && fin.ok)) { console.log('SYNTH FAIL'); process.exit(1); }
}
