# -*- coding: utf-8 -*-
"""
add_expression_guests.py
Crops expression avatars to 144x192 without altering background colors,
generates .meta files, and adds the 5 characters to guests.json, orders.json, and corpus.json.
"""
import json
import os
import uuid
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(__file__))
EXP_DIR = os.path.join(ROOT, "assets", "art", "expressions")
GUEST_ART_DIR = os.path.join(ROOT, "assets", "art", "guests")
GUESTS_JSON = os.path.join(ROOT, "assets", "tables", "guests.json")
ORDERS_JSON = os.path.join(ROOT, "assets", "tables", "orders.json")
CORPUS_JSON = os.path.join(ROOT, "assets", "tables", "corpus.json")

GUEST_DEFS = [
    {
        "id": "guest_luca",
        "name": "游方乐师·卢卡",
        "src": "luca_smile.png",
        "dialog": "酒馆里太喧闹了，就想寻一味山野雨后青草泥土的清润草香佐琴。",
        "requiredTag": "草",
        "baseRewardCoin": 38,
        "rewardReputation": 1
    },
    {
        "id": "guest_arya",
        "name": "远行学者·艾莉亚",
        "src": "arya_smile.png",
        "dialog": "连夜整理草木考察札记，最盼着一缕如清晨微风般干干净净的清凉。",
        "requiredTag": "清新",
        "baseRewardCoin": 36,
        "rewardReputation": 1
    },
    {
        "id": "guest_hans",
        "name": "舶来客商·汉斯",
        "src": "hans_determined.png",
        "dialog": "船队远洋归航靠岸，就想带一味如壁炉烘晒般踏实温暖的暖意回家。",
        "requiredTag": "暖",
        "baseRewardCoin": 42,
        "rewardReputation": 1
    },
    {
        "id": "guest_mia",
        "name": "寻香少女·米娅",
        "src": "mia_happy.png",
        "dialog": "江南水乡集市上的甜果子真诱人，想挑一瓶水灵欢快的鲜果香带走。",
        "requiredTag": "果",
        "baseRewardCoin": 35,
        "rewardReputation": 1
    },
    {
        "id": "guest_jinyunu",
        "name": "戏班名伶·金玉奴",
        "src": "jinyunu_choke.png",
        "dialog": "今夜梨园有大戏开锣，登台前想寻一抹幽雅出尘的月下夜调伴我水袖起舞。",
        "requiredTag": "夜",
        "baseRewardCoin": 40,
        "rewardReputation": 1
    }
]

def step1_crop_images():
    print("=== Step 1: Cropping images to 144x192 (keeping original background) ===")
    for g in GUEST_DEFS:
        src_path = os.path.join(EXP_DIR, g["src"])
        dst_path = os.path.join(GUEST_ART_DIR, f"{g['id']}.png")
        meta_path = os.path.join(GUEST_ART_DIR, f"{g['id']}.png.meta")

        im = Image.open(src_path)
        w, h = im.size
        # Center crop width from 192 to 144, height remains 192
        left = (w - 144) // 2
        cropped = im.crop((left, 0, left + 144, 192))
        cropped.save(dst_path, format="PNG", optimize=True)
        print(f"Saved {dst_path} ({cropped.size}, {os.path.getsize(dst_path)} bytes)")

        # Create meta file
        base_uuid = str(uuid.uuid4())
        tex_uuid = f"{base_uuid}@6c48a"
        sf_uuid = f"{base_uuid}@f9941"
        nw, nh = 144, 192
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
                    "displayName": g["id"],
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
                    "displayName": g["id"],
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
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta_data, f, indent=2)
        print(f"Created meta: {meta_path}")

def step2_update_guests_and_orders():
    print("\n=== Step 2: Updating guests.json and orders.json ===")
    with open(GUESTS_JSON, "r", encoding="utf-8") as f:
        guests = json.load(f)

    with open(ORDERS_JSON, "r", encoding="utf-8") as f:
        orders = json.load(f)

    existing_guest_ids = {g["id"] for g in guests}
    order_num = len(orders) + 1

    for g in GUEST_DEFS:
        if g["id"] not in existing_guest_ids:
            guests.append({
                "id": g["id"],
                "name": g["name"],
                "avatar": f"art/guests/{g['id']}.png",
                "dialog": g["dialog"],
                "requiredTag": g["requiredTag"],
                "baseRewardCoin": g["baseRewardCoin"],
                "rewardReputation": g["rewardReputation"]
            })
            orders.append({
                "id": f"order_{order_num:02d}",
                "guestId": g["id"],
                "requiredTag": g["requiredTag"],
                "rewardCoin": g["baseRewardCoin"]
            })
            order_num += 1

    with open(GUESTS_JSON, "w", encoding="utf-8") as f:
        json.dump(guests, f, ensure_ascii=False, indent=2)
    print(f"Updated guests.json: now {len(guests)} guests.")

    with open(ORDERS_JSON, "w", encoding="utf-8") as f:
        json.dump(orders, f, ensure_ascii=False, indent=2)
    print(f"Updated orders.json: now {len(orders)} orders.")

if __name__ == "__main__":
    step1_crop_images()
    step2_update_guests_and_orders()
