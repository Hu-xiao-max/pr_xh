#!/usr/bin/env python3
"""Cut Figure 1 and Figure 2 out of each paper PDF as images, without their captions.

How it works (per figure):
  1. find the caption block ("Fig. N." / "Figure N:") in reading order;
  2. starting from the graphics that touch the caption from above, grow a region
     upward through connected graphics (embedded images + vector drawings) that
     overlap it horizontally; small text blocks inside the region (axis labels,
     sub-figure letters) are kept, body text is not;
  3. render that region at 2x as JPEG into assets/figures/<slug>-figN.jpg.

Papers without figures (slide decks) and failed detections can be pinned in
OVERRIDES with an explicit page (whole page) or page + rectangle in PDF points.

Needs PyMuPDF:  python3 -m venv .venv && .venv/bin/pip install pymupdf
Usage:          .venv/bin/python tools/extract_figures.py [--force] [--debug]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    sys.exit("PyMuPDF is required: pip install pymupdf")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "figures"
ZOOM = 2.0
JPG_QUALITY = 90
CAPTION_RE = re.compile(r"^\s*(?:Fig\.|Figure)\s*(\d+)\s*[.:]")

# slug -> PDF (relative to the repo root); figures 1 and 2 are extracted from each
PAPERS = {
    "uniprototype": "iros26/IROS26_1535_FI.pdf",
    "pixelpoint-rl": "pixel_RL/ICRA27_5965_MS.pdf",
    "object-spin": "wrench_spin/ICRA27_6150_MS.pdf",
    "cloth-unfold": "unfold/iclr.pdf",
    "physgrasp": "Advance_wiley/Advanced_Robotics_Research.pdf",
    "tactile-grasp": "icra25/ICRA25.pdf",
    "teleop": "tele/prmain.pdf",
}
# slug -> {fig_no: {"page": 1-based page, "rect": [x0, y0, x1, y1] in PDF points (optional),
#                    "mode": "graphics" to crop to the union of all images/drawings on the page}}
OVERRIDES = {
    # slide deck, no numbered figures: crop the diagrams of the "Overall architecture" and
    # "Methodology (hand retargeting)" slides, leaving the slide text out
    "teleop": {1: {"page": 6, "mode": "graphics"}, 2: {"page": 11, "mode": "graphics"}},
}


def caption_block(doc, n):
    """(page_no, caption_rect) of the first block starting with 'Fig. n' / 'Figure n'."""
    for pno, page in enumerate(doc):
        for b in page.get_text("dict")["blocks"]:
            if b["type"] != 0 or not b["lines"]:
                continue
            first = "".join(s["text"] for s in b["lines"][0]["spans"]).strip()
            m = CAPTION_RE.match(first)
            if m and int(m.group(1)) == n:
                return pno, fitz.Rect(b["bbox"])
    return None


def graphics(page):
    """Rectangles of embedded images and vector drawings, minus page-sized backgrounds and rules."""
    W, H = page.rect.width, page.rect.height
    rects = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] == 1:
            rects.append(fitz.Rect(b["bbox"]))
    for d in page.get_drawings():
        r = fitz.Rect(d["rect"])
        if r.is_empty or r.width * r.height > 0.6 * W * H:
            continue
        if r.height < 1.5 and r.width > 0.6 * W:      # page-wide rules (headers, tables)
            continue
        rects.append(r)
    return rects


def text_blocks(page):
    return [fitz.Rect(b["bbox"]) for b in page.get_text("dict")["blocks"] if b["type"] == 0]


def overlap_x(a, b, tol=0.0):
    return min(a.x1, b.x1) - max(a.x0, b.x0) > tol


def figure_rect(page, cap, gap=28.0):
    """Grow a region upward from the caption through connected graphics."""
    shapes = [r for r in graphics(page) if r.y1 <= cap.y0 + 6 and r.y1 >= cap.y0 - 420]
    seed = [r for r in shapes if r.y1 >= cap.y0 - 60 and overlap_x(r, cap, -40)]
    if not seed:                                  # nothing touches the caption: take whatever is above it
        seed = [r for r in shapes if r.y1 >= cap.y0 - 160 and overlap_x(r, cap, -120)]
    if not seed:
        return None
    region = fitz.Rect(seed[0])
    for r in seed:
        region |= r
    changed = True
    while changed:
        changed = False
        for r in shapes:
            if r in region:
                continue
            touches = r.y1 >= region.y0 - gap and r.y0 <= region.y1 + 2 and overlap_x(r, region, -20)
            if touches and not (region.contains(r)):
                region |= r
                changed = True
    # keep small text blocks that live inside the figure (labels), never body text
    for t in text_blocks(page):
        c = fitz.Point((t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2)
        if region.contains(c) and t.y1 <= cap.y0 - 1:
            region |= t
    region.y1 = min(region.y1, cap.y0 - 2)
    region = fitz.Rect(region.x0 - 3, region.y0 - 3, region.x1 + 3, region.y1 + 2) & page.rect
    return region if region.width > 40 and region.height > 30 else None


def render(page, rect, out: Path):
    pix = page.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), clip=rect, alpha=False)
    out.parent.mkdir(parents=True, exist_ok=True)
    pix.save(str(out), jpg_quality=JPG_QUALITY)
    return pix.width, pix.height


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true", help="re-create images that already exist")
    ap.add_argument("--debug", action="store_true", help="also write full-page renders with the detected box")
    args = ap.parse_args()

    manifest, failures = {}, []
    for slug, rel in PAPERS.items():
        pdf = ROOT / rel
        if not pdf.exists():
            failures.append(f"{slug}: {rel} missing")
            continue
        doc = fitz.open(pdf)
        for n in (1, 2):
            out = OUT / f"{slug}-fig{n}.jpg"
            ov = OVERRIDES.get(slug, {}).get(n)
            if ov:
                page = doc[ov["page"] - 1]
                if ov.get("rect"):
                    rect = fitz.Rect(ov["rect"])
                elif ov.get("mode") == "graphics":
                    rects = graphics(page)
                    rect = fitz.Rect(rects[0]) if rects else page.rect
                    for r in rects:
                        rect |= r
                    rect = fitz.Rect(rect.x0 - 6, rect.y0 - 6, rect.x1 + 6, rect.y1 + 6) & page.rect
                else:
                    rect = page.rect
                how = "override"
            else:
                found = caption_block(doc, n)
                if not found:
                    failures.append(f"{slug}: caption for figure {n} not found")
                    continue
                pno, cap = found
                page = doc[pno]
                rect = figure_rect(page, cap)
                how = f"auto p{pno + 1}"
                if rect is None:
                    failures.append(f"{slug}: no graphics found above the caption of figure {n} (page {pno + 1})")
                    continue
            fresh = args.force or not out.exists()
            if fresh:
                w, h = render(page, rect, out)
            else:
                pm = fitz.Pixmap(str(out)); w, h = pm.width, pm.height
            manifest[f"{slug}-fig{n}"] = {"pdf": rel, "page": page.number + 1,
                                          "rect": [round(v, 1) for v in rect], "file": str(out.relative_to(ROOT)),
                                          "width": w, "height": h, "source": how}
            print(f"{slug:14} fig{n}: page {page.number + 1:2d}  rect {[round(v) for v in rect]}  ({how})"
                  + (f"  -> {w}x{h}px {out.stat().st_size // 1024} KB" if fresh else f"  ({w}x{h}px, kept)"))
            if args.debug:
                dbg = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
                dbg_path = OUT / "_debug" / f"{slug}-fig{n}-page.png"
                dbg_path.parent.mkdir(parents=True, exist_ok=True)
                shape = page.new_shape(); shape.draw_rect(rect); shape.finish(color=(1, 0, 0), width=1.5); shape.commit()
                page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False).save(str(dbg_path))
        doc.close()
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    if failures:
        print("\nProblems:\n  " + "\n  ".join(failures))
    print(f"\n{len(manifest)} figures listed in {OUT.relative_to(ROOT) / 'manifest.json'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
