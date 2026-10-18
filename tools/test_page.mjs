// Functional smoke test for the slide deck, driven through the Chrome DevTools Protocol.
// Needs Node >= 22 (global WebSocket) and Google Chrome. Run from the repo root:
//
//   python3 -m http.server 8000 &
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//       --remote-debugging-port=9222 --user-data-dir=/tmp/pr-xh-chrome \
//       --autoplay-policy=no-user-gesture-required about:blank &
//   node tools/test_page.mjs            # CDP_PORT=9223 to use another port
//
// Checks slide generation, keyboard / wheel / hash navigation, dialogs, that videos are
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
check('slides = papers + cover + overview + end', (await ev('document.querySelectorAll(".slide").length')) === nPapers + 3);
check('starts on the cover', (await active()) === 'cover');
check('counter shows 1 / N', (await ev('document.getElementById("current").textContent + "/" + document.getElementById("total").textContent')) === `1/${nPapers + 3}`);
check('inactive slides are inert', (await ev('document.querySelectorAll(".slide[inert]").length')) === nPapers + 2);
check('no video has a src on the cover', (await ev('[...document.querySelectorAll("video")].filter(v=>v.getAttribute("src")).length')) === 0);

console.log('Keyboard navigation');
await key('ArrowRight'); await sleep(300);
check('→ goes to the overview', (await active()) === 'overview');
await key('ArrowRight'); await sleep(1200);
const firstId = await ev('window.PAPERS[0].id');
check('→ goes to the first paper', (await active()) === firstId);
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
await key('Home'); await sleep(300);
check('Home goes back to the cover', (await active()) === 'cover');

console.log('Wheel, hash, overview cards');
await ev('window.dispatchEvent(new WheelEvent("wheel", {deltaY: 120, bubbles: true})); true'); await sleep(300);
check('wheel down advances one slide', (await active()) === 'overview');
await ev('window.dispatchEvent(new WheelEvent("wheel", {deltaY: 120, bubbles: true})); true'); await sleep(100);
check('a second wheel event within the lock window is ignored', (await active()) === 'overview');
await ev('document.querySelector(".toc-card[data-goto=teleop]").click()'); await sleep(1800);
check('overview card jumps to its paper', (await active()) === 'teleop');
const tele = await ev('[...document.querySelectorAll("#teleop video")].map(v=>{const r=v.getBoundingClientRect();return {paused:v.paused,w:Math.round(r.width),h:Math.round(r.height),right:Math.round(r.right),bottom:Math.round(r.bottom)}})');
check('three portrait clips play side by side inside the viewport', tele.length === 3 && tele.every((t) => !t.paused && t.h > t.w && t.right <= 1280 && t.bottom <= 720), JSON.stringify(tele));
await ev('location.hash = "#/object-spin"'); await sleep(900);
check('hash deep link selects the slide', (await active()) === 'object-spin');
check('digit keys ignore out-of-range papers', (await key('9'), await sleep(200), await active()) === 'object-spin');

console.log('Dialogs');
await key('a'); await sleep(300);
check('A opens the abstract dialog', await ev('document.getElementById("info-dialog").open'));
check('abstract text is the current paper\'s', (await ev('document.getElementById("info-body").textContent')).includes('closure-event grasp discovery'));
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
for (const sid of ['cover', 'overview', firstId, 'teleop', 'end']) {
  await ev(`location.hash = '#/${sid}'`); await sleep(900);
  const maxRight = await ev('Math.max(...[...document.querySelector(".slide.is-active").querySelectorAll("*")].map(e=>e.getBoundingClientRect().right))');
  check(`${sid}: nothing extends past the phone's right edge`, maxRight <= 391, String(maxRight));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (problems.length) { console.log('Runtime problems:'); problems.forEach((p) => console.log('  -', p)); }
else console.log('No JS exceptions or console errors.');
ws.close();
process.exit(fail || problems.length ? 1 : 0);
