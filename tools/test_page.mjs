// Functional smoke test for the slide deck, driven through the Chrome DevTools Protocol.
// Needs Node >= 22 (global WebSocket) and Google Chrome. Run from the repo root:
//
//   python3 -m http.server 8000 &
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//       --remote-debugging-port=9222 --user-data-dir=/tmp/pr-xh-chrome \
//       --autoplay-policy=no-user-gesture-required about:blank &
//   node tools/test_page.mjs            # CDP_PORT=9223 / BASE_URL=http://127.0.0.1:8001/ to use other ports
//
// Checks slide generation (cover with contents, one slide per paper with bullets + visual board, closing), keyboard / wheel / hash navigation, dialogs, that videos are
// only attached on the current and neighbouring slides, autoplay + pause-on-leave,
// that every slide fits a 1280x720 projector without scrolling, and the phone layout.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.env.CDP_PORT || 9222;
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000/';
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
await send('Page.navigate', { url: BASE });
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
check('three teleop clips play side by side inside the viewport', tele.length === 3 && tele.every((t) => !t.paused && t.right <= 1280 && t.bottom <= 720) && new Set(tele.map((t) => Math.round(t.bottom))).size === 1, JSON.stringify(tele));
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

console.log('Images, bullets, status text');
check('every gallery image is on its slide (beside the text or on the board)', await ev('window.PAPERS.every(p=>document.querySelectorAll("#"+p.id+" [data-gallery]").length===(p.gallery||[]).length)'));
check('only images from the paper folders are used (assets/images)', await ev('[...document.querySelectorAll(".slide-paper [data-gallery] img")].every(i=>i.getAttribute("src").startsWith("assets/images/"))'));
check('every paper slide shows at least one video (on the board or under the bullets)', await ev('[...document.querySelectorAll(".slide-paper")].every(s=>s.querySelectorAll("video").length>=1)'));
check('text is condensed to 2-3 bullets, no TL;DR paragraph or key-number tiles', await ev('[...document.querySelectorAll(".slide-paper")].every(s=>{const n=s.querySelectorAll(".points li").length; return n>=2&&n<=3&&!s.querySelector(".tldr")&&!s.querySelector(".highlights")})'));
check('no submission-status text anywhere in the deck', !/Under review|Accepted|Workshop paper|Presentation|double-blind|Submitted to/.test(await ev('document.getElementById("track").textContent')) && (await ev('document.querySelectorAll(".track [class*=status-]").length')) === 0);
check('no conference names anywhere in the deck', !/IROS|ICRA|ICLR|ICIR|Advanced Robotics Research|Workshop|Wiley/.test(await ev('document.getElementById("track").textContent')) && (await ev('document.querySelectorAll(".track .badge.venue").length')) === 0);
check('no venue or year badges remain on the slides', (await ev('document.querySelectorAll(".slide-paper .badge, #cover .badge, #end .badge").length')) === 0 && !/\b20(2[5-9])\b/.test(await ev('[...document.querySelectorAll(".slide-paper .badges, #cover .toc-list")].map(e=>e.textContent).join(" ")')));
check('every paper slide puts the text band above a full-width board', await ev('window.PAPERS.every(p => { const s = document.getElementById(p.id); const t = s.querySelector(".paper-text").getBoundingClientRect(); const b = s.querySelector(".board").getBoundingClientRect(); const c = s.querySelector(".slide-content").getBoundingClientRect(); return t.bottom <= b.top + 1 && b.width >= c.width * .98 && b.height >= c.height * .55; })'));
check('01: image on the left, video on the right', await ev('(() => { const im = document.querySelector("#uniprototype .board .cell-img").getBoundingClientRect(); const v = document.querySelector("#uniprototype .board .cell-video").getBoundingClientRect(); return im.right <= v.left + 1 && Math.abs(im.top - v.top) < 2; })()'));
check('05: figure spans both rows on the left, clips stacked on the right', await ev('(() => { const im = document.querySelector("#physgrasp .board .cell-img").getBoundingClientRect(); const vs = [...document.querySelectorAll("#physgrasp .board .cell-video")].map(e => e.getBoundingClientRect()); return vs.length === 2 && vs.every(v => v.left > im.right) && vs[1].top > vs[0].bottom && im.height > vs[0].height * 1.8; })()'));
await sleep(600);
const legible = await ev('(() => { const out = []; document.querySelectorAll(".slide-paper [data-gallery] img").forEach(img => { const b = img.getBoundingClientRect(); const ar = img.naturalWidth / Math.max(1, img.naturalHeight); const w = Math.min(b.width, b.height * ar), h = w / ar; out.push({ id: img.closest(".slide").id, src: img.getAttribute("src").split("/").pop(), w: Math.round(w), h: Math.round(h) }); }); return out; })()');
const nImages = await ev('window.PAPERS.reduce((n,p)=>n+(p.gallery||[]).length,0)');
check('every image is drawn at a legible size (≥ 300 px wide or ≥ 260 px tall at 1280x720)', legible.length === nImages && legible.every((o) => o.w >= 300 || o.h >= 260), JSON.stringify(legible));
check('wide strips are drawn wide (physgrasp interaction ≥ 700 px, tactile ex2 ≥ 550 px)', legible.some((o) => /^physgrasp-interaction/.test(o.src) && o.w >= 700) && legible.some((o) => /ex2/.test(o.src) && o.w >= 550), JSON.stringify(legible.filter((o) => /^physgrasp-interaction|ex2/.test(o.src))));
check('explicit layouts are applied (01 has exactly one image cell and one video cell)', (await ev('document.querySelectorAll("#uniprototype .board .cell-img").length')) === 1 && (await ev('document.querySelectorAll("#uniprototype .board .cell-video").length')) === 1);
check('teleop without images still gets its three clips side by side', (await ev('document.querySelectorAll("#teleop .board .cell-video").length')) === 3 && (await ev('getComputedStyle(document.querySelector("#teleop .board")).gridTemplateColumns.split(" ").length')) === 3);
await ev('location.hash = "#/pixelpoint-rl"'); await sleep(1500);
check('images are loaded on the active slide', await ev('[...document.querySelectorAll(".slide.is-active [data-gallery] img")].every(i=>i.complete&&i.naturalWidth>0)'));
check('the board takes most of the slide height without overflowing it', await ev('(() => { const inner = document.querySelector(".slide.is-active .slide-inner"); const cs = getComputedStyle(inner); const content = inner.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); const b = document.querySelector(".slide.is-active .board").getBoundingClientRect(); const i = inner.getBoundingClientRect(); return b.height > content * .6 && b.bottom <= i.bottom + 1; })()'));
check('all three bullets are visible on the stacked slide at 1280x720', (await ev('[...document.querySelectorAll(".slide.is-active .points li")].filter(li => getComputedStyle(li).display !== "none").length')) === 3);
await ev('document.querySelector(".slide.is-active .cell-img").click()'); await sleep(300);
check('clicking an image opens the lightbox on it', (await ev('document.getElementById("fig-dialog").open')) && (await ev('document.getElementById("fig-img").getAttribute("src")')) === (await ev('document.querySelector(".slide.is-active .cell-img img").getAttribute("src")')));
await key('ArrowRight'); await sleep(150);
check('→ inside the lightbox shows the next image of the gallery and does not change the slide', (await ev('document.getElementById("fig-img").getAttribute("src")')) === (await ev('window.PAPERS.find(p=>p.id==="pixelpoint-rl").gallery[1].src')) && (await active()) === 'pixelpoint-rl');
await ev('document.querySelector("#fig-dialog [data-close-dialog]").click()'); await sleep(200);
check('lightbox closes', !(await ev('document.getElementById("fig-dialog").open')));
await key('g'); await sleep(200);
check('G opens the lightbox', await ev('document.getElementById("fig-dialog").open'));
await ev('document.querySelector("#fig-dialog [data-close-dialog]").click()'); await sleep(200);
await ev('location.hash = "#/tactile-grasp"'); await sleep(1200);
check('tactile: photos span two rows on the left, strip across the top right, both clips below it', (await ev('document.querySelectorAll("#tactile-grasp .board .cell").length')) === 4 && (await ev(`(() => { const ph = document.querySelector("#tactile-grasp .cell-img[data-gallery-index='1']").getBoundingClientRect(); const st = document.querySelector("#tactile-grasp .cell-img[data-gallery-index='0']").getBoundingClientRect(); const vs = [...document.querySelectorAll("#tactile-grasp .cell-video")].map(e => e.getBoundingClientRect()); return ph.height > st.height * 1.8 && st.left > ph.right && vs.every(v => v.top > st.bottom && v.left > ph.right); })()`)));
await ev('location.hash = "#/teleop"'); await sleep(1500);
await ev('document.querySelector("#teleop [data-expand]").click()'); await sleep(700);
check('a clip\'s expand button opens it as a video in the lightbox', (await ev('document.getElementById("fig-dialog").open')) && !(await ev('document.getElementById("fig-video").hidden')) && (await ev('document.getElementById("fig-video").getAttribute("src") || ""')).includes('teleop-'));
await ev('document.querySelector("#fig-dialog [data-close-dialog]").click()'); await sleep(300);
check('closing the lightbox stops and unloads its video', await ev('document.getElementById("fig-video").paused && !document.getElementById("fig-video").getAttribute("src")'));
await ev(`location.hash = '#/${firstId}'`); await sleep(800);

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
for (const sid of ['cover'].concat(await ev('window.PAPERS.map(p=>p.id)'), ['end'])) {
  await ev(`location.hash = '#/${sid}'`); await sleep(900);
  const maxRight = await ev('Math.max(...[...document.querySelector(".slide.is-active").querySelectorAll("*")].map(e=>e.getBoundingClientRect().right))');
  check(`${sid}: nothing extends past the phone's right edge`, maxRight <= 391, String(maxRight));
}
check('phone: on every paper slide the text comes first, then the media', await ev('window.PAPERS.every(p => { const s = document.getElementById(p.id); const t = s.querySelector(".paper-text").getBoundingClientRect(); const b = s.querySelector(".board").getBoundingClientRect(); return t.bottom <= b.top + 1; })'));
check('phone: board cells are full width (portrait clips paired) and keep their aspect ratio', await ev('window.PAPERS.every(p => [...document.querySelectorAll("#" + p.id + " .board .cell")].every(c => { const r = c.getBoundingClientRect(); const ar = parseFloat(c.style.getPropertyValue("--ar")); const full = r.width >= 340; const half = r.width >= 160 && r.width < 200; return (c.classList.contains("cell-tall") ? half : full) && Math.abs(r.width / r.height - ar) < 0.05; }))'));

console.log(`\n${pass} passed, ${fail} failed`);
if (problems.length) { console.log('Runtime problems:'); problems.forEach((p) => console.log('  -', p)); }
else console.log('No JS exceptions or console errors.');
ws.close();
process.exit(fail || problems.length ? 1 : 0);
