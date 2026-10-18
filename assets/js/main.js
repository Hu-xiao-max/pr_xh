/* =============================================================================
   main.js — slide-deck engine for the research showcase.

   Slides: cover → overview (table of contents) → one slide per paper → closing.
   • Navigation: ← → ↑ ↓ Space PgUp PgDn Home End, mouse wheel, touch swipe,
     on-screen arrows, dots, Home button (Home / H), 1-9 jump to paper n, O overview, F fullscreen,
     A abstract of the current paper, V play/pause its main video, ? help.
   • URL hash (#/paper-id) deep-links to a slide.
   • Videos: created with preload="none" and no src. An IntersectionObserver
     attaches src/poster when a slide is next to the current one, autoplays
     muted loops when the slide is on screen (≥25 % visible) and pauses them as
     soon as the slide leaves. Long overview videos keep native controls and
     only play on request.
   Vanilla JS, no dependencies, no build step.
   ============================================================================= */
(function () {
  'use strict';

  const PAPERS = Array.isArray(window.PAPERS) ? window.PAPERS : [];
  const SITE = window.SITE || {};

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');

  const REDUCE_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SAVE_DATA = !!(navigator.connection && navigator.connection.saveData);
  const AUTOPLAY_OK = !REDUCE_MOTION && !SAVE_DATA;

  /* ---------------------------------------------------------------- icons */
  const svg = (inner, filled) => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ' +
    (filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"') +
    '>' + inner + '</svg>';
  const ICONS = {
    pdf: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>'),
    abstract: svg('<path d="M21 6H3"/><path d="M15 12H3"/><path d="M17 18H3"/>'),
    bibtex: svg('<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>'),
    arxiv: svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
    code: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
    link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    play: svg('<path d="M8 5v14l11-7z"/>', true),
    sound: svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>'),
    mute: svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>'),
  };

  /* -------------------------------------------------------------- helpers */
  function fmtDuration(sec) {
    if (!sec || !isFinite(sec)) return '';
    const s = Math.round(sec);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function copyText(text) {
    const legacy = () => new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); }
      catch (e) { reject(e); }
      finally { ta.remove(); }
    });
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(legacy);
    return legacy();
  }
  const thumbOf = (p) => p.thumb || (p.media && ((p.media.main && p.media.main.poster) ||
    (p.media.clips && p.media.clips[0] && p.media.clips[0].poster))) || '';
  const nVideos = PAPERS.reduce((n, p) => n + ((p.media && p.media.main) ? 1 : 0) + ((p.media && p.media.clips) ? p.media.clips.length : 0), 0);
  const nReal = PAPERS.filter((p) => (p.topics || []).includes('Real Robot')).length;

  /* ------------------------------------------------------------ templates */
  function authorsPlain(p) {
    if (!p.authors || !p.authors.length) return '<span class="authors-anon">' + esc(p.authorsNote || 'Author list withheld (double-blind review)') + '</span>';
    return p.authors.map((a) => esc(a.name) + (a.corresponding ? '<sup>*</sup>' : '')).join(', ');
  }
  function authorsFull(p) {
    if (!p.authors || !p.authors.length) return '<p>' + esc(p.authorsNote || 'Author list withheld (double-blind review)') + '</p>';
    const names = p.authors.map((a) => {
      const sup = (a.affil || []).join(',') + (a.corresponding ? '*' : '');
      return esc(a.name) + (sup ? '<sup>' + esc(sup) + '</sup>' : '');
    }).join(', ');
    const affils = (p.affiliations || []).map((a, i) => '<sup>' + (i + 1) + '</sup>' + esc(a)).join(' · ') +
      (p.affiliationsNote ? ' · ' + esc(p.affiliationsNote) : '');
    return '<p>' + names + '</p>' + (affils ? '<p class="affils">' + affils + '</p>' : '');
  }

  // One <video> in a ratio-locked frame. `caption` is trusted HTML from papers.js.
  function videoHTML(v, opts) {
    opts = opts || {};
    const w = v.w || 16, h = v.h || 9;
    const isLoop = v.kind !== 'overview';
    const attrs = [
      'playsinline', 'preload="none"',
      isLoop ? 'muted loop' : 'controls',
      (isLoop && !AUTOPLAY_OK) ? 'controls' : '',
      (isLoop && AUTOPLAY_OK) ? 'data-autoplay' : '',
      'data-src="' + esc(v.src) + '"',
      v.poster ? 'data-poster="' + esc(v.poster) + '"' : '',
      'width="' + w + '" height="' + h + '"',
      'aria-label="' + esc(v.alt || v.label || 'Demo video') + '"',
      'disablepictureinpicture',
    ].filter(Boolean).join(' ');
    const overlays = [
      v.label ? '<span class="vlabel">' + esc(v.label) + '</span>' : '',
      v.duration ? '<span class="vbadge">' + fmtDuration(v.duration) + '</span>' : '',
      (isLoop && v.audio) ? '<button class="vsound" type="button" aria-label="Unmute" data-sound>' + ICONS.mute + '</button>' : '',
      '<button class="vplay" type="button" aria-label="Play video" data-play>' + ICONS.play + '</button>',
    ].join('');
    return '<figure class="vfig' + (opts.main ? ' vfig-main' : '') + '">' +
      '<div class="vframe" style="aspect-ratio:' + w + ' / ' + h + ';--ar:' + (w / h).toFixed(4) + '">' +
      '<video ' + attrs + '></video>' + overlays + '</div>' +
      (v.caption ? '<figcaption>' + v.caption + '</figcaption>' : '') +
      '</figure>';
  }

  function mediaHTML(p) {
    const m = p.media || {};
    const clips = m.clips || [];
    if (m.main) return '<div class="media-main">' + videoHTML(m.main, { main: true }) + '</div>';
    if (!clips.length) return '<div class="media-empty">No video yet</div>';
    const n = clips.length;
    const portrait = clips.every((c) => (c.h || 0) > (c.w || 0));
    let cols, rows;
    if (portrait) { cols = Math.min(n, 4); rows = Math.ceil(n / cols); }
    else if (n === 1) { cols = 1; rows = 1; }
    else if (n === 2) { cols = 1; rows = 2; }
    else { cols = 2; rows = Math.ceil(n / 2); }
    return '<div class="vgrid" style="--cols:' + cols + ';--rows:' + rows + '">' + clips.map((c) => videoHTML(c)).join('') + '</div>';
  }

  function btnHTML(href, label, icon, cls) {
    return '<a class="btn ' + (cls || '') + '" href="' + esc(href) + '" target="_blank" rel="noopener">' + icon + '<span>' + esc(label) + '</span></a>';
  }

  function coverHTML() {
    const h = SITE.hero || {};
    const posters = PAPERS.map(thumbOf).filter(Boolean).slice(0, 6);
    return '<section class="slide slide-cover" id="cover" aria-label="Title">' +
      '<div class="slide-inner"><div class="slide-content cover-grid">' +
        '<div class="cover-text">' +
          '<p class="eyebrow">' + esc(h.eyebrow || 'Research highlights') + '</p>' +
          '<h1>' + esc(h.title || 'Research highlights') + (h.accent ? ' <span>' + esc(h.accent) + '</span>' : '') + '</h1>' +
          '<p class="lede">' + esc(h.intro || '') + '</p>' +
          '<div class="stats">' +
            '<div class="stat"><b>' + PAPERS.length + '</b><span>papers</span></div>' +
            '<div class="stat"><b>' + nVideos + '</b><span>demo videos</span></div>' +
            '<div class="stat"><b>' + nReal + '</b><span>real-robot studies</span></div>' +
          '</div>' +
          '<p class="hint"><span>Press</span> <kbd>→</kbd> <span>or</span> <kbd>Space</kbd> <span>to begin (swipe on touch screens)</span><span>·</span><kbd>F</kbd> <span>fullscreen</span><span>·</span><kbd>?</kbd> <span>shortcuts</span></p>' +
        '</div>' +
        '<div class="cover-mosaic" aria-hidden="true">' + posters.map((src) => '<img src="' + esc(src) + '" alt="" decoding="async">').join('') + '</div>' +
      '</div></div></section>';
  }

  function tocHTML() {
    const cards = PAPERS.map((p, i) =>
      '<button type="button" class="toc-card" data-goto="' + esc(p.id) + '">' +
        '<div class="toc-thumb">' + (thumbOf(p) ? '<img src="' + esc(thumbOf(p)) + '" alt="" decoding="async">' : '') +
        '<span class="toc-num">' + pad2(i + 1) + '</span></div>' +
        '<div class="toc-body"><div><span class="badge venue">' + esc(p.venue) + '</span></div>' +
        '<div class="toc-title">' + esc(p.shortTitle || p.title) + '</div>' +
        '<div class="toc-meta">' + esc(p.year) + (p.status ? ' · ' + esc(p.status.label) : '') + '</div></div>' +
      '</button>').join('');
    return '<section class="slide slide-toc" id="overview" aria-label="Overview">' +
      '<div class="slide-inner"><div class="slide-content">' +
        '<header class="slide-head"><p class="eyebrow">Overview</p><h2>' + PAPERS.length + ' papers, ' + nVideos + ' demos — click any card to jump in</h2></header>' +
        '<div class="toc-grid">' + cards + '</div>' +
      '</div></div></section>';
  }

  function paperSlideHTML(p, i) {
    const links = p.links || {};
    const status = p.status ? '<span class="badge status-' + esc(p.status.key) + '">' + esc(p.status.label) + '</span>' : '';
    const tags = (p.tags || []).slice(0, 6).map((t) => '<span class="tag">' + esc(t) + '</span>').join('');
    const highlights = (p.highlights || []).length
      ? '<ul class="highlights" aria-label="Key results">' + p.highlights.slice(0, 3).map((h) =>
          '<li><strong title="' + esc(h.value) + '">' + esc(h.value) + '</strong><span>' + esc(h.label) + '</span></li>').join('') + '</ul>'
      : '';
    return '<section class="slide slide-paper" id="' + esc(p.id) + '" data-paper="' + i + '" aria-label="' + esc(p.shortTitle || p.title) + '">' +
      '<div class="slide-inner"><div class="slide-content paper-grid">' +
        '<div class="paper-text">' +
          '<div class="badges"><span class="num">' + pad2(i + 1) + '</span><span class="badge venue">' + esc(p.venue) + '</span>' + status + '<span class="badge year">' + esc(p.year) + '</span></div>' +
          '<h2 class="paper-title">' + esc(p.title) + '</h2>' +
          (SITE.showAuthors === false ? '' : '<p class="authors">' + authorsPlain(p) + '</p>') +
          (p.tldr ? '<div class="tldr"><span class="tldr-label">TL;DR</span><p>' + esc(p.tldr) + '</p></div>' : '') +
          highlights +
          '<div class="actions">' +
            (links.pdf ? btnHTML(links.pdf, links.pdfLabel || 'Paper PDF', ICONS.pdf, 'btn-dark') : '') +
            '<button class="btn" type="button" data-abstract="' + esc(p.id) + '">' + ICONS.abstract + '<span>Abstract</span></button>' +
            '<button class="btn" type="button" data-bibtex="' + esc(p.id) + '">' + ICONS.bibtex + '<span>BibTeX</span></button>' +
            (links.arxiv ? btnHTML(links.arxiv, 'arXiv', ICONS.arxiv) : '') +
            (links.code ? btnHTML(links.code, 'Code', ICONS.code) : '') +
            (links.project ? btnHTML(links.project, 'Project page', ICONS.link) : '') +
          '</div>' +
          (tags ? '<div class="tags">' + tags + '</div>' : '') +
        '</div>' +
        '<div class="paper-media">' + mediaHTML(p) + '</div>' +
      '</div></div></section>';
  }

  function endHTML() {
    const c = SITE.closing || {};
    const points = (c.points || []).map((pt, i) =>
      '<li><span class="num">' + pad2(i + 1) + '</span><div><strong>' + esc(pt.lead) + '</strong> ' + esc(pt.text) + '</div></li>').join('');
    const list = PAPERS.map((p) =>
      '<button type="button" class="end-item" data-goto="' + esc(p.id) + '"><span class="badge venue">' + esc(p.venue) + '</span><span>' + esc(p.shortTitle || p.title) + '</span></button>').join('');
    return '<section class="slide slide-end" id="end" aria-label="Summary">' +
      '<div class="slide-inner"><div class="slide-content end-grid">' +
        '<div class="end-text"><p class="eyebrow">' + esc(c.eyebrow || 'In short') + '</p><h2>' + esc(c.title || 'Takeaways') + '</h2>' +
          (points ? '<ol class="takeaways">' + points + '</ol>' : '') +
          '<p class="thanks">' + esc(c.thanks || 'Thank you') + '</p></div>' +
        '<div class="end-list"><p class="section-label">Papers in this deck</p>' + list + '</div>' +
      '</div></div></section>';
  }

  /* ------------------------------------------------------------ the deck */
  const deck = { slides: [], ids: [], index: 0, started: false };
  const track = () => $('#track');

  function buildDeck() {
    track().innerHTML = coverHTML() + tocHTML() + PAPERS.map(paperSlideHTML).join('') + endHTML();
    deck.slides = $$('.slide', track());
    deck.ids = deck.slides.map((s) => s.id);
    $('#dots').innerHTML = deck.slides.map((s, i) =>
      '<button class="dot" type="button" data-goto-index="' + i + '" aria-label="' + esc(s.getAttribute('aria-label') || s.id) + '" title="' + esc(s.getAttribute('aria-label') || s.id) + '"></button>').join('');
    $('#total').textContent = String(deck.slides.length);
  }

  function goTo(i, opts) {
    opts = opts || {};
    i = Math.max(0, Math.min(deck.slides.length - 1, i | 0));
    if (deck.started && i === deck.index) return;
    deck.index = i; deck.started = true;
    track().style.setProperty('--i', String(i));
    deck.slides.forEach((s, k) => {
      const active = k === i;
      s.classList.toggle('is-active', active);
      if (active) s.removeAttribute('inert'); else s.setAttribute('inert', '');
      s.setAttribute('aria-hidden', String(!active));
    });
    $$('.dot').forEach((d, k) => { d.classList.toggle('is-active', k === i); d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    $('#current').textContent = String(i + 1);
    $('#progress').style.width = ((i + 1) / deck.slides.length * 100) + '%';
    $('#prev').disabled = i === 0;
    $('#next').disabled = i === deck.slides.length - 1;
    $('#home').disabled = i === 0;
    const inner = $('.slide-inner', deck.slides[i]);
    if (inner) inner.scrollTop = 0;
    // Pre-attach src + poster on the neighbouring slides (no media bytes are fetched: preload="none").
    [i - 1, i + 1].forEach((k) => { if (deck.slides[k]) $$('video[data-src]', deck.slides[k]).forEach(video.load); });
    if (!opts.silent) history.replaceState(null, '', '#/' + deck.ids[i]);
    document.title = (i === 0 ? '' : (deck.slides[i].getAttribute('aria-label') + ' · ')) + (SITE.pageTitle || 'Research Highlights');
  }
  const go = (d) => goTo(deck.index + d);
  const goToId = (id) => { const i = deck.ids.indexOf(id); if (i >= 0) goTo(i); };
  const indexFromHash = () => { const id = decodeURIComponent(location.hash.replace(/^#\/?/, '')); const i = deck.ids.indexOf(id); return i < 0 ? 0 : i; };
  const currentPaper = () => { const s = deck.slides[deck.index]; return s && s.dataset.paper != null ? PAPERS[+s.dataset.paper] : null; };
  const dialogOpen = () => !!$('dialog[open]');

  /* -------------------------------------------------------------- dialogs */
  function openDialog(d) { if (!d) return; if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', ''); }
  function closeDialog(d) { if (!d) return; if (typeof d.close === 'function') { if (d.open) d.close(); } else d.removeAttribute('open'); }

  function openAbstract(p) {
    if (!p) return;
    const d = $('#info-dialog');
    $('#info-title').textContent = p.title;
    $('#info-sub').textContent = p.venueFull || p.venue || '';
    $('#info-body').innerHTML =
      (SITE.showAuthors === false ? '' : '<h4>Authors</h4>' + authorsFull(p)) +
      '<h4>' + esc(p.abstractLabel || 'Abstract') + '</h4><p>' + esc(p.abstract || '') + '</p>' +
      ((p.tags || []).length ? '<h4>Keywords</h4><p>' + p.tags.map(esc).join(' · ') + '</p>' : '');
    openDialog(d);
  }

  let currentBibtex = '';
  function openBibtex(p) {
    if (!p) return;
    currentBibtex = String(p.bibtex || '').trim();
    $('#bibtex-text').textContent = currentBibtex;
    $('#bibtex-title').textContent = p.shortTitle || p.title;
    openDialog($('#bibtex-dialog'));
  }

  /* --------------------------------------------------------------- videos */
  const video = { load: () => {}, pauseAll: () => {} };

  function setupVideos() {
    const videos = $$('video[data-src]');
    const frameOf = (v) => v.closest('.vframe');
    function load(v) {
      if (!v || v.dataset.loaded) return;
      v.dataset.loaded = '1';
      if (v.dataset.poster && !v.getAttribute('poster')) v.setAttribute('poster', v.dataset.poster);
      v.src = v.dataset.src;                     // preload="none" ⇒ nothing downloads until play()
    }
    function pause(v) { if (!v.paused && !v.ended) v.pause(); }
    function tryPlay(v) {
      if (!v.hasAttribute('data-autoplay')) return;
      load(v);
      v.muted = true;
      const pr = v.play();
      if (pr && typeof pr.catch === 'function') pr.catch(() => frameOf(v).classList.add('needs-tap'));
    }
    function setMuted(v, muted) {
      v.muted = muted;
      const b = $('[data-sound]', v.parentElement);
      if (!b) return;
      b.classList.toggle('is-on', !muted);
      b.innerHTML = muted ? ICONS.mute : ICONS.sound;
      b.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    }
    video.load = load;
    video.pauseAll = () => videos.forEach(pause);

    videos.forEach((v) => {
      const frame = frameOf(v);
      if (!v.hasAttribute('loop')) frame.classList.add('is-overview');
      v.addEventListener('playing', () => { frame.classList.add('is-playing', 'has-played'); frame.classList.remove('needs-tap'); });
      v.addEventListener('pause', () => frame.classList.remove('is-playing'));
      v.addEventListener('error', () => { frame.classList.add('has-error'); frame.classList.remove('needs-tap'); });
    });

    if (!('IntersectionObserver' in window)) { videos.forEach((v) => { load(v); v.controls = true; }); return; }

    // 1) Slides next to the current one: attach poster + src so they start instantly.
    const near = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { load(e.target); near.unobserve(e.target); } });
    }, { rootMargin: '0px 100% 0px 100%' });

    // 2) On screen: start autoplay loops; off screen: pause whatever is playing.
    const visible = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const v = e.target;
        v.dataset.inView = e.isIntersecting ? '1' : '';
        if (!e.isIntersecting) { pause(v); return; }
        if (e.intersectionRatio >= 0.25) tryPlay(v);
      });
    }, { threshold: [0, 0.25, 0.6] });

    videos.forEach((v) => { near.observe(v); visible.observe(v); });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) videos.forEach(pause);
      else videos.forEach((v) => { if (v.dataset.inView) tryPlay(v); });
    });

    document.addEventListener('click', (ev) => {
      const playBtn = ev.target.closest('[data-play]');
      if (playBtn) {
        const v = $('video', playBtn.parentElement);
        load(v);
        if (v.hasAttribute('loop')) v.muted = true; else v.controls = true;
        const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
        return;
      }
      const soundBtn = ev.target.closest('[data-sound]');
      if (soundBtn) {
        const v = $('video', soundBtn.parentElement);
        load(v);
        const wantSound = v.muted;
        videos.forEach((o) => { if (o !== v && o.hasAttribute('loop') && !o.muted) setMuted(o, true); });
        setMuted(v, !wantSound);
        if (wantSound && v.paused) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
      }
    });
  }

  function toggleMainVideo() {
    const s = deck.slides[deck.index];
    const v = s && ($('.media-main video', s) || $('video', s));
    if (!v) return;
    video.load(v);
    if (v.paused) { if (!v.hasAttribute('loop')) v.controls = true; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
    else v.pause();
  }

  /* ---------------------------------------------------------- fullscreen */
  const root = document.documentElement;
  const canFullscreen = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  function toggleFullscreen() {
    if (!canFullscreen) { toast('Fullscreen is not available in this browser'); return; }
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    if (active) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => {
    $('#fs').classList.toggle('is-on', !!(document.fullscreenElement || document.webkitFullscreenElement));
  }));

  /* ---------------------------------------------------------------- input */
  function setupInput() {
    // Clicks (delegated)
    document.addEventListener('click', (ev) => {
      const t = ev.target;
      const gotoEl = t.closest('[data-goto]');
      if (gotoEl) { ev.preventDefault(); goToId(gotoEl.dataset.goto); return; }
      const dot = t.closest('[data-goto-index]');
      if (dot) { goTo(+dot.dataset.gotoIndex); return; }
      if (t.closest('#prev')) { go(-1); return; }
      if (t.closest('#next')) { go(1); return; }
      if (t.closest('#home')) { goTo(0); return; }
      if (t.closest('#fs')) { toggleFullscreen(); return; }
      if (t.closest('#help-btn')) { openDialog($('#help-dialog')); return; }
      const abs = t.closest('[data-abstract]');
      if (abs) { openAbstract(PAPERS.find((p) => p.id === abs.dataset.abstract)); return; }
      const bib = t.closest('[data-bibtex]');
      if (bib) { openBibtex(PAPERS.find((p) => p.id === bib.dataset.bibtex)); return; }
      if (t.closest('[data-copy-bibtex]')) {
        copyText(currentBibtex).then(() => toast('BibTeX copied to clipboard')).catch(() => toast('Copy failed — please select the text manually'));
        return;
      }
      if (t.closest('[data-close-dialog]')) { closeDialog(t.closest('dialog')); return; }
      if (t.tagName === 'DIALOG') closeDialog(t);          // click on the backdrop
    });

    // Keyboard
    window.addEventListener('keydown', (ev) => {
      if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (dialogOpen()) return;                               // Esc is handled by <dialog> itself
      const tag = (ev.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || ev.target.isContentEditable) return;
      const onControl = tag === 'button' || tag === 'a' || tag === 'video' || tag === 'summary';
      const k = ev.key;
      if ((k === ' ' || k === 'Enter') && onControl) return;  // let buttons/links/video controls work
      switch (k) {
        case 'ArrowRight': case 'ArrowDown': case 'PageDown': case 'Enter': ev.preventDefault(); go(1); return;
        case ' ': ev.preventDefault(); go(ev.shiftKey ? -1 : 1); return;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': ev.preventDefault(); go(-1); return;
        case 'Home': ev.preventDefault(); goTo(0); return;
        case 'End': ev.preventDefault(); goTo(deck.slides.length - 1); return;
        case 'h': case 'H': goTo(0); return;
        case 'f': case 'F': toggleFullscreen(); return;
        case 'o': case 'O': goToId('overview'); return;
        case 'a': case 'A': openAbstract(currentPaper()); return;
        case 'b': case 'B': openBibtex(currentPaper()); return;
        case 'v': case 'V': toggleMainVideo(); return;
        case '?': openDialog($('#help-dialog')); return;
        default:
          if (/^[1-9]$/.test(k)) { const i = deck.ids.indexOf((PAPERS[+k - 1] || {}).id); if (i >= 0) goTo(i); }
      }
    });

    // Mouse wheel / trackpad: one slide per gesture, but let an overflowing slide scroll first.
    let wheelLock = 0;
    window.addEventListener('wheel', (ev) => {
      if (dialogOpen()) return;
      const scroller = ev.target.closest && ev.target.closest('.slide-inner');
      if (scroller && scroller.scrollHeight > scroller.clientHeight + 2) {
        const atTop = scroller.scrollTop <= 0;
        const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        if ((ev.deltaY > 0 && !atBottom) || (ev.deltaY < 0 && !atTop)) return;
      }
      const d = Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX;
      if (Math.abs(d) < 24) return;
      const now = Date.now();
      if (now - wheelLock < 850) return;
      wheelLock = now;
      go(d > 0 ? 1 : -1);
    }, { passive: true });

    // Touch swipe (horizontal)
    let tx = 0, ty = 0, t0 = 0;
    window.addEventListener('touchstart', (ev) => { const t = ev.touches[0]; tx = t.clientX; ty = t.clientY; t0 = Date.now(); }, { passive: true });
    window.addEventListener('touchend', (ev) => {
      if (dialogOpen()) return;
      const t = ev.changedTouches[0];
      const dx = t.clientX - tx, dy = t.clientY - ty;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - t0 < 900) go(dx < 0 ? 1 : -1);
    }, { passive: true });

    // The page must never scroll on its own (e.g. when something inside gets focus).
    const vp = $('#viewport');
    vp.addEventListener('scroll', () => { vp.scrollLeft = 0; vp.scrollTop = 0; }, { passive: true });
    window.addEventListener('scroll', () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); }, { passive: true });

    window.addEventListener('hashchange', () => goTo(indexFromHash(), { silent: true }));
  }

  /* ----------------------------------------------------------- idle HUD */
  function setupIdle() {
    let timer = 0;
    const wake = () => {
      document.body.classList.remove('is-idle');
      clearTimeout(timer);
      timer = setTimeout(() => document.body.classList.add('is-idle'), 3500);
    };
    ['mousemove', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    wake();
  }

  /* ----------------------------------------------------------------- boot */
  function boot() {
    buildDeck();
    setupVideos();
    setupInput();
    setupIdle();
    if (!canFullscreen) $('#fs').classList.add('is-hidden');
    goTo(indexFromHash(), { silent: true });
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('is-ready')));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
