#!/usr/bin/env python3
"""Scale down guest portraits to max 192px and generate Cocos .meta files."""
import os
import uuid
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "public" / "art" / "guests"
DST_DIR = ROOT / "assets" / "art" / "guests"

GUESTS = ["guest_tea", "guest_flower", "guest_artisan", "guest_poetry"]
MAX_EDGE = 192

def process():
    DST_DIR.mkdir(parents=True, exist_ok=True)
    for g in GUESTS:
        src_png = SRC_DIR / f"{g}.png"
        dst_png = DST_DIR / f"{g}.png"
        meta_file = DST_DIR / f"{g}.png.meta"

        if not src_png.exists():
            print(f"Not found: {src_png}")
            continue

        im = Image.open(src_png)
        w, h = im.size
        scale = min(MAX_EDGE / max(w, h), 1.0)
        nw, nh = int(round(w * scale)), int(round(h * scale))
        resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
        resized.save(dst_png, format="PNG", optimize=True)
        print(f"Saved {dst_png.name} ({nw}x{nh}) size={dst_png.stat().st_size} bytes")

        if not meta_file.exists():
            base_uuid = str(uuid.uuid4())
            tex_uuid = f"{base_uuid}@6c48a"
            sf_uuid = f"{base_uuid}@f9941"
            meta_data = {
                "ver": "1.0.27",
                "importer": "image",
                "imported": True,
                "uuid": base_uuid,
                "files": [".json", ".png"],
                "subMetas": {
                    "6c48a": {
                        "importer": "texture",
                        "uuid": tex_uuid,
                        "displayName": g,
                        "id": "6c48a",
                        "name": "texture",
                        "userData": {
                            "wrapModeS": "clamp-to-edge",
                            "wrapModeT": "clamp-to-edge",
                            "imageUuidOrDatabaseUri": base_uuid,
                            "isUuid": True,
                            "visible": False,
                            "minfilter": "linear",
                            "magfilter": "linear",
                            "mipfilter": "none",
                            "anisotropy": 0
                        },
                        "ver": "1.0.22",
                        "imported": True,
                        "files": [".json"],
                        "subMetas": {}
                    },
                    "f9941": {
                        "importer": "sprite-frame",
                        "uuid": sf_uuid,
                        "displayName": g,
                        "id": "f9941",
                        "name": "spriteFrame",
                        "userData": {
                            "trimThreshold": 1,
                            "rotated": False,
                            "offsetX": 0,
                            "offsetY": 0,
                            "trimX": 0,
                            "trimY": 0,
                            "width": nw,
                            "height": nh,
                            "rawWidth": nw,
                            "rawHeight": nh,
                            "borderTop": 0,
                            "borderBottom": 0,
                            "borderLeft": 0,
                            "borderRight": 0,
                            "packable": True,
                            "pixelsToUnit": 100,
                            "pivotX": 0.5,
                            "pivotY": 0.5,
                            "meshType": 0,
                            "vertices": {
                                "rawPosition": [-nw // 2, -nh // 2, 0, nw // 2, -nh // 2, 0, -nw // 2, nh // 2, 0, nw // 2, nh // 2, 0],
                                "indexes": [0, 1, 2, 2, 1, 3],
                                "uv": [0, nh, nw, nh, 0, 0, nw, 0],
                                "nuv": [0, 0, 1, 0, 0, 1, 1, 1],
                                "minPos": [-nw // 2, -nh // 2, 0],
                                "maxPos": [nw // 2, nh // 2, 0]
                            },
                            "isUuid": True,
                            "imageUuidOrDatabaseUri": tex_uuid,
                            "atlasUuid": "",
                            "trimType": "auto"
                        },
                        "ver": "1.0.12",
                        "imported": True,
                        "files": [".json"],
                        "subMetas": {}
                    }
                },
                "userData": {
                    "type": "sprite-frame",
                    "fixAlphaTransparencyArtifacts": False,
                    "hasAlpha": False,
                    "redirect": tex_uuid
                }
            }
            with open(meta_file, "w", encoding="utf-8") as f:
                json.dump(meta_data, f, indent=2)
            print(f"Created meta: {meta_file.name}")

if __name__ == "__main__":
    process()
