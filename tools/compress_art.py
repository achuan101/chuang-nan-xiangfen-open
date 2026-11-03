#!/usr/bin/env python3
"""Resize + pngquant art PNGs for WeChat 4MB main package (省事路线)."""
from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "assets" / "art"
PYPNG = "pngquant"


def max_edge_for(rel: str) -> int | None:
    """Return max long-edge pixels, or None to skip resize."""
    p = rel.replace("\\", "/")
    if p.startswith("shop/"):
        return 720  # already ~720; clamp taller mint
    if p.startswith("bottles/"):
        return 256
    if p.startswith("guests/"):
        return 192
    if p.startswith("ui/plant_"):
        return 256
    if p.startswith("ui/bottle_"):
        return 192
    if p.startswith("notes/"):
        return 128
    if p.startswith("fx/"):
        return 96
    if p.startswith("ui/slot_"):
        return 128
    return 512


def resize_if_needed(path: Path, max_edge: int | None) -> bool:
    if max_edge is None:
        return False
    im = Image.open(path)
    w, h = im.size
    long_edge = max(w, h)
    if long_edge <= max_edge:
        return False
    scale = max_edge / float(long_edge)
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    # LANCZOS for downscale; preserve alpha
    out = im.resize((nw, nh), Image.Resampling.LANCZOS)
    # Keep PNG with alpha
    if out.mode not in ("RGBA", "RGB", "P", "LA"):
        out = out.convert("RGBA")
    out.save(path, format="PNG", optimize=True)
    return True


def pngquant_inplace(path: Path) -> bool:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        # --skip-if-larger keeps original if quant bigger
        r = subprocess.run(
            [
                PYPNG,
                "--force",
                "--quality=65-85",
                "--speed=1",
                "--skip-if-larger",
                "--output",
                tmp_path,
                str(path),
            ],
            capture_output=True,
            text=True,
        )
        # exit 0 ok, 99 skipped-if-larger still wrote? pngquant 99 = quality match fail
        if r.returncode in (0, 99) and os.path.exists(tmp_path) and os.path.getsize(tmp_path) > 0:
            if os.path.getsize(tmp_path) < os.path.getsize(path):
                os.replace(tmp_path, path)
                return True
        return False
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


def main() -> None:
    rows = []
    for path in sorted(ART.rglob("*.png")):
        rel = str(path.relative_to(ART))
        before = path.stat().st_size
        resized = resize_if_needed(path, max_edge_for(rel))
        quantized = pngquant_inplace(path)
        after = path.stat().st_size
        rows.append((before, after, resized, quantized, rel))
        print(
            f"{before:8} -> {after:8}  "
            f"{'R' if resized else '-'}{'Q' if quantized else '-'}  {rel}"
        )
    total_b = sum(r[0] for r in rows)
    total_a = sum(r[1] for r in rows)
    print(f"\nTOTAL {total_b} -> {total_a} ({(total_a/total_b*100):.1f}%)")


if __name__ == "__main__":
    main()
