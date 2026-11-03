#!/usr/bin/env python3
"""List large assets for WeChat main-package budgeting (E3)."""
from __future__ import annotations
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {'.git', 'library', 'temp', 'local', 'node_modules'}
THRESH = 50 * 1024  # 50KB

BUILD_DIR = ROOT / 'build' / 'wechatgame'
# 微信小游戏主包上限 4096KB；subpackage/ 里的内容不计入主包
MAIN_PACKAGE_CEILING = 4096 * 1024
SUBPACKAGE_DIRNAME = 'subpackage'
# 余量小于这个数就报警：一次加图很容易就顶穿
WARN_MARGIN = 128 * 1024


def main_package_bytes() -> int:
    """字节求和，不是 du 的磁盘占用：NTFS 4KB 簇会让 du 比真实包体多算约 400KB。"""
    total = 0
    for dirpath, dirnames, filenames in os.walk(BUILD_DIR):
        rel = Path(dirpath).relative_to(BUILD_DIR)
        if rel.parts and rel.parts[0] == SUBPACKAGE_DIRNAME:
            dirnames[:] = []
            continue
        for name in filenames:
            try:
                total += (Path(dirpath) / name).stat().st_size
            except OSError:
                continue
    return total


def gate() -> int:
    if not BUILD_DIR.is_dir():
        print(f'[size-gate] 未找到 {BUILD_DIR.relative_to(ROOT).as_posix()}，请先在 Creator 里构建微信小游戏。')
        return 2
    total = main_package_bytes()
    kb = total / 1024
    ceiling_kb = MAIN_PACKAGE_CEILING / 1024
    margin_kb = (MAIN_PACKAGE_CEILING - total) / 1024
    if total > MAIN_PACKAGE_CEILING:
        print(f'[size-gate] FAIL 主包 {kb:.0f}KB > 微信上限 {ceiling_kb:.0f}KB（超出 {kb - ceiling_kb:.0f}KB）')
        print('             先把大图改远程 bundle 或分离引擎，再重新构建。')
        return 1
    if total > MAIN_PACKAGE_CEILING - WARN_MARGIN:
        print(f'[size-gate] WARN 主包 {kb:.0f}KB，余量只有 {margin_kb:.0f}KB，加图前请先做远程 bundle 迁移。')
        return 0
    print(f'[size-gate] OK 主包 {kb:.0f}KB / {ceiling_kb:.0f}KB，余量 {margin_kb:.0f}KB。')
    return 0


def main() -> None:
    # Git Bash 下中文输出会花屏，npm run check:size 要靠它读结论
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if '--gate' in sys.argv[1:]:
        raise SystemExit(gate())

    rows = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP]
        for name in filenames:
            p = Path(dirpath) / name
            try:
                sz = p.stat().st_size
            except OSError:
                continue
            if sz < THRESH:
                continue
            rel = p.relative_to(ROOT).as_posix()
            rows.append((sz, rel))
    rows.sort(reverse=True)
    print(f'# Asset size inventory (>= {THRESH // 1024}KB)\n')
    total = sum(s for s, _ in rows)
    print(f'Tracked large files: {len(rows)}, sum={total/1024/1024:.2f} MB\n')
    print('| KB | Path | Suggestion |')
    print('|---:|------|------------|')
    for sz, rel in rows:
        kb = sz / 1024
        sug = 'keep' if kb < 200 else ('分包/压缩' if '/art/' in rel or rel.endswith(('.png', '.jpg')) else '复核')
        if 'docs/art-keys' in rel:
            sug = '仅文档/锁图，不进包'
        elif 'shop/bg' in rel:
            sug = '已缩压；主包可留'
        print(f'| {kb:.1f} | `{rel}` | {sug} |')


if __name__ == '__main__':
    main()
