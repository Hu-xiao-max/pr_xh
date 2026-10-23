# Research showcase — a web page that works like a slide deck

A static, build-free presentation page: cover (opening text + clickable table of contents)
→ one slide per paper → a **Projects** chapter slide → one slide per project → closing. The contents and
the closing list are grouped into sections (**Research** / **Projects**, `SITE.sections` + `section` on each
entry); a section with `divider` gets its chapter slide (title, intro and its own contents), project slides
carry a small "Project" badge and the organisation's name, and have Details / link buttons instead of
PDF / BibTeX. A project can be a web-described robot (XiaoWu) or a demo video of the owner's own
(the construction-waste sorting cell). Open it in a browser, press **F** for fullscreen and present
with the buttons at the bottom, a clicker or the keyboard (wheel and swipe navigation are off by
default so that scrubbing a video never changes the slide; `SITE.navigation` in papers.js turns
them on or the keyboard off). Each paper slide is mostly visual: a text band on top (title, 2–3 bullets, buttons for
PDF / abstract / BibTeX) and, below it, a full-width board of images and demo videos. The text always
comes first, on phones as well, where the board becomes one item per row at its own aspect ratio
(portrait clips are paired). Every paper has its own board composition (`layout` in papers.js),
chosen so that each image is drawn large enough to read. If the text column would not fit the screen, the
text is shortened automatically (smaller type → two-line bullets → third bullet hidden → smaller media).
Images enlarge on click, clips have an enlarge button, and videos load only for the slide on screen.
Neither the conference, the year nor the submission status is shown anywhere on the slides (they stay in the BibTeX).
The page is deliberately impersonal (no bio or contact details).

```
index.html                 deck shell: viewport, bottom controls, dialogs
assets/css/style.css       styling (white "clean academic" theme, fits 16:9 projectors and phones)
assets/js/main.js          slide engine: navigation, dialogs, IntersectionObserver video loading
assets/data/papers.js      ← ALL content lives here: cover/closing copy (SITE), sections, paper/project order, metadata, captions
assets/videos_web/*.mp4    web-optimized videos (H.264, yuv420p, ≤1280 px, +faststart)
assets/posters/*.jpg       poster frames shown before a video is fetched
assets/images/*.jpg        the images from the paper folders, web-sized (tools/optimize_images.py)
tools/extract_figures.py   optional: cuts Figure 1/2 out of a PDF when you have no image for a paper (needs PyMuPDF)
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
| Jump to paper / project *n* | `1` … `9` |
| Fullscreen | `F` |
| Abstract (or project details) / BibTeX of the current slide | `A` / `B` |
| Enlarge the slide's images (← → flips between them) | `G`, or click an image; clips have a ⤢ button |
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

Serve the folder rather than double-clicking `index.html`: a page opened from disk (`file://`) sends no
referrer, and YouTube then refuses to play its embedded clips ("error 153"). Opened that way, the deck
shows a note with a link to the video instead; over http(s), and on GitHub Pages, the clips play inline.

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

## Add a paper with the skill

Drop the PDF, videos and images into a new folder and tell Claude Code (in this repo)
something like "我在 pour/ 里加了新素材，帮我整理到网页上" or run `/add-paper`. The skill in
`.claude/skills/add-paper/` reads the PDF, converts the media, writes the papers.js entry with
bullets, gallery and a per-paper layout, runs the smoke test, checks screenshots at projector,
desktop and phone sizes, and reports the TODOs to confirm. The manual steps are below.

## Add or edit a paper by hand

1. Drop the PDF and videos into a folder (e.g. `mypaper/`).
2. Run `python3 tools/optimize_videos.py` (needs `ffmpeg`). Add the folder to the `SLUGS`
   map in the script if you want a nicer output name. Already-converted files are skipped;
   use `--force` to redo them, `--dry-run` to only print the plan, `--posters` to only
   re-create poster frames (per-video timestamps live in `POSTER_AT`), and `--js <slug>` to print
   a ready-to-paste `media:` block. `tools/optimize_images.py --js <slug>` does the same for `gallery`.
   Two more per-video maps in the script: `SPEED` plays a slow demo faster (e.g. `2.0`; the audio is
   dropped) and `CROP` cuts away empty background (`"w:h:x:y"` in display pixels). Phone clips stored
   with non-square pixels are rescaled to square pixels first, so crops and the page's `w`/`h` always
   refer to what is shown.
3. Add an entry to `assets/data/papers.js` — array order = slide order.
   `assets/videos_web/manifest.json` lists the exact `w`/`h`/`duration` values to copy.
   - `media.main` → long/narrated video, shown large with native controls.
   - `media.clips` → short demos, laid out automatically (portrait clips side by side,
     landscape clips stacked). `audio: true` adds an unmute button.
   - A YouTube video goes in either place as `{ kind: 'youtube', id: '<video id>', label, duration, caption }`:
     the slide shows its thumbnail with a play button, the player (youtube-nocookie.com) loads only when
     clicked, ⤢ opens it large, and it is removed again when the slide leaves.
   - `points` → the 2–3 bullets on the slide. `tldr` and `highlights` are shown in the Abstract dialog.
   - `gallery` → `[{src, w, h}]` images on the slide, in order. Drop PNG/JPEG files into the paper
     folder and run `python3 tools/optimize_images.py`; it writes web-sized copies to `assets/images/`
     and prints the entries. Without a `layout`, tiny images (long side ≤ 600 px) are placed beside
     the bullets and everything else on the board; force a side with `place: 'text'` / `place: 'board'`.
   - `layout` fixes the composition: `mode: 'stack'` places the text band above a full-width
     board (used by every paper here; without it the text sits in a column on the left),
     `text: ['video:0']` puts items under the bullets, `board: { cols, rows, cells: [{ item: 'img:0', span: 2 }, { item: 'video:1' }] }` defines
     the grid (`cols`/`rows` may be counts or track lists like `'2fr 1fr'`; `rowSpan` spans rows). Without `layout`
     the board is composed automatically: images first, then videos; 1–2 items stacked, 3–4 in two
     columns, 5–6 in three; with a spare cell the widest image takes a double-width cell (or a portrait
     item a double-height one); portrait clips go side by side.
4. Fill in `links.arxiv` / `links.code` when available — buttons appear only when a link is set.

## Add a project (not a paper)

Projects go after the papers in the array with `section: 'project'`; the cover contents and the closing
list then show a **Projects** heading. A project entry has no `bibtex` and no `links.pdf` (so no BibTeX /
PDF buttons), names the organisation in `org` (shown as a badge), renames the dialog button with
`infoLabel: 'Details'` and its headings with `abstractLabel` / `highlightsLabel` (e.g. 'Specifications'),
links out through `links.project` (+ `links.projectLabel`) and `links.extra: [{ label, href }]`, and sets
`thumb` for the cover when it has no video poster. Everything else (points, gallery, layout, media) works
as for a paper — see `xiaowu` in papers.js.

## Video loading policy (performance)

* Every `<video>` is created with `preload="none"` and **no `src`**; the source and poster
  are attached only for the current slide and its neighbours (IntersectionObserver with a
  horizontal margin of one slide).
* Autoplay loops start when at least 25 % of the video is on screen and pause as soon as
  the slide leaves (and when the tab is hidden).
* `prefers-reduced-motion` and the browser's Data Saver disable autoplay (controls are shown instead).

## Test

`tools/test_page.mjs` drives the deck in headless Chrome (Node ≥ 22); run instructions are in
the file header (`CDP_PORT` / `BASE_URL` select the Chrome debugging port and the served URL).
`tools/snapshot_slides.mjs` screenshots chosen slides at chosen sizes and prints overflow, bullet
count and the drawn size of every image.
