# Soft SFX + BGM (procedural)

短、软、不刺耳。由脚本合成后转 ogg，供 `AudioKit` 从 `audio` bundle 加载。

| 文件 | 用途 |
|------|------|
| ui_tap | 导航点击 |
| harvest | 窗台采摘 |
| blend_start / blend_ok / blend_fail | 工台调和 |
| cure_ready | 定香完成可领取 |
| shelf | 上架 |
| deliver / coin | 交货与金币 |
| bgm_soft | 极轻循环铺垫（可随静音关闭） |

重新生成 SFX：`python3 tools/gen_soft_sfx.py`（若仓库带 tools）。
