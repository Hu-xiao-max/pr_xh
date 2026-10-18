// Functional smoke test for the slide deck, driven through the Chrome DevTools Protocol.
// Needs Node >= 22 (global WebSocket) and Google Chrome. Run from the repo root:
//
//   python3 -m http.server 8000 &
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//       --remote-debugging-port=9222 --user-data-dir=/tmp/pr-xh-chrome \
//       --autoplay-policy=no-user-gesture-required about:blank &
//   node tools/test_page.mjs            # CDP_PORT=9223 to use another port
//
// Checks slide generation (cover with contents, one slide per paper, closing), keyboard / wheel / hash navigation, dialogs, that videos are
// only attached on the current and neighbouring slides, autoplay + pause-on-leave,
// that every slide fits a 1280x720 projector without scrolling, and the phone layout.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.env.CDP_PORT || 9222;
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const problems = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') problems.push('JS exception: ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') problems.push('console error: ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error('eval failed: ' + expr + ' -> ' + JSON.stringify(r.result.exceptionDetails).slice(0, 200));
  return r.result.result.value;
};
const key = (k, extra = '') => ev(`window.dispatchEvent(new KeyboardEvent('keydown', {key: '${k}', bubbles: true, cancelable: true ${extra}})); true`);
const active = () => ev('document.querySelector(".slide.is-active").id');
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };

await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:8000/' });
await sleep(1800);
const nPapers = await ev('window.PAPERS.length');

console.log('Deck');
check('slides = papers + cover + end', (await ev('document.querySelectorAll(".slide").length')) === nPapers + 2);
check('cover lists every paper in its contents', (await ev('document.querySelectorAll("#cover .toc-item").length')) === nPapers);
check('cover shows no statistics block', (await ev('document.querySelectorAll("#cover .stats, #cover .stat").length')) === 0);
check('starts on the cover', (await active()) === 'cover');
check('counter shows 1 / N', (await ev('document.getElementById("current").textContent + "/" + document.getElementById("total").textContent')) === `1/${nPapers + 2}`);
check('inactive slides are inert', (await ev('document.querySelectorAll(".slide[inert]").length')) === nPapers + 1);
check('on the cover only the neighbouring first paper has its video src pre-attached, nothing plays',
  (await ev('[...document.querySelectorAll("video")].filter(v=>v.getAttribute("src")).every(v=>v.closest(".slide").id===window.PAPERS[0].id)')) &&
  (await ev('[...document.querySelectorAll("video")].every(v=>v.paused)')));
check('no author line anywhere on the slides', (await ev('document.querySelectorAll(".authors, .authors-anon").length')) === 0);
check('Home button is disabled on the cover', await ev('document.getElementById("home").disabled'));

console.log('Keyboard navigation');
const firstId = await ev('window.PAPERS[0].id');
await key('ArrowRight'); await sleep(1200);
check('→ goes straight to the first paper', (await active()) === firstId);
check('hash follows the slide', (await ev('location.hash')) === '#/' + firstId);
check('progress bar advanced', parseFloat(await ev('document.getElementById("progress").style.width')) > 20);
check('current slide video has src, next slide too, two slides away not yet',
  (await ev(`!!document.querySelector("#${firstId} video").getAttribute("src")`)) &&
  (await ev('!!document.querySelector("#" + window.PAPERS[1].id + " video").getAttribute("src")')) &&
  !(await ev('!!document.querySelector("#" + window.PAPERS[2].id + " video").getAttribute("src")')));
check('overview video on the paper slide is not autoplaying', await ev(`document.querySelector("#${firstId} video").paused`));
await key(' '); await sleep(300);
check('Space goes forward', (await active()) === await ev('window.PAPERS[1].id'));
await key(' ', ', shiftKey: true'); await sleep(300);
check('Shift+Space goes back', (await active()) === firstId);
await key('5'); await sleep(1800);
check('digit 5 jumps to paper 5', (await active()) === await ev('window.PAPERS[4].id'));
const clips = await ev('[...document.querySelectorAll(".slide.is-active video")].map(v=>({src:!!v.getAttribute("src"),paused:v.paused,muted:v.muted,poster:!!v.poster}))');
check('loop clips on the active slide autoplay muted with poster', clips.length > 0 && clips.every((c) => c.src && !c.paused && c.muted && c.poster), JSON.stringify(clips));
await key('ArrowLeft'); await sleep(1300);
check('← leaves the slide and its clips pause', await ev('[...document.querySelectorAll("#" + window.PAPERS[4].id + " video")].every(v=>v.paused)'));
await key('End'); await sleep(300);
check('End goes to the closing slide', (await active()) === 'end');
check('Home button is enabled away from the cover', !(await ev('document.getElementById("home").disabled')));
await ev('document.getElementById("home").click()'); await sleep(300);
check('Home button returns to the cover', (await active()) === 'cover');
await key('3'); await sleep(300); await key('h'); await sleep(300);
check('H key returns to the cover', (await active()) === 'cover');
await key('End'); await sleep(300);
await key('Home'); await sleep(300);
check('Home goes back to the cover', (await active()) === 'cover');

console.log('Wheel, hash, contents');
await ev('window.dispatchEvent(new WheelEvent("wheel", {deltaY: 120, bubbles: true})); true'); await sleep(300);
check('wheel down advances one slide', (await active()) === firstId);
await ev('window.dispatchEvent(new WheelEvent("wheel", {deltaY: 120, bubbles: true})); true'); await sleep(100);
check('a second wheel event within the lock window is ignored', (await active()) === firstId);
await key('Home'); await sleep(300);
await ev('document.querySelector("#cover .toc-item[data-goto=teleop]").click()'); await sleep(1800);
check('a contents entry on the cover jumps to its paper', (await active()) === 'teleop');
const tele = await ev('[...document.querySelectorAll("#teleop video")].map(v=>{const r=v.getBoundingClientRect();return {paused:v.paused,w:Math.round(r.width),h:Math.round(r.height),right:Math.round(r.right),bottom:Math.round(r.bottom)}})');
check('three portrait clips play side by side inside the viewport', tele.length === 3 && tele.every((t) => !t.paused && t.h > t.w && t.right <= 1280 && t.bottom <= 720), JSON.stringify(tele));
await ev('location.hash = "#/object-spin"'); await sleep(900);
check('hash deep link selects the slide', (await active()) === 'object-spin');
check('digit keys ignore out-of-range papers', (await key('9'), await sleep(200), await active()) === 'object-spin');

console.log('Dialogs');
await key('a'); await sleep(300);
check('A opens the abstract dialog', await ev('document.getElementById("info-dialog").open'));
check('abstract text is the current paper\'s', (await ev('document.getElementById("info-body").textContent')).includes('closure-event grasp discovery'));
check('abstract dialog shows no author section', !(await ev('document.getElementById("info-body").textContent')).includes('Authors'));
await key('ArrowRight'); await sleep(200);
check('arrow keys are ignored while a dialog is open', (await active()) === 'object-spin');
await ev('document.querySelector("#info-dialog [data-close-dialog]").click()'); await sleep(200);
check('abstract dialog closes', !(await ev('document.getElementById("info-dialog").open')));
await key('b'); await sleep(300);
check('B opens BibTeX with the right entry', (await ev('document.getElementById("bibtex-text").textContent')).includes('@misc{anonymous2027wheretostart'));
await ev('document.querySelector("[data-copy-bibtex]").click()'); await sleep(300);
check('copy shows a toast', await ev('document.getElementById("toast").classList.contains("show")'));
await ev('document.querySelector("#bibtex-dialog .dlg-foot [data-close-dialog]").click()'); await sleep(200);
await key('?'); await sleep(200);
check('? opens the help dialog', await ev('document.getElementById("help-dialog").open'));
await ev('document.querySelector("#help-dialog [data-close-dialog]").click()'); await sleep(200);

console.log('Figures');
check('every paper slide shows two figures', await ev('[...document.querySelectorAll(".slide-paper")].every(s=>s.querySelectorAll(".figs .fig img").length===2)'));
await ev(`location.hash = '#/${firstId}'`); await sleep(1500);
check('figure images are loaded on the active slide', await ev('[...document.querySelectorAll(".slide.is-active .fig img")].every(i=>i.complete&&i.naturalWidth>0)'));
check('the two figures overlap (collage)', await ev('(() => { const [a,b] = [...document.querySelectorAll(".slide.is-active .fig")].map(e=>e.getBoundingClientRect()); return !!(a && b) && Math.min(a.right,b.right) - Math.max(a.left,b.left) > 0 && Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top) > 0; })()'));
check('figures sit above the video inside the visual column', await ev('(() => { const f = document.querySelector(".slide.is-active .figs").getBoundingClientRect(); const v = document.querySelector(".slide.is-active .paper-media").getBoundingClientRect(); return f.bottom <= v.top + 1; })()'));
await ev('document.querySelector(".slide.is-active .fig-1").click()'); await sleep(300);
check('clicking a figure opens the lightbox on figure 1', (await ev('document.getElementById("fig-dialog").open')) && (await ev('document.getElementById("fig-img").getAttribute("src")')).endsWith('-fig1.jpg'));
await key('ArrowRight'); await sleep(150);
check('→ inside the lightbox shows figure 2 and does not change the slide', (await ev('document.getElementById("fig-img").getAttribute("src")')).endsWith('-fig2.jpg') && (await active()) === firstId);
await ev('document.querySelector("#fig-dialog [data-close-dialog]").click()'); await sleep(200);
check('lightbox closes', !(await ev('document.getElementById("fig-dialog").open')));
await key('g'); await sleep(200);
check('G opens the lightbox', await ev('document.getElementById("fig-dialog").open'));
await ev('document.querySelector("#fig-dialog [data-close-dialog]").click()'); await sleep(200);

console.log('Every slide fits a 1280x720 projector');
const ids = await ev('[...document.querySelectorAll(".slide")].map(s=>s.id)');
for (const sid of ids) {
  await ev(`location.hash = '#/${sid}'`); await sleep(800);
  const r = await ev('(() => { const s = document.querySelector(".slide.is-active"); const i = s.querySelector(".slide-inner"); const els=[...s.querySelectorAll("*")]; return { overflow: i.scrollHeight - i.clientHeight, maxRight: Math.round(Math.max(...els.map(e=>e.getBoundingClientRect().right))) }; })()');
  check(`${sid}: no vertical overflow, nothing past the right edge`, r.overflow <= 0 && r.maxRight <= 1280, JSON.stringify(r));
}

console.log('Phone layout (390x844)');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await sleep(600);
for (const sid of ['cover', firstId, 'teleop', 'end']) {
  await ev(`location.hash = '#/${sid}'`); await sleep(900);
  const maxRight = await ev('Math.max(...[...document.querySelector(".slide.is-active").querySelectorAll("*")].map(e=>e.getBoundingClientRect().right))');
  check(`${sid}: nothing extends past the phone's right edge`, maxRight <= 391, String(maxRight));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (problems.length) { console.log('Runtime problems:'); problems.forEach((p) => console.log('  -', p)); }
else console.log('No JS exceptions or console errors.');
ws.close();
process.exit(fail || problems.length ? 1 : 0);
