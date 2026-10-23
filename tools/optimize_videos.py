#!/usr/bin/env python3
"""Make every demo video GitHub-Pages friendly.

For each video found in the paper folders this script probes the file with
ffprobe and then either

  * remuxes it losslessly   - already H.264 / yuv420p / long side <= 1280 px /
                              <= 20 MB; only the `moov` atom is moved to the
                              front (+faststart) and silent audio is dropped, or
  * re-encodes it           - libx264, yuv420p, crf 26, preset slow, long side
                              capped at 1280 px, +faststart, audio dropped when
                              the track is (near) silent.

It also writes a poster JPEG per video so the page can show a frame before any
video bytes are fetched, and a manifest.json with the resulting metadata.

Per-video tweaks live in the maps below: POSTER_AT (poster frame time), SPEED
(play-back speed-up, e.g. 2.0 for a slow demo; the audio track is dropped) and
CROP (ffmpeg crop "w:h:x:y" to cut away empty background, in *display* pixels).
Either of the last two forces a re-encode, as does a non-square pixel aspect ratio
(some phone clips are stored squeezed, e.g. 480x480 with SAR 240:427 = a 480x854
portrait picture): those are rescaled to square pixels first so that crops, posters
and the page's w/h all refer to what is actually shown.

Usage:
    python3 tools/optimize_videos.py            # convert what is missing
    python3 tools/optimize_videos.py --force    # redo everything
    python3 tools/optimize_videos.py --dry-run  # only print the plan
    python3 tools/optimize_videos.py --posters  # only re-create the poster frames
    python3 tools/optimize_videos.py --js SLUG  # print a `media:` block for papers.js (after converting)
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "videos_web"
POSTER_DIR = ROOT / "assets" / "posters"
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"}
SKIP_DIRS = {"assets", "tools", ".git", "node_modules"}

# folder name -> short slug used in output file names
SLUGS = {
    "Advance_wiley": "physgrasp",
    "icra25": "tactile-grasp",
    "iros26": "uniprototype",
    "pixel_RL": "pixelpoint-rl",
    "tele": "teleop",
    "unfold": "cloth-unfold",
    "wrench_spin": "object-spin",
    "xiaowu": "xiaowu",
    "waste_sort": "waste-sort",
    "aloha_drawer": "aloha-drawer",
}

# play-back speed-up per output name (1.0 = unchanged); the audio track is dropped when sped up
SPEED = {
    "waste-sort-waste-grasp": 2.0,
}

# crop per output name, ffmpeg "w:h:x:y" in display pixels (after the pixel-aspect fix, before scaling)
CROP = {
    "waste-sort-waste-grasp": "480:552:0:300",   # portrait phone clip (480x854 shown): drop the empty wall above the arm
    "aloha-drawer-aloha": "854:322:0:0",         # composite (854x480 shown): cut the caption band and the burned-in captions at the bottom
}

# poster frame time (s) per output name; others use 1.0 s (0.2 s for clips < 10 s)
POSTER_AT = {
    "physgrasp-v4": 48,
    "uniprototype-v3subiros": 50,
    "pixelpoint-rl-icra27": 60,
    "cloth-unfold-corlv7": 90,
    "object-spin-icra27-6150-vi-i": 128,
    "waste-sort-waste-grasp": 3.2,       # gripper down on the belt
    "aloha-drawer-aloha": 24,            # arm at the drawer
}

MAX_SIDE = 1280          # px, applies to width AND height (vertical phone clips)
MAX_BYTES = 20 * 1024 * 1024
SILENT_DB = -25.0        # max_volume below this => treat the track as noise, drop it
CRF, PRESET = "26", "slow"


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def probe(path: Path) -> dict:
    res = run(["ffprobe", "-v", "error", "-print_format", "json",
               "-show_format", "-show_streams", str(path)])
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip())
    info = json.loads(res.stdout)
    v = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    if v is None:
        raise RuntimeError("no video stream")
    w, h = int(v["width"]), int(v["height"])
    # honour rotation metadata (phone recordings) so the plan uses display size
    rot = 0
    for sd in v.get("side_data_list", []):
        if "rotation" in sd:
            rot = int(abs(float(sd["rotation"])))
    if rot in (90, 270):
        w, h = h, w
    # non-square pixels (sample aspect ratio): the picture is shown stretched to w*sar x h
    sar = v.get("sample_aspect_ratio", "1:1")
    try:
        num, den = (int(x) for x in sar.split(":"))
        sar_f = num / den if num and den else 1.0
    except ValueError:
        sar_f = 1.0
    # square-pixel size that shows the same picture: upscale the short side so no detail is dropped
    if abs(sar_f - 1.0) > 1e-3:
        sq = (w, int(round(h / sar_f / 2)) * 2) if sar_f < 1 else (int(round(w * sar_f / 2)) * 2, h)
    else:
        sq = None
    return {
        "sar": sar if sq else None, "square": sq,
        "codec": v.get("codec_name"),
        "pix_fmt": v.get("pix_fmt"),
        "width": w, "height": h,
        "fps": v.get("r_frame_rate"),
        "duration": float(info["format"].get("duration", 0)),
        "size": int(info["format"].get("size", path.stat().st_size)),
        "has_audio": a is not None,
    }


def is_faststart(path: Path) -> bool:
    """True when the top-level `moov` atom precedes `mdat`."""
    order = []
    with path.open("rb") as fh:
        pos, end = 0, path.stat().st_size
        while pos < end:
            fh.seek(pos)
            head = fh.read(8)
            if len(head) < 8:
                break
            size, kind = struct.unpack(">I4s", head)
            if size == 1:                      # 64-bit extended size
                size = struct.unpack(">Q", fh.read(8))[0]
            elif size == 0:                    # atom runs to end of file
                size = end - pos
            order.append(kind.decode("latin1"))
            if size < 8:
                break
            pos += size
    if "moov" not in order:
        return False
    return "mdat" not in order or order.index("moov") < order.index("mdat")


def max_volume_db(path: Path) -> float | None:
    res = run(["ffmpeg", "-nostdin", "-hide_banner", "-i", str(path), "-vn",
               "-af", "volumedetect", "-f", "null", "-"])
    m = re.search(r"max_volume:\s*(-?[\d.]+) dB", res.stderr)
    return float(m.group(1)) if m else None


def clean_stem(stem: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "-", stem).strip("-").lower()
    return s or "video"


def find_videos() -> list[Path]:
    vids = []
    for d in sorted(ROOT.iterdir()):
        if not d.is_dir() or d.name in SKIP_DIRS or d.name.startswith("."):
            continue
        for f in sorted(d.rglob("*")):
            if f.suffix.lower() in VIDEO_EXT and not f.name.startswith("."):
                vids.append(f)
    return vids


def plan(src: Path) -> dict:
    meta = probe(src)
    folder = src.relative_to(ROOT).parts[0]
    slug = SLUGS.get(folder, clean_stem(folder))
    name = f"{slug}-{clean_stem(src.stem)}"
    fast = is_faststart(src)
    speed = float(SPEED.get(name, 1.0))
    crop = CROP.get(name)
    vol = max_volume_db(src) if meta["has_audio"] else None
    keep_audio = meta["has_audio"] and vol is not None and vol > SILENT_DB and speed == 1.0   # a sped-up track is useless
    reasons = []
    if meta["sar"]:
        reasons.append(f"pixel aspect {meta['sar']} -> {meta['square'][0]}x{meta['square'][1]}")
    if speed != 1.0:
        reasons.append(f"{speed:g}x speed")
    if crop:
        reasons.append(f"crop {crop}")
    if meta["codec"] != "h264":
        reasons.append(f"codec {meta['codec']}")
    if meta["pix_fmt"] != "yuv420p":
        reasons.append(f"pix_fmt {meta['pix_fmt']}")
    if max(meta["width"], meta["height"]) > MAX_SIDE:
        reasons.append(f"{meta['width']}x{meta['height']} > {MAX_SIDE}px")
    if meta["size"] > MAX_BYTES:
        reasons.append(f"{meta['size'] / 1048576:.1f} MB > 20 MB")
    mode = "reencode" if reasons else ("remux" if (not fast or (meta["has_audio"] and not keep_audio)) else "remux")
    return {
        "src": src, "name": name, "dst": OUT_DIR / f"{name}.mp4",
        "poster": POSTER_DIR / f"{name}.jpg", "meta": meta,
        "faststart": fast, "max_volume": vol, "keep_audio": keep_audio,
        "speed": speed, "crop": crop,
        "mode": mode, "reasons": reasons,
    }


def ffmpeg_cmd(p: dict) -> list[str]:
    cmd = ["ffmpeg", "-nostdin", "-y", "-hide_banner", "-loglevel", "error",
           "-i", str(p["src"]), "-map", "0:v:0"]
    if p["keep_audio"]:
        cmd += ["-map", "0:a:0"]
    if p["mode"] == "reencode":
        vf = []
        if p["meta"].get("square"):
            vf.append(f"scale={p['meta']['square'][0]}:{p['meta']['square'][1]},setsar=1")   # square pixels first (see module docstring)
        if p.get("crop"):
            vf.append(f"crop={p['crop']}")
        if p.get("speed", 1.0) != 1.0:
            vf.append(f"setpts=PTS/{p['speed']:g}")
        vf.append(f"scale=w='min({MAX_SIDE},iw)':h='min({MAX_SIDE},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2")
        cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", CRF, "-preset", PRESET, "-vf", ",".join(vf)]
        cmd += ["-c:a", "aac", "-b:a", "96k"] if p["keep_audio"] else ["-an"]
    else:  # lossless remux: just move moov to the front
        cmd += ["-c", "copy"] + ([] if p["keep_audio"] else ["-an"])
    cmd += ["-movflags", "+faststart", "-map_metadata", "-1", str(p["dst"])]
    return cmd


def poster_cmd(p: dict) -> list[str]:
    t = POSTER_AT.get(p["name"], 1.0 if p["meta"]["duration"] > 10 else 0.2)
    return ["ffmpeg", "-nostdin", "-y", "-hide_banner", "-loglevel", "error",
            "-ss", f"{t:.2f}", "-i", str(p["dst"]), "-frames:v", "1",
            "-vf", "scale=w='min(640,iw)':h='min(640,ih)':force_original_aspect_ratio=decrease",
            "-q:v", "4", str(p["poster"])]


def emit_js(slug: str) -> int:
    """Print a `media:` block for papers.js from manifest.json (videos >= 60 s or named like an
    overview become `main`, the rest become autoplay `clips`)."""
    mf = OUT_DIR / "manifest.json"
    if not mf.exists():
        print("run the conversion first (no manifest.json yet)", file=sys.stderr)
        return 1
    items = {k: v for k, v in json.load(mf.open()).items() if k.startswith(slug + "-")}
    if not items:
        print(f"no converted videos for slug {slug!r} (known: {sorted({k.rsplit('-', 1)[0] for k in json.load(mf.open())})})", file=sys.stderr)
        return 1
    def js(name, v, kind):
        label = "Overview video" if kind == "overview" else name[len(slug) + 1:].replace("-", " ").title()
        lines = [f"        kind: '{kind}',", f"        label: '{label}',   // TODO: short on-video label",
                 f"        src: '{v['file']}',", f"        poster: '{v['poster']}',",
                 f"        w: {v['width']}, h: {v['height']}, duration: {round(v['duration'])},"]
        if v["audio"] and kind != "overview":
            lines.append("        audio: true,   // keeps an unmute button; drop it if the track is only noise")
        lines.append("        caption: '<b>TODO.</b> One sentence (shown as a tooltip).',")
        return "      {\n" + "\n".join(lines) + "\n      }"
    overview = [k for k, v in items.items() if v["duration"] >= 60 or re.search(r"overview|supp|sub|main", k)]
    main = overview[0] if overview else None
    clips = [k for k in items if k != main]
    out = ["    media: {"]
    if main:
        out.append("      main: " + js(main, items[main], "overview").lstrip() + ",")
    if clips:
        out.append("      clips: [\n" + ",\n".join(js(k, items[k], "loop") for k in clips) + "\n      ],")
    out.append("    },")
    print("\n".join(out))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true", help="re-create outputs that already exist")
    ap.add_argument("--dry-run", action="store_true", help="print the plan and exit")
    ap.add_argument("--posters", action="store_true", help="only (re)generate the poster frames")
    ap.add_argument("--js", metavar="SLUG", help="print a ready-to-paste `media:` block for this slug and exit")
    args = ap.parse_args()

    if args.js:
        return emit_js(args.js)
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        print("ffmpeg/ffprobe not found on PATH", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    POSTER_DIR.mkdir(parents=True, exist_ok=True)

    plans = [plan(v) for v in find_videos()]
    print(f"{'source':44} {'size':>8} {'dims':>10} {'fast':>5} {'maxdB':>6} {'audio':>5}  action")
    for p in plans:
        m = p["meta"]
        vol = "-" if p["max_volume"] is None else f"{p['max_volume']:.0f}"
        print(f"{str(p['src'].relative_to(ROOT)):44} {m['size'] / 1048576:7.1f}M {m['width']}x{m['height']:<5} "
              f"{'yes' if p['faststart'] else 'no':>5} {vol:>6} {'keep' if p['keep_audio'] else 'drop':>5}  "
              f"{p['mode']}{' (' + ', '.join(p['reasons']) + ')' if p['reasons'] else ''}")
    if args.dry_run:
        return 0

    manifest = {}
    for p in plans:
        if not args.posters and (args.force or not p["dst"].exists()):
            print(f"\n→ {p['mode']} {p['src'].relative_to(ROOT)} -> {p['dst'].relative_to(ROOT)}", flush=True)
            res = run(ffmpeg_cmd(p))
            if res.returncode != 0:
                print(res.stderr, file=sys.stderr)
                return 1
        if not p["dst"].exists():
            print(f"{p['dst']} is missing - run the script without --posters first", file=sys.stderr)
            return 1
        if args.posters or args.force or not p["poster"].exists():
            res = run(poster_cmd(p))
            if res.returncode != 0:
                print(res.stderr, file=sys.stderr)
                return 1
        out = probe(p["dst"])
        manifest[p["name"]] = {
            "src": str(p["src"].relative_to(ROOT)),
            "file": str(p["dst"].relative_to(ROOT)),
            "poster": str(p["poster"].relative_to(ROOT)),
            "width": out["width"], "height": out["height"],
            "duration": round(out["duration"], 2),
            "size_mb": round(out["size"] / 1048576, 2),
            "audio": out["has_audio"],
            "mode": p["mode"],
        }
        print(f"   {p['meta']['size'] / 1048576:6.1f} MB -> {out['size'] / 1048576:5.1f} MB  "
              f"{out['width']}x{out['height']}  audio={'yes' if out['has_audio'] else 'no'}", flush=True)

    # keep entries of earlier runs whose outputs still exist (raw sources are git-ignored and may be absent)
    mf = OUT_DIR / "manifest.json"
    if mf.exists():
        for k, v in json.load(mf.open()).items():
            if k not in manifest and (ROOT / v["file"]).exists():
                manifest[k] = v
    mf.write_text(json.dumps(manifest, indent=2) + "\n")
    total_in = sum(p["meta"]["size"] for p in plans) / 1048576
    total_out = sum(v["size_mb"] for v in manifest.values())
    print(f"\nDone. {len(plans)} videos: {total_in:.1f} MB -> {total_out:.1f} MB. "
          f"Manifest: {OUT_DIR.relative_to(ROOT) / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
