#!/usr/bin/env python3
"""把白底生成图处理成符合主包尺寸规范的 192x256 瓶用图。

用法：python tools/import_bottle_art.py morning_dew=/tmp/a.png warm_sandalwood=/tmp/b.png
原图另存 art/_raw/bottles/，不进 assets/，所以不吃主包体积。
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "art" / "bottles"
RAW_DIR = ROOT / "art" / "_raw" / "bottles"

BOX_W, BOX_H = 192, 256
# 家族里 7 张合规图的内容框界实测值：顶 36~44、底 221~235
CONTENT_BOTTOM = 226
CONTENT_HEIGHT = 190
CONTENT_MAX_W = 168
# 角落暖白渐变最暗处仍有 230+，低于这个值就当主体
BG_MIN_CHANNEL = 205
# 生成图右下角的「豆包 AI 生成」水印远小于瓶身，按面积占比丢掉
MIN_COMPONENT_RATIO = 0.08


def key_out(rgb: np.ndarray) -> np.ndarray:
    """只把与画框连成一片的近白判为背景，瓶内高光和奶油投影因此不会被误抠。"""
    near_white = rgb.min(axis=2) >= BG_MIN_CHANNEL
    labels, _ = ndimage.label(near_white)
    border = np.unique(np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]]))
    border = border[border > 0]
    bg = np.isin(labels, border)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # 1px 均值羽化，缩到 192 宽时不留硬锯齿
    return ndimage.uniform_filter(alpha.astype(np.float32), size=3).astype(np.uint8)


def main_subject_box(alpha: np.ndarray) -> tuple[int, int, int, int]:
    labels, count = ndimage.label(alpha > 8)
    if count == 0:
        raise SystemExit("抠完是全透明，检查背景阈值")
    sizes = ndimage.sum_labels(alpha > 8, labels, index=np.arange(1, count + 1))
    keep = np.flatnonzero(sizes >= sizes.max() * MIN_COMPONENT_RATIO) + 1
    mask = np.isin(labels, keep)
    ys, xs = np.nonzero(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def fit_box(rgba: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    content = rgba.crop(box)
    cw, ch = content.size
    scale = min(CONTENT_HEIGHT / ch, CONTENT_MAX_W / cw)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    content = content.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (BOX_W, BOX_H), (0, 0, 0, 0))
    canvas.alpha_composite(content, ((BOX_W - nw) // 2, CONTENT_BOTTOM - nh))
    return canvas


def convert(bottle_id: str, src: Path) -> Path:
    raw = Image.open(src).convert("RGB")
    rgb = np.asarray(raw)
    alpha = key_out(rgb)
    box = main_subject_box(alpha)
    rgba = Image.fromarray(np.dstack([rgb, alpha]))
    out = fit_box(rgba, box).quantize(
        colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE
    )
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    raw.save(RAW_DIR / f"{bottle_id}.png")
    dst = OUT_DIR / f"{bottle_id}.png"
    out.save(dst, format="PNG", optimize=True)
    return dst


def main(argv: list[str]) -> int:
    for arg in argv:
        bottle_id, _, path = arg.partition("=")
        src = Path(path).expanduser().resolve()
        if not bottle_id or not src.is_file():
            raise SystemExit(f"参数应为 <bottleId>=<图片路径>，收到：{arg}")
        dst = convert(bottle_id, src)
        probe = Image.open(dst)
        print(f"{bottle_id}: {probe.size} mode={probe.mode} {dst.stat().st_size // 1024}KB -> {dst}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
