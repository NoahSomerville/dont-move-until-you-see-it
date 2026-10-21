// Builds dist/dont-move-until-you-see-it.html: one self-contained file (no server needed).
import fs from 'fs';
const strip = s => s.replace(/^import .*$/gm, '').replace(/^export \{[^}]*\};?$/gm, '').replace(/^export (default )?/gm, '');
const chess = strip(fs.readFileSync('vendor/chess.js', 'utf8'));
const logic = strip(fs.readFileSync('logic.js', 'utf8'));
let app = strip(fs.readFileSync('app.js', 'utf8'))
  .replace("PUZZLES = await (await fetch('puzzles.json')).json();", 'PUZZLES = window.__PUZZLES;')
  .replace('async function init()', 'function init()');
const puzzles = fs.readFileSync('puzzles.json', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const icon = 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync('icon.svg')).toString('base64');
let html = fs.readFileSync('index.html', 'utf8')
  .replace('<link rel="stylesheet" href="style.css">', `<style>${css}</style>`)
  .replace('href="icon.svg"', `href="${icon}"`)
  .replace('<link rel="apple-touch-icon" href="icon-180.png">\n', '')
  .replace('<script type="module" src="app.js"></script>',
    `<script>window.__PUZZLES=${puzzles};</script>\n<script>(function(){\n${chess}\n${logic}\n${app}\n})();</script>`);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/dont-move-until-you-see-it.html', html);
console.log('wrote', html.length, 'bytes');
