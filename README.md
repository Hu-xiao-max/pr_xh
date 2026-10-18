# Research showcase — a web page that works like a slide deck

A static, build-free presentation page: cover (opening text + clickable table of contents)
→ one slide per paper → closing. Open it in a browser, press **F** for fullscreen and present
with the keyboard, a clicker, the mouse wheel or touch swipes. Each paper slide shows the TL;DR, key numbers, buttons for
PDF / abstract / BibTeX, Figure 1 and Figure 2 of the paper as an overlapping pair (no
captions, click to enlarge) and the demo videos; videos load only for the slide on screen.
The page is deliberately impersonal (no bio or contact details).

```
index.html                 deck shell: viewport, bottom controls, dialogs
assets/css/style.css       styling (white "clean academic" theme, fits 16:9 projectors and phones)
assets/js/main.js          slide engine: navigation, dialogs, IntersectionObserver video loading
assets/data/papers.js      ← ALL content lives here: cover/closing copy (SITE), paper order, metadata, captions
assets/videos_web/*.mp4    web-optimized videos (H.264, yuv420p, ≤1280 px, +faststart)
assets/posters/*.jpg       poster frames shown before a video is fetched
assets/figures/*.jpg       Figure 1 and 2 of each paper, cut from the PDFs (no captions)
tools/extract_figures.py   re-cuts the figures (needs PyMuPDF, see the file header)
tools/optimize_videos.py   regenerates videos_web/ and posters/ from the paper folders
tools/test_page.mjs        headless-Chrome smoke test (navigation, lazy loading, dialogs, layout)
<paper folders>/           original PDFs and source videos
```

## Presenting

| Action | Keys |
|---|---|
| Next / previous slide | `→` `↓` `Space` `PgDn` / `←` `↑` `PgUp` (clickers send these) |
| Back to the cover / contents | `Home` / `H`, or the **Home** button at the bottom right |
| Last slide | `End` |
| Jump to paper *n* | `1` … `9` |
| Fullscreen | `F` |
| Abstract / BibTeX of the current paper | `A` / `B` |
| Enlarge the paper's figures (← → flips between them) | `G`, or click a figure |
| Play or pause the slide's main video | `V` |
| Shortcut list | `?` |

Short demo clips autoplay (muted) when their slide appears and pause when it leaves; the long
overview videos have native controls and play on click or `V`. Every slide has a URL
(`…/#/uniprototype`) you can share. *File → Print → Save as PDF* exports one slide per page.

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Publish on GitHub Pages

1. Push the repository (branch `main`).
2. GitHub → *Settings* → *Pages* → *Build and deployment*: Source = **Deploy from a branch**,
   Branch = `main`, folder = `/ (root)`.
3. `.nojekyll` is already there so GitHub serves the files as-is.

GitHub rejects single files above 100 MB and warns above 50 MB. The page only uses the
optimized copies in `assets/videos_web/`, so you may exclude the raw videos
(see the commented pattern in `.gitignore`).

## Edit the copy

`SITE` at the top of `assets/data/papers.js` holds the cover headline, intro and contents label (`hero`),
the closing slide (`closing.points`, `closing.thanks`) and `showAuthors` (`false` by default:
author lists stay in the data for BibTeX but are not displayed anywhere). The `<title>` and social-preview tags are at the top of
`index.html`.

## Add or edit a paper

1. Drop the PDF and videos into a folder (e.g. `mypaper/`).
2. Run `python3 tools/optimize_videos.py` (needs `ffmpeg`). Add the folder to the `SLUGS`
   map in the script if you want a nicer output name. Already-converted files are skipped;
   use `--force` to redo them, `--dry-run` to only print the plan, `--posters` to only
   re-create poster frames (per-video timestamps live in `POSTER_AT`).
3. Add an entry to `assets/data/papers.js` — array order = slide order.
   `assets/videos_web/manifest.json` lists the exact `w`/`h`/`duration` values to copy.
   - `media.main` → long/narrated video, shown large with native controls.
   - `media.clips` → short demos, laid out automatically (portrait clips side by side,
     landscape clips stacked). `audio: true` adds an unmute button.
   - `highlights` → up to three key numbers; `tldr` → the one-paragraph pitch.
   - `figures` → `[{src, w, h}]`, normally produced by `tools/extract_figures.py`
     (add the paper to its `PAPERS` map; use `OVERRIDES` for a manual page/rectangle).
     `assets/figures/manifest.json` lists the pixel sizes to copy.
4. Fill in `links.arxiv` / `links.code` when available — buttons appear only when a link is set.

## Video loading policy (performance)

* Every `<video>` is created with `preload="none"` and **no `src`**; the source and poster
  are attached only for the current slide and its neighbours (IntersectionObserver with a
  horizontal margin of one slide).
* Autoplay loops start when at least 25 % of the video is on screen and pause as soon as
  the slide leaves (and when the tab is hidden).
* `prefers-reduced-motion` and the browser's Data Saver disable autoplay (controls are shown instead).

## Test

`tools/test_page.mjs` drives the deck in headless Chrome (Node ≥ 22); run instructions are in
the file header.
