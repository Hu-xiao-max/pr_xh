# papers.js entry: template, text style, layout cookbook

## Annotated template

```js
  {
    id: 'pour-tactile',                 // slug: also the URL (#/pour-tactile) and the asset prefix
    shortTitle: 'Tactile Pouring',      // cover contents + closing list
    navTitle: 'Pouring',                // reserved for a nav bar; keep ≤ 2 words
    title: 'Learning to Pour from Tactile Feedback',
    venue: 'ICRA 2027',                 // data only — never rendered
    venueFull: 'Submitted to … (ICRA)', // data only
    year: 2027,                         // data only
    status: { key: 'review', label: 'Under review' },   // data only
    authors: [{ name: 'A. Author', affil: [1] }],        // BibTeX source only (SITE.showAuthors = false)
    affiliations: ['Some University'],
    topics: ['Reinforcement Learning', 'Real Robot'],   // optional filtering later
    tags: ['Tactile sensing', 'Pouring', 'Franka'],     // keywords in the Abstract dialog
    points: [                                            // 2–3 bullets shown on the slide
      'Tactile pressure maps replace vision when the cup is occluded',
      'One policy pours water, rice and beads without retuning',
      '91% success over 60 real pours; 3× fewer spills than the baseline',
    ],
    tldr: 'One or two sentences …',                     // Abstract dialog only
    highlights: [                                        // Abstract dialog only, ≤ 3
      { value: '91%', label: 'success over 60 real pours' },
    ],
    abstract: 'Verbatim abstract …',
    links: { pdf: 'pour/paper.pdf', arxiv: '', code: '' },   // empty links render no button
    bibtex: `@inproceedings{author2027pour, ...}`,
    gallery: [                                           // from: python3 tools/optimize_images.py --js pour-tactile
      { src: 'assets/images/pour-tactile-pipeline.jpg', w: 1600, h: 820 },
    ],
    layout: { mode: 'stack', board: { cols: '1fr 1fr', rows: 1, cells: [{ item: 'img:0' }, { item: 'video:0' }] } },
    media: {                                             // from: python3 tools/optimize_videos.py --js pour-tactile
      main: { kind: 'overview', label: 'Overview video', src: '…', poster: '…', w: 1280, h: 720, duration: 95, caption: '…' },
      clips: [{ kind: 'loop', label: 'Real robot', src: '…', poster: '…', w: 720, h: 480, duration: 20, caption: '…' }],
    },
  },
```

Item keys inside `layout`: `img:N` is `gallery[N]`; `video:N` indexes `[media.main, ...media.clips]`
(so `video:0` is the main video when there is one). `layout.text: ['video:1']` would put a clip
under the bullets instead of on the board — unused today because the owner wants text first and
media below, but available.

## Project entries (`section: 'project'`)

A project is a robot or system the owner took part in, usually described from a web page or press
material instead of a PDF. It uses the same entry shape with these differences (see `xiaowu`):

```js
    section: 'project',                 // grouped under "Projects" on the cover and the closing slide; slide gets a "Project" badge
    org: 'Tencent Robotics X',          // the organisation behind it — shown as a badge (not an author/affiliation line)
    infoLabel: 'Details',               // the dialog button (default 'Abstract')
    abstractLabel: 'About the project (compiled from …)',   // dialog headings
    highlightsLabel: 'Specifications',  // highlights become the spec sheet: { value: '22 DoF', label: '…' }
    links: { project: 'https://…', projectLabel: 'Robot profile', extra: [{ label: 'Lab site', href: 'https://…' }] },
    bibtex: '',                         // no citation → no BibTeX button; no links.pdf → no PDF button
    thumb: 'assets/images/<slug>-….jpg',   // cover thumbnail when there is no video poster
```

Videos from the web (e.g. the clips embedded on a profile page) are YouTube embeds, not files:
`media.clips: [{ kind: 'youtube', id: 'UsixIrwb7So', label: 'Overview', w: 16, h: 9, duration: 58, caption: '…' }]`
(get the duration with `yt-dlp --skip-download --dump-json <url>`; the thumbnail comes from i.ytimg.com).
They take `video:N` cells like any clip; the player only loads when clicked, and only when the page is
served over http(s) (from `file://` YouTube answers "error 153"; the frame then shows a note instead).
Put the project after the papers in the array; `SITE.sections.project.divider` holds the copy of the
"Projects" chapter slide that precedes it. Source images go into a folder like `xiaowu/` as usual
(convert AVIF/WebP with alpha through Pillow, not ffmpeg, which drops the alpha plane); note their origin
in a `SOURCE.md` there and mark third-party images / figures with `// TODO` so the owner can replace them
with their own. No venue, year or status is rendered for a project either.

## Bullet style (`points`)

One idea per bullet, ≤ ~95 characters, concrete, with a number where the paper gives one.
Pattern: *what is new* → *why it works / what it removes* → *the result*.

- "Keypoints tracked in uncalibrated RGB views are both the policy state and the reward"
- "No extrinsics, 3D reconstruction or pose estimation; a Bayesian contact belief gates a dual-head SAC"
- "84.4% success on seven real contact-rich tasks; tracking recovers after 30 s of full occlusion"

Avoid: paragraphs, hedging, venue names, "we propose", "in this paper".

## Layout cookbook

Board = CSS grid; cells fill row by row in the order listed; a `rowSpan: 2` cell listed first
takes the first column of both rows; `span: 2` takes two columns. At 1280×720 the board is about
1200 × 450 px, so a 2-column cell is ≈ 600 px wide and a 2-row cell ≈ 450 px tall — compute the
drawn size of each image (min(cell width, cell height × aspect)) and keep it ≥ 300 px wide.

| media shapes | layout | used by |
|---|---|---|
| 1 wide image + 1 video | `cols: '1fr 1fr'` (or `'1.3fr 1fr'` when the image is wider), `rows: 1` | UniPrototype, Cloth Unfolding |
| 2 squarish images + 1 video | `cols: '1fr 1fr 1.05fr', rows: 1` | Seeing Points |
| 1 very wide (≥2.5:1) image + 1 squarish image + 1 video | `cols: '2fr 1fr', rows: 2`, cells: wide, squarish `rowSpan: 2`, video (ends up under the wide one) | Object Spinning |
| 1 wide image + 2 short clips | `cols: '2fr 1fr', rows: 2`, cells: image `rowSpan: 2`, clip, clip (stacked) | Physics Grasp |
| strip (≥3:1) + portrait photo + 2 clips | `cols: '1.1fr 1.45fr 1.45fr', rows: '1fr 1.5fr'`, cells: portrait `rowSpan: 2`, strip `span: 2`, clip, clip | Tactile Grasping |
| only portrait phone clips | `cols: <count>, rows: 1` | Teleoperation |
| 1 wide image + 1 portrait image + 1 overview video + 1 clip | `cols: '1.8fr 1fr 1fr', rows: 2`, cells: wide `rowSpan: 2`, portrait `rowSpan: 2`, video, clip (videos stacked in the third column) | test run "pour" |
| 2 wide images + 1 video | `cols: '1fr 1fr 1fr', rows: 1` or `cols: 2, rows: 2` with the video `span: 2` on the second row | — |
| 1 image only, no video | `cols: 1, rows: 1` | — |

Shapes: portrait = aspect < 0.9, squarish = 0.9–1.5, wide = 1.5–2.5, strip ≥ 2.5. Put images
before videos in reading order, give the most explanatory figure the largest cell, and never
let a 4:3 video sit in a cell taller than it is wide (dark letterbox bars). On phones the board
becomes one item per row automatically (portrait clips pair up), so you only design the
landscape grid.
