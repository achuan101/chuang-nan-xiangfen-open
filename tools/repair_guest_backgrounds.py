# -*- coding: utf-8 -*-
"""
repair_guest_backgrounds.py
Extracts character foregrounds from the 4 guest portraits (tea, flower, artisan, poetry),
replaces the background with the warm rice paper (#EDE6DD / RGB 237, 234, 227) matching
all other characters in chuang-nan-xiangfen, resizes to exact 144x192, and updates Cocos .meta files.
"""
import subprocess
from io import BytesIO
import json
import os
from PIL import Image, ImageFilter
import numpy as np
from collections import deque

TARGET_W, TARGET_H = 144, 192
TARGET_BG = np.array([237, 234, 227], dtype=float)  # Warm rice paper background

def get_hires_image(guest_name):
    # Try getting high-res original from git commit 77bbe6aa
    try:
        cmd = ['git', 'show', f'77bbe6aa:public/art/guests/{guest_name}.png']
        data = subprocess.check_output(cmd)
        return Image.open(BytesIO(data))
    except Exception:
        # Fallback to local file in assets/art/guests
        local_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'art', 'guests', f'{guest_name}.png')
        return Image.open(local_path)

def repair_portrait(guest_name):
    print(f"Processing {guest_name}...")
    im_raw = get_hires_image(guest_name).convert('RGB')
    
    # Process at 2x resolution (288 x 384) for crisp anti-aliasing
    work_w, work_h = 288, 384
    im_work = im_raw.resize((work_w, work_h), Image.Resampling.LANCZOS)
    arr = np.array(im_work).astype(float)
    
    # Analyze color saturation and brightness
    max_c = np.max(arr, axis=2)
    min_c = np.min(arr, axis=2)
    sat = (max_c - min_c) / (max_c + 1e-5)
    
    # Background in these AI generations is gray/white studio gradient
    # Candidate bg: low saturation, or top/side regions that match border colors
    bg_cand = (sat < 0.14) & (max_c > 140)
    
    # Also for tea and artisan, bottom corners might have muddy gray/brown
    if guest_name == 'guest_tea':
        # Bottom corners of tea have muddy olive-brown
        for y in range(int(work_h * 0.85), work_h):
            for x in range(int(work_w * 0.12)):
                bg_cand[y, x] = True
            for x in range(int(work_w * 0.88), work_w):
                bg_cand[y, x] = True
    elif guest_name == 'guest_artisan':
        # Bottom left of artisan has white blob in corner
        for y in range(int(work_h * 0.85), work_h):
            for x in range(int(work_w * 0.10)):
                bg_cand[y, x] = True
                
    # Flood-fill from borders
    visited = np.zeros((work_h, work_w), dtype=bool)
    q = deque()
    
    # Top border
    for x in range(work_w):
        if bg_cand[0, x]:
            visited[0, x] = True
            q.append((0, x))
            
    # Upper side borders (down to 75% height)
    for y in range(int(work_h * 0.75)):
        for x in [0, work_w - 1]:
            if not visited[y, x] and bg_cand[y, x]:
                visited[y, x] = True
                q.append((y, x))
                
    # Bottom corners
    for x in [0, 1, 2, work_w - 3, work_w - 2, work_w - 1]:
        if bg_cand[work_h - 1, x] and not visited[work_h - 1, x]:
            visited[work_h - 1, x] = True
            q.append((work_h - 1, x))
            
    # BFS
    while q:
        y, x = q.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = y + dy, x + dx
            if 0 <= ny < work_h and 0 <= nx < work_w and not visited[ny, nx] and bg_cand[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
                
    # Character mask: False where background, True where character
    char_mask = (~visited).astype(np.uint8) * 255
    
    # Smooth edges with Gaussian Blur for subpixel anti-aliasing
    mask_img = Image.fromarray(char_mask).filter(ImageFilter.GaussianBlur(radius=1.8))
    alpha = np.array(mask_img).astype(float) / 255.0
    
    # Defringe / color decontamination:
    # If edge pixels were mixed with old gray background, remove the old gray contribution
    # and blend cleanly with TARGET_BG
    comp = np.zeros_like(arr)
    for c in range(3):
        # Foreground over target warm rice paper background
        comp[:, :, c] = arr[:, :, c] * alpha + TARGET_BG[c] * (1.0 - alpha)
        
    comp = np.clip(comp, 0, 255).astype(np.uint8)
    
    # Resize to exact 144x192
    im_final = Image.fromarray(comp).resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
    
    # Quantize to P mode with 256 colors like guest_walk and guest_student
    im_quantized = im_final.quantize(colors=256, method=Image.Resampling.LANCZOS)
    
    # Save output
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'assets', 'art', 'guests')
    out_path = os.path.join(out_dir, f'{guest_name}.png')
    im_quantized.save(out_path, format='PNG', optimize=True)
    
    file_size = os.path.getsize(out_path)
    print(f"Saved {out_path} ({TARGET_W}x{TARGET_H}, size={file_size} bytes)")
    
    # Update Cocos .meta file
    meta_path = os.path.join(out_dir, f'{guest_name}.png.meta')
    update_cocos_meta(meta_path, TARGET_W, TARGET_H)

def update_cocos_meta(meta_path, w, h):
    if not os.path.exists(meta_path):
        return
    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)
        
    # Update subMetas sprite-frame
    sub_metas = meta.get('subMetas', {})
    for k, v in sub_metas.items():
        if v.get('importer') == 'sprite-frame':
            ud = v.get('userData', {})
            ud['width'] = w
            ud['height'] = h
            ud['rawWidth'] = w
            ud['rawHeight'] = h
            nw, nh = w, h
            ud['vertices'] = {
                "rawPosition": [-nw // 2, -nh // 2, 0, nw // 2, -nh // 2, 0, -nw // 2, nh // 2, 0, nw // 2, nh // 2, 0],
                "indexes": [0, 1, 2, 2, 1, 3],
                "uv": [0, nh, nw, nh, 0, 0, nw, 0],
                "nuv": [0, 0, 1, 0, 0, 1, 1, 1],
                "minPos": [-nw // 2, -nh // 2, 0],
                "maxPos": [nw // 2, nh // 2, 0]
            }
            
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)
    print(f"Updated meta: {meta_path}")

def main():
    guests = ["guest_tea", "guest_flower", "guest_artisan", "guest_poetry"]
    for g in guests:
        repair_portrait(g)
    print("All 4 guest portraits repaired successfully!")

if __name__ == '__main__':
    main()
