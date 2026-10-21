// Pure puzzle logic (no DOM) so it can be tested in Node too.
import { Chess } from './vendor/chess.js';

export { Chess };

const uciOf = m => m.from + m.to + (m.promotion || '');

function candidates(chess, from, to, promo) {
  // All legal moves matching from/to (several if it's a promotion and no piece was chosen).
  return chess.moves({ verbose: true }).filter(m => m.from === from && m.to === to && (!promo || !m.promotion || m.promotion === promo));
}

function prefQueen(list) {
  return list.find(m => !m.promotion || m.promotion === 'q') || list[0];
}

// Final (mating) move: correct if ANY legal move from->to gives checkmate.
export function judgeMate(fen, from, to, promo) {
  const chess = new Chess(fen);
  const cands = candidates(chess, from, to, promo);
  if (!cands.length) return { legal: false, ok: false };
  for (const m of cands) {
    chess.move(m);
    const mate = chess.isCheckmate();
    chess.undo();
    if (mate) return { legal: true, ok: true, san: m.san, uci: uciOf(m) };
  }
  const m = prefQueen(cands);
  return { legal: true, ok: false, san: m.san, uci: uciOf(m) };
}

// Does the side to move have a mate in 1 here?
function hasMateIn1(chess) {
  for (const m of chess.moves({ verbose: true })) {
    chess.move(m);
    const mate = chess.isCheckmate();
    chess.undo();
    if (mate) return true;
  }
  return false;
}

// First move of a mate-in-2.
// ok if it's the book move, an immediate mate, or any other move after which
// every defence still allows mate in 1 (an alternative forced mate).
export function judgeFirst(fen, sol, from, to, promo) {
  const chess = new Chess(fen);
  const cands = candidates(chess, from, to, promo);
  if (!cands.length) return { legal: false, ok: false };
  // 1. matches the Lichess solution
  for (const m of cands) {
    if (uciOf(m) === sol[0] || (m.from + m.to === sol[0].slice(0, 4) && !sol[0][4])) {
      chess.move(m);
      const reply = chess.move({ from: sol[1].slice(0, 2), to: sol[1].slice(2, 4), promotion: sol[1][4] });
      return { legal: true, ok: true, san: m.san, uci: uciOf(m), reply: { san: reply.san, uci: uciOf(reply) }, fenAfter: chess.fen(), alt: false };
    }
  }
  // 2. mates right away
  for (const m of cands) {
    chess.move(m);
    const mate = chess.isCheckmate();
    chess.undo();
    if (mate) return { legal: true, ok: true, mateNow: true, san: m.san, uci: uciOf(m) };
  }
  // 3. alternative that still forces mate next move
  for (const m of cands) {
    chess.move(m);
    const replies = chess.moves({ verbose: true });
    let forced = replies.length > 0;
    for (const r of replies) {
      chess.move(r);
      const mate = hasMateIn1(chess);
      chess.undo();
      if (!mate) { forced = false; break; }
    }
    if (forced) {
      const r = replies[0];
      const r2 = chess.move(r);
      const out = { legal: true, ok: true, san: m.san, uci: uciOf(m), reply: { san: r2.san, uci: uciOf(r2) }, fenAfter: chess.fen(), alt: true };
      return out;
    }
    chess.undo();
  }
  const m = prefQueen(cands);
  return { legal: true, ok: false, san: m.san, uci: uciOf(m) };
}

// puzzles.json stores each puzzle compactly as [id, fen, "uci uci uci", rating, lastMoveUci].
// Older builds used objects {id, fen, sol, san, rating, n, last}; both are accepted.
export function expandPuzzle(r) {
  if (!Array.isArray(r)) return r;
  const [id, fen, sol, rating, last] = r;
  const s = sol.split(' ');
  return { id, fen, sol: s, rating, last, n: (s.length + 1) / 2 };
}

// SAN for the stored UCI solution (computed on demand, then cached).
export function solutionSan(p) {
  if (!p.san) {
    const c = new Chess(p.fen);
    p.san = p.sol.map(u => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san);
  }
  return p.san;
}

// "1. Qh7+ Kf8 2. Qh8#" style text for the stored solution.
export function solutionText(p) {
  solutionSan(p);
  const white = p.fen.split(' ')[1] === 'w';
  let num = +p.fen.split(' ')[5];
  let s = '';
  p.san.forEach((san, i) => {
    const whiteMove = (i % 2 === 0) === white;
    if (whiteMove) s += `${num}. ${san} `;
    else { if (i === 0) s += `${num}... `; s += `${san} `; num++; }
  });
  return s.trim();
}
