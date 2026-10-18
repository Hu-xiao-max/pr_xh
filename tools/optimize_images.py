#!/usr/bin/env python3
"""Make the images in the paper folders web-friendly.

Every PNG/JPEG/WebP found directly inside a paper folder is flattened onto white,
downscaled to at most MAX_SIDE px on its long side and saved as a JPEG under
assets/images/<slug>-<name>.jpg. A manifest.json with pixel sizes is written so
the entries can be copied into assets/data/papers.js (`gallery`).

Needs ffmpeg/ffprobe.  Usage: python3 tools/optimize_images.py [--force]
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "images"
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp"}
SKIP_DIRS = {"assets", "tools", ".git", "node_modules"}
MAX_SIDE = 1600
JPG_Q = "3"          # ffmpeg mjpeg quality: 2 (best) .. 31

SLUGS = {            # folder -> slug (same as optimize_videos.py)
    "Advance_wiley": "physgrasp",
    "icra25": "tactile-grasp",
    "iros26": "uniprototype",
    "pixel_RL": "pixelpoint-rl",
    "tele": "teleop",
    "unfold": "cloth-unfold",
    "wrench_spin": "object-spin",
}


def clean_stem(stem: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "-", stem).strip("-").lower()
    s = re.sub(r"-?\d{8}-\d{6}", "", s).strip("-")        # drop timestamps like 20260604-135237
    return s or "image"


def probe(path: Path) -> tuple[int, int]:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height", "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout
    w, h = out.strip().split(",")[:2]
    return int(w), int(h)


def convert(src: Path, dst: Path) -> None:
    vf = ("format=rgba,split[a][b];[a]drawbox=c=white:t=fill[bg];[bg][b]overlay=format=auto,format=rgb24,"
          f"scale=w='min({MAX_SIDE},iw)':h='min({MAX_SIDE},ih)':force_original_aspect_ratio=decrease")
    res = subprocess.run(["ffmpeg", "-nostdin", "-y", "-hide_banner", "-loglevel", "error", "-i", str(src),
                          "-filter_complex", vf, "-q:v", JPG_Q, str(dst)], capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip())


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true", help="re-create outputs that already exist")
    args = ap.parse_args()
    if not shutil.which("ffmpeg"):
        print("ffmpeg not found", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for d in sorted(ROOT.iterdir()):
        if not d.is_dir() or d.name in SKIP_DIRS or d.name.startswith("."):
            continue
        slug = SLUGS.get(d.name, clean_stem(d.name))
        for f in sorted(d.iterdir()):
            if f.suffix.lower() not in IMAGE_EXT or f.name.startswith("."):
                continue
            name = f"{slug}-{clean_stem(f.stem)}"
            dst = OUT_DIR / f"{name}.jpg"
            if args.force or not dst.exists():
                convert(f, dst)
            w, h = probe(dst)
            manifest.setdefault(slug, []).append({"src": str(dst.relative_to(ROOT)), "w": w, "h": h,
                                                  "from": str(f.relative_to(ROOT))})
            print(f"{str(f.relative_to(ROOT)):55} {f.stat().st_size / 1024:7.0f} KB -> {dst.name:40} {w}x{h} {dst.stat().st_size / 1024:5.0f} KB")
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"\n{sum(len(v) for v in manifest.values())} images -> {OUT_DIR.relative_to(ROOT)}/ (manifest.json lists the sizes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
