# Don't Move Until You See It (prototype v0.1)

A chess puzzle flashes for a few seconds, then the pieces disappear. Solve it from memory
by tapping the from-square, then the to-square, on the empty board.

## Run it
- Easiest: open `dist/dont-move-until-you-see-it.html` in any browser (single self-contained file).
- Or serve the folder: `python3 -m http.server 8765` and open http://localhost:8765
- Public link (temporary): `bash start.sh` starts the server plus a Cloudflare quick tunnel and
  prints a https://….trycloudflare.com URL. Needs `cloudflared` and outbound port 7844.
- Test a specific puzzle: add `?p=<lichess puzzle id>` to the URL.

## Files
- `index.html`, `style.css`, `app.js` – the UI
- `logic.js` – move judging (any checkmate counts; alternative forced mate-in-2 first moves accepted)
- `vendor/chess.js` – chess.js 1.0.0 (BSD-2-Clause), legality/mate checking
- `puzzles.json` – 300 mate-in-1 + 300 mate-in-2 from the Lichess puzzle database (CC0),
  ratings 500–1800, Popularity ≥ 85, ≥ 300 plays, spread evenly across rating bands.
  Fields: id, fen (puzzle position, after the opponent's setup move), sol (UCI), san, rating, n, last.
- `build-puzzles.mjs` – rebuilds puzzles.json from a Lichess CSV extract
- `build-standalone.mjs` – rebuilds the single-file HTML in dist/
- `test-logic.mjs` – Node tests for the judging logic (`QUICK=1 node test-logic.mjs`)

Settings and score are stored in the browser's localStorage (keys prefixed `dmuysi.`).
