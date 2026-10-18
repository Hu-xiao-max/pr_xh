// Screenshot slides of the deck through headless Chrome and report whether they overflow.
// Needs Node >= 22 and Google Chrome started with a remote-debugging port, e.g.
//
//   python3 -m http.server 8000 &
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//       --remote-debugging-port=9224 --user-data-dir=/tmp/pr-xh-shots \
//       --autoplay-policy=no-user-gesture-required about:blank &
//   OUT=/tmp/shots PLAN='[[1280,720,false,["cover","my-paper"]],[390,844,true,["my-paper"]]]' \
//       node tools/snapshot_slides.mjs
//
// Environment: OUT (directory for the PNGs, required), PLAN (JSON: [[width, height, mobile, [slide ids]]...],
// default: every paper slide at 1280x720 and 390x844), CDP_PORT (9224), BASE_URL (http://127.0.0.1:8000/),
// MONTAGE=file.png (also tile all shots, two per row, with ffmpeg).
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.env.CDP_PORT || 9224;
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000/';
const OUT = process.env.OUT;
if (!OUT) { console.error('set OUT=<directory>'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const problems = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') problems.push('exception: ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') problems.push('console: ' + d.params.entry.text);
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value;

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: BASE }); await sleep(1500);
const paperIds = await ev('(window.PAPERS || []).map(p => p.id)');
const plan = process.env.PLAN ? JSON.parse(process.env.PLAN) : [[1280, 720, false, paperIds], [390, 844, true, paperIds]];

const shots = [], shotSize = [];
for (const [w, h, mobile, ids] of plan) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  await send('Page.navigate', { url: BASE }); await sleep(1200);
  for (const sid of ids) {
    await ev(`location.hash = '#/${sid}'`); await sleep(1600);
    const info = await ev(`(() => { const s = document.querySelector('.slide.is-active'); if (!s || s.id !== '${sid}') return { missing: true };
      const inner = s.querySelector('.slide-inner'); const cs = getComputedStyle(inner);
      const content = inner.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const board = s.querySelector('.board');
      const imgs = [...s.querySelectorAll('[data-gallery] img')].map(img => { const b = img.getBoundingClientRect(); const ar = img.naturalWidth / Math.max(1, img.naturalHeight); const dw = Math.min(b.width, b.height * ar); return Math.round(dw) + 'x' + Math.round(dw / ar); });
      return { overflow: inner.scrollHeight - inner.clientHeight, boardPct: board ? Math.round(100 * board.clientHeight / content) : null,
        bullets: [...s.querySelectorAll('.points li')].filter(li => getComputedStyle(li).display !== 'none').length,
        tight: [...s.classList].filter(c => c.startsWith('tight')).join('+') || '', images: imgs }; })()`);
    const file = `${OUT}/${w}x${h}_${sid}.png`;
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    shots.push(file); shotSize.push([w, h]);
    console.log(`${w}x${h} ${sid}: ${info.missing ? 'SLIDE NOT FOUND' : `overflow=${info.overflow}px board=${info.boardPct}% bullets=${info.bullets}${info.tight ? ' tight=' + info.tight : ''} images=[${info.images.join(', ')}]`}  -> ${file}`);
  }
}
if (process.env.MONTAGE && shots.length) {
  // tile the shots two per row, each scaled to 800 px wide and padded to its row's height
  const cols = 2, W = 800;
  const scaledH = shots.map((_, i) => Math.ceil(W * shotSize[i][1] / shotSize[i][0]) + 2);   // +2: never smaller than the scaled frame
  const args = ['-nostdin', '-y', '-v', 'error'];
  shots.forEach((f) => args.push('-i', f));
  const parts = [], rowLabels = [];
  for (let r = 0, i = 0; i < shots.length; r++, i += cols) {
    const idx = shots.slice(i, i + cols).map((_, k) => i + k);
    const rowH = Math.max(...idx.map((k) => scaledH[k]));
    idx.forEach((k) => parts.push(`[${k}:v]scale=${W}:-2,pad=${W}:${rowH}:0:0:color=white[c${k}]`));
    if (idx.length === cols) { parts.push(idx.map((k) => `[c${k}]`).join('') + `hstack=inputs=${cols}[row${r}]`); rowLabels.push(`[row${r}]`); }
    else { parts.push(`[c${idx[0]}]pad=${W * cols}:${rowH}:0:0:color=white[row${r}]`); rowLabels.push(`[row${r}]`); }
  }
  const graph = parts.join(';') + (rowLabels.length > 1 ? ';' + rowLabels.join('') + `vstack=inputs=${rowLabels.length}[o]` : '');
  try {
    execFileSync('ffmpeg', [...args, '-filter_complex', graph, '-map', rowLabels.length > 1 ? '[o]' : rowLabels[0], process.env.MONTAGE], { stdio: 'pipe' });
    console.log('montage -> ' + process.env.MONTAGE);
  } catch (e) { console.log('montage failed - view the PNGs individually\n' + String(e.stderr || e.message).slice(-400)); }
}
console.log(problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'No JS exceptions or console errors.');
ws.close(); process.exit(0);
