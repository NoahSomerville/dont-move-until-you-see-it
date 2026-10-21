# Don't Move Until You See It (prototype v0.1)

A chess puzzle flashes for a few seconds, then the pieces disappear. Solve it from memory
by tapping the from-square, then the to-square, on the empty board.

## Run it
- Easiest: open `dist/dont-move-until-you-see-it.html` in any browser (single self-contained file).
- Or serve the folder: `python3 -m http.server 8765` and open http://localhost:8765
- Public link (temporary): `bash start.sh` starts the server plus a Cloudflare quick tunnel and
  prints a https://….trycloudflare.com URL. Needs `cloudflared` and outbound port 7844.
- Test a specific puzzle: add `?p=<lichess puzzle id>` to the URL.

## Settings
- **Puzzle type**: mixed, mate in 1, or mate in 2.
- **Puzzle rating**: a two-handle range slider from 400 to 2000 in steps of 50, with a minimum
  gap of 100 (dragging one handle into the other pushes it along). The range covers min up to
  but not including max (a puzzle rated exactly 1400 is in 1400–2000, not 1000–1400). Quick-pick chips:
  All 400–2000 (default), Easy 400–1000, Medium 1000–1400, Harder 1400–2000. The number of matching puzzles
  is not shown normally. If fewer than 100 puzzles match the current type and range, a short note
  appears under the chips ("Only 42 puzzles in this range — you may see repeats sooner."). If none match,
  the note turns red, and the board says so and opens settings when tapped. With the current set, the smallest
  pool the slider can reach is 650–750: 268 mate-in-1, 238 mate-in-2, 506 mixed, so the note doesn't appear. Older saved `diff` settings are converted to the matching range automatically.
- **Move feedback**: a correct first move (mate in 2) makes its from- and to-squares glow a muted sage
  green for about 0.5 s, with a small ✓ at the top of the screen. A correct final move gives a shorter
  sage glow (about 0.25 s) and a "✓ Solved" badge. A wrong move makes its two squares glow brick red
  for about 0.6 s and shakes just those two squares. With reduced motion turned on, the shake is skipped
  but the glow stays. This lives in `moveFx` / `showToast` in app.js, and in `#fx`, `.fxsq` and `#fxToast`
  in style.css.
- Puzzles are not repeated within the current type and range until all of them have been seen. Then
  that pool starts over.

## Files
- `index.html`, `style.css`, `app.js` – the UI
- `logic.js` – move judging (any checkmate counts; alternative forced mate-in-2 first moves accepted),
  plus the rating-range helpers (`clampRange`, `filterPool`, `migrateSettings`, `PRESETS`)
- `vendor/chess.js` – chess.js 1.0.0 (BSD-2-Clause), legality/mate checking
- `pieces/cburnett/` – piece images: the Cburnett set from Wikimedia Commons
  (https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces/Standard_transparent), by Colin M.L. Burnett
  with minor revisions by Commons contributors, used under the 3-clause BSD License (Copyright (c) 2006
  Colin M.L. Burnett). The 2012 revisions are used for K/Q/R/B/N and the 2020-12-11 revisions for pawns,
  minified with svgo. The full license text and per-file revision list are in `pieces/cburnett/LICENSE`.
  The app shows the same notice under About → Licenses.
- `puzzles.json` – 5,000 mate-in-1 + 5,000 mate-in-2 from the Lichess puzzle database (CC0),
  ratings 400–1999, Popularity ≥ 90, ≥ 300 plays, rating deviation ≤ 90, spread evenly across
  sixteen 100-point rating bands, 400–499 … 1900–1999 (312 or 313 per band per type); every solution verified to end in checkmate with chess.js.
  Each puzzle is a compact array: [id, fen (puzzle position, after the opponent's setup move),
  solution in UCI (space separated), rating, opponent's last move]. Mate-in-N comes from the solution length.
- `build-puzzles.mjs` – rebuilds puzzles.json by streaming the full Lichess CSV:
  `curl -s https://database.lichess.org/lichess_db_puzzle.csv.zst | zstdcat | node build-puzzles.mjs`
- `build-standalone.mjs` – rebuilds the single-file HTML in dist/. Piece SVGs are embedded as data URIs and the piece license is included as a comment, so it works offline.
- `test-logic.mjs` – Node tests for the judging logic, the puzzle data and the range filter (`QUICK=1 node test-logic.mjs`)

Settings and score are stored in the browser's localStorage (keys prefixed `dmuysi.`).
