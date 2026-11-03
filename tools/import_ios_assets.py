#!/usr/bin/env python3
"""Import and compress expressions and news images from iOS app project into mini-game."""
import shutil
from pathlib import Path
from PIL import Image

CURRENT_DIR = Path(__file__).resolve().parents[1]
APP_DIR = CURRENT_DIR.parent / "chuang-nan-xiangfen-app"

SRC_EXP = APP_DIR / "assets" / "art" / "expressions"
DST_EXP = CURRENT_DIR / "assets" / "art" / "expressions"

SRC_UI = APP_DIR / "assets" / "art" / "ui"
DST_UI = CURRENT_DIR / "assets" / "art" / "ui"


def resize_and_quantize(src: Path, dst: Path, max_edge: int) -> int:
    im = Image.open(src)
    w, h = im.size
    long_edge = max(w, h)
    if long_edge > max_edge:
        scale = max_edge / float(long_edge)
        nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
        out = im.resize((nw, nh), Image.Resampling.LANCZOS)
    else:
        out = im
    if out.mode not in ("RGBA", "RGB", "P", "LA"):
        out = out.convert("RGBA")
    
    # Quantize to 256 colors for dramatic size reduction without quality loss
    q = out.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
    q.save(dst, format="PNG", optimize=True)
    return dst.stat().st_size


def main():
    print("=== 1. Importing Guest Expressions ===")
    DST_EXP.mkdir(parents=True, exist_ok=True)
    total_exp_size = 0
    for png in SRC_EXP.glob("*.png"):
        meta = png.with_suffix(".png.meta")
        dst_png = DST_EXP / png.name
        dst_meta = DST_EXP / meta.name
        if meta.exists():
            shutil.copy2(meta, dst_meta)
        size = resize_and_quantize(png, dst_png, max_edge=192)
        total_exp_size += size
        print(f"  [Exp] {png.name} -> {size // 1024} KB")
    print(f"Total expressions size: {total_exp_size // 1024} KB")

    print("\n=== 2. Importing Morning News Banners (Days 1..4) ===")
    total_news_size = 0
    for day in range(1, 5):
        png = SRC_UI / f"news_day{day}.png"
        meta = SRC_UI / f"news_day{day}.png.meta"
        if not png.exists():
            continue
        dst_png = DST_UI / png.name
        dst_meta = DST_UI / meta.name
        if meta.exists():
            shutil.copy2(meta, dst_meta)
        size = resize_and_quantize(png, dst_png, max_edge=480)
        total_news_size += size
        print(f"  [News] {png.name} -> {size // 1024} KB")
    print(f"Total news banners size: {total_news_size // 1024} KB")

    grand_total = total_exp_size + total_news_size
    print(f"\nGRAND TOTAL ADDED: {grand_total // 1024} KB ({grand_total / (1024 * 1024):.2f} MB)")


if __name__ == "__main__":
    main()
