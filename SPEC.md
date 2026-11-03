

## 1. 给 Antigravity 的总角色

```text
你是 Cocos Creator 3.8 + 微信小游戏专家，同时负责 2D 暖色素材出图。
唯一规格：仓库根目录 SPEC.md。与 SPEC 冲突时以 SPEC 为准。
先出 Implementation Plan Artifact，等人回复「按计划执行」再改代码。
每个任务结束必须交付：改动文件列表、如何在编辑器里验收、未做事项。
```

工作模式：

| 模式 | 何时用 |
|---|---|
| Planning | 每个大模块开工前，出计划 Artifact |
| 单 Agent | 改一个系统（行动点、合成、广告） |
| 子 Agent 并行 | 生图批量、写配置表、写平台适配可同时开 |
| Browser Agent | 只测分享卡 HTML 原型；正式游戏无 DOM，禁止做成网页游戏 |

---

## 2. 仓库与职责边界

```text
chuang-nan-xiangfen/
  SPEC.md
  AGENTS.md                  # 第 12 节精简版
  assets/
    scenes/                  # Shop / Bench / Window / Album / Decor
    scripts/
      core/                  # GameModel Save ActionPoint Time
      blend/                 # 合成
      order/                 # 订单
      farm/                  # 花盆
      shop/                  # 货架 客人
      ads/                   # 微信广告封装
      share/                 # 分享卡
      ui/
    tables/                  # JSON 配置，禁止把配方写死在脚本
      notes.json
      recipes.json
      bottles.json
      guests.json
      orders.json
      decor.json
      economy.json
    art/
      notes/                 # 8 图标
      bottles/               # 成品瓶
      shop/                  # 铺面 货架档
      guests/
      ui/
      fx/                    # 雾粒子贴图
    audio/                   # 极少，可后期
  preview-share/             # 仅分享卡 HTML 草稿，不进微信主包
  docs/
    prompts-art.md           # 生图提示词库
    week1-accept.md
```

---

## 3. 产品范围（按原案锁死）

### 3.1 做

- 5 个主界面：铺面、工台、窗台、图鉴、布置
- 循环：备料 → 调瓶 → 交货/上架
- 行动点 + 短等待 + 激励视频加速
- 货架变好看、金币升级
- 分享货架图、好友助力花盆（后期）、简单周榜（可先不做）

### 3.2 不做

- 真实前中后调百分比、法语大牌词、香奈儿/祖马龙瓶型
- 乙游剧情树、拜访偷香、强迫分享才能玩
- 3D 瓶子旋转、室内漫游、角色立绘剧情
- 内购、人民币价格、「立即购买」
- 上线就做无限随机配方

### 3.3 两套内容量

**MVP（必须先做完再加量）**

- 1 铺、1 工台、3 花盆
- 5 香调、6 瓶图鉴
- 4 种订单
- 货架 2 档、墙纸 2 套
- 激励广告 3 个位
- 分享货架

**完整上线目标**

- 8 香调、12 瓶图鉴
- 6～8 客人模板，最多 3 个具名常客
- 货架 4→8→12
- 布置：墙纸/窗/灯/地毯 + 2 个节日小物件
- 广告位按原案第 6 节

---

## 4. 核心循环与数值（上线先锁死）

每日三拍：

1. **备料** 窗台花盆收取。空了等 3～5 分钟，或看广告立刻好。耗 1 点。
2. **调一瓶** 选 2 个香调（后期可 3）。合成起雾出瓶。失败灰雾，原料部分返还。耗 2 点。新瓶定香 90 秒，可看广告跳过。
3. **交货/上架** 客人要标签。对上得金币和口碑；对不上可改调或先上架。

数值（`economy.json`，禁止改脚本里的魔法数）：

- 行动点上限 20，回复 1 点 / 5 分钟
- 第一瓶售价 30 金币
- 货架升级 200 / 600（4→8、8→12 两档；12 格为最高档，无第三级）
- 图鉴 12 瓶，正常玩 7～10 天集齐基础；节日瓶上线后再加，每次最多 +2

一句话验收：

> 没广告也能做完「做一瓶 + 交一单」；广告只让少等、多做一个。

---

## 5. 表驱动设计（Agent 必须先建表再写逻辑）

### 5.1 `notes.json`（香调）

MVP 用前 5 个；完整版 8 个。

| id | name | color | tags |
|---|---|---|---|
| A | 雨后 | 青 | 清新,水 |
| B | 窗南 | 暖黄 | 暖,日晒 |
| C | 青橘 | 橙 | 果,醒神 |
| D | 茶汤 | 绿褐 | 木,静 |
| E | 绒花 | 粉 | 花,送人 |
| F | 晚风 | 蓝紫 | 静,夜 |
| G | 朝露 | 浅绿 | 清新,草 |
| H | 沉檀 | 檀木棕 | 木,暖 |

字段：`id, name, colorHex, tags[], icon, unlockDay`。

### 5.2 `recipes.json`

规则人能记住：

- 同标签相合 → 稳定成品
- 清新 + 花 → `spring_letter` 春日纸信
- 暖 + 静 → `evening_lamp` 晚归灯
- 冲突/过冲 → `fail` 或 `practice` 练习瓶（低价回收）

字段示例：

```json
{
  "id": "spring_letter",
  "inputs": ["A", "E"],
  "match": "tags:清新+花",
  "bottleId": "spring_letter",
  "result": "success"
}
```

输入顺序无关。查表优先于算法。没有命中再走「标签交集 / 冲突」兜底。禁止百分比调香。

### 5.3 `bottles.json`

```json
{
  "id": "spring_letter",
  "name": "春日纸信",
  "shape": "spray|frost_square|round",
  "colorDots": ["#7EC8C8", "#F4B6C2"],
  "blurb": "进门换鞋那一瞬",
  "price": 30,
  "sprite": "art/bottles/spring_letter.png"
}
```

图鉴一瓶一页：大图、两个色点、一句场景。

### 5.4 `guests.json` / `orders.json`

6～8 模板轮换。每人 1 个标签 + 一句台词。

例：`今天想闻起来干净一点。` → 标签 `清新`。

交对：金币 + 好评；连续好评涨店级。  
看广告：刷新订单或「客人多等一轮」。

最多 3 个具名常客。好感只改一句台词、偶尔送种子。禁止乙游分支。

### 5.5 `decor.json`

货架格 4 / 8 / 12。墙纸、窗、灯、小地毯。春节结、梅雨风铃各 1。布置只耗金币，不耗行动点。

---

## 6. 生图规范（Antigravity 原生 `generate_image`）

### 6.1 总风格（每次调用都带上）

```text
2D game prop illustration, warm afternoon 4pm window light,
clean object edges, cozy small shop, not photoreal lab,
not luxury brand showcase, no logos, no trademarks,
soft Chinese cottagecore, pastel but readable,
transparent background PNG for props and icons.
```

### 6.2 定妆（Week 0，必须人点头再批量）

连续三次 `generate_image`，保存为：

- `assets/art/_lock/shop_key.png` 铺面
- `assets/art/_lock/bottle_key.png` 喷头瓶
- `assets/art/_lock/note_key.png` 香调图标

人回复「定妆通过」后，后续出图把这三张放进 `ImagePaths` 做一致性参考。

### 6.3 文件名与尺寸

| 资产 | 路径 | 尺寸 | 比例 |
|---|---|---|---|
| 香调图标 | `art/notes/{id}.png` | 256 | 1:1 |
| 成品瓶 | `art/bottles/{id}.png` | 512 高 | 3:4 |
| 铺面背景 | `art/shop/bg.png` | 宽 1280 内 | 9:16 竖屏 |
| 货架空/有货/满 | `art/shop/shelf_1..3.png` | 按 UI | |
| 客人半身 | `art/guests/{id}.png` | 512 | 3:4 |
| UI 按钮九宫 | `art/ui/` | 小图 | |
| 雾粒子 | `art/fx/mist_{color}.png` | 128 | 1:1 |

禁止把 2K/4K 原图打进主包。原图可另存 `art/_raw/`，构建只用压缩图。

### 6.4 批量提示词模板

香调图标：

```text
Small square game icon of perfume note "{name}", dominant color {color},
simple symbol, no text, 2D, clean edge, transparent background.
Reference style: [note_key.png]
```

瓶子（轮廓必须差开）：

```text
2D perfume bottle game asset, shape={spray|frosted square|small round},
two color dots {c1} {c2}, afternoon window light, no brand text,
transparent PNG. Reference: [bottle_key.png]
```

客人：

```text
2D bust of a casual young woman customer, warm indoor light,
simple clothing, no anime face dump, no realistic pore skin,
transparent background. Reference shop palette from [shop_key.png]
```

### 6.5 子 Agent 生图任务单

一次只开一个主题，避免风格漂：

1. `notes` 5 或 8 张  
2. `bottles` MVP 6 张  
3. `shop` 背景 + 3 档货架  
4. `guests` 3 张  
5. `ui` + `fx`

每批结束后人看：轮廓是否重复、是否像搜到的大牌瓶、透明度是否干净。

---

## 7. 场景与脚本（Cocos）

竖屏 720×1280 逻辑分辨率。5 个场景够用。

### 7.1 Shop（铺面）

节点：`BG / ShelfGrid / Guest / BtnBench / BtnWindow / BtnAlbum / BtnDecor / ActionBar / CoinLabel`

脚本：`ShopView.ts` `Shelf.ts` `GuestPresenter.ts`

### 7.2 Bench（工台）

节点：`SlotA / SlotB / BtnBlend / MistFX / ResultBottle / BtnRetry`

脚本：`BlendView.ts` `BlendSystem.ts`

雾：同一套粒子换 5 色。失败播灰雾。

### 7.3 Window（窗台）

节点：`Pot1..3 / CollectBtn`

脚本：`FarmView.ts` `Pot.ts`  
花盆一轮 3～5 分钟，看广告成熟。

### 7.4 Album / Decor

图鉴 12 格。布置列表用金币买，即时换装，不耗行动点。

### 7.5 引导（首次 60 秒）

`Tutorial.ts`：收一朵花 → 调一瓶 → 交给第一个客人。禁止长剧情。

### 7.6 平台层

```text
assets/scripts/ads/RewardedAd.ts     wx.createRewardedVideoAd
assets/scripts/ads/InterstitialAd.ts 少用：店级升级、每日第一次回店
assets/scripts/platform/Share.ts     Canvas 截货架
assets/scripts/platform/Cloud.ts     云开发：图鉴、行动点
assets/scripts/platform/Storage.ts   本地优先，云同步
```

文案只写「观看短片加速」，禁止「充值」。

广告位（MVP 只做前 3 个）：

1. 定香加速  
2. 补行动点（每日上限）  
3. 花盆立刻成熟  
4. 双倍订单奖励（交单后弹出）  
5. 解锁瓶贴（装饰，非进度门）  
6. 插屏少用  

---

## 8. 三阶段排期（按 Antigravity 任务切）

### 第 0 周：项目脚手架（0.5～1 天）

Agent：

- 建 `tables` 空 JSON 与 TypeScript 类型
- 建 5 个空场景说明文档（节点树）
- 写 `Storage` `GameModel` 骨架
- 出定妆 3 张图

人：Cocos 建 5 场景、定妆点头、填 AppID。

验收：编辑器能切 5 个空场景；本地能存一个空存档。

### 第 1～3 周：竖切片（必须「能玩一天」）

范围锁死：

- 3 花盆里先做 1 种原料
- 2 个香调合成 1 瓶（建议 雨后+绒花=春日纸信，或先做任意成功+失败两条）
- 1 个客人、1 个广告位（定香 90 秒）
- 行动点 20 / 5 分钟 1 点
- 没广告也能做完一单

并行建议：

- Agent-Logic：行动点、收原料、合成、交货  
- Agent-Art：定妆通过后的 2 图标 + 1 瓶 + 1 铺面简化背景  
- Agent-Ad：激励视频封装，开发者工具里用测试广告位

验收清单写入 `docs/week1-accept.md`：

- [ ] 冷启动 60 秒引导跑通  
- [ ] 零广告完成做一瓶+交一单  
- [ ] 看一次广告跳过定香  
- [ ] 杀进程重开存档还在  
- [ ] 无人民币符号、无品牌名  

未达验收禁止加装修、图鉴、第三香调、节日。

### 第 4～6 周：内容加到完整量

8 香调、12 瓶、货架升级、布置约 10 件、订单池、图鉴。全表驱动。节日瓶只留字段，不上内容。

### 第 7～8 周：社交与打磨

分享「今日出品」卡片（Canvas 截货架）。  
好友助力花盆每天限次。  
周榜可砍。  
每日签到送一盆。  
空状态文案、引导打磨。

### 第 9～10 周：合规

隐私、适龄、广告标识、自审、软著材料、名称检索、ICP。  
说明书模块与截图一一对应（原案第 10 节 7 模块）。  
写明：虚拟经营，不涉及真实商品交易与人民币充值。

### 第 11～12 周：提审缓冲

预留改名、改图、打回。主包压进 4MB：大图远程或分包，分离引擎。

---

## 9. 软著与审核（Agent 出草稿，人签字）

软著全称示例：`窗南香氛铺模拟经营软件`

说明书模块：

1. 用户与存档  
2. 原料种植与收取  
3. 香调合成与成品生成  
4. 订单交付与店铺评价  
5. 货架陈列与店铺布置  
6. 行动点与加速  
7. 图鉴收集  

自审：无真实品牌；无治病/催情/招财；无酒精滥用；无擦边包装；客人口语生活化不涉政。界面无人民币、「立即购买」。

源码前后 30 页必须来自可运行工程，不要整页粘贴未改过的 AI 空话。瓶子用改过轮廓的图。

---

## 10. 风险（原案 + Antigravity 专项）

| 风险 | 对策 |
|---|---|
| 闻不到显得空 | 交货必有表情+一句话；货架视觉优先 |
| 像换皮餐厅 | 主操作是调瓶；客人要标签不要菜名 |
| 一个月玩完 | 表预留节日瓶、新墙纸，热更只改 JSON |
| 名称/商标 | 上线前微信搜 + 简单查标，3 个备选名 |
| 审核像电商 | 无人民币、无立即购买 |
| Google 生图风格漂 | 先定妆 3 张，后续全部 ImagePaths 参考 |
| 4K 图撑爆 4MB | `_raw` 与正式资源分离，构建前压缩 |
| Agent 写成 H5 | Rules 写死：无 DOM、用 `wx.*` |
| 国内 API 不稳定 | 逻辑先本地可玩；生图可降级即梦但文件名不变 |
| MCP 不稳 | 人在 Cocos 拖节点，Agent 只保证脚本接口 |

---


```text
阅读 SPEC.md。不要先写业务代码。

先输出 Implementation Plan Artifact，只包含「第 0 周 + 第 1 周竖切片」：
1. 将创建的文件列表
2. notes/recipes/bottles/guests/economy 的最小 JSON 示例（MVP：2 香调、1 成功配方、1 失败、1 客人）
3. 脚本职责与场景节点树
4. 三次定妆 generate_image 的完整 prompt 和保存路径
5. 在 Cocos 里我需要手动做的步骤

约束：
- Cocos 3.8 TypeScript，微信小游戏
- 无 window/document/fetch，用 wx
- 无内购
- 没广告也能做一瓶交一单
- 内容只走 tables/
等我回复「按计划执行」后再改仓库。
```

竖切片通过后，第二段：

```text
竖切片已验收。按 SPEC 第 8 节进入第 4～6 周。
先扩展 tables 到 8 香调 12 瓶，再写 UI。
每加一种瓶必须同时：recipes 一行、bottles 一行、art/bottles 一张图、图鉴页能打开。
禁止加节日剧情和第三香调槽，除非我明确说。
```

---

## 12. `AGENTS.md` / Skill 原文（整段保存）

```text
# 窗南香氛铺开发规则

你正在实现微信小游戏「窗南香氛铺」。规格以 SPEC.md 为准。

## 技术
- Cocos Creator 3.8 + TypeScript
- 发布微信小游戏；无 DOM；存储 wx.setStorageSync；网络 wx.request；广告 wx.createRewardedVideoAd
- 配置全在 assets/tables/*.json
- 禁止修改 library/ temp/ local/

## 产品
- 休闲模拟，女向，单次 3～8 分钟
- 循环：收原料 → 2 香调合成 → 交货或上架
- 行动点 20，5 分钟回 1；调瓶 2 点；收盆 1 点；定香 90 秒
- 个人主体纯广告。文案「观看短片加速」。禁止充值、人民币、立即购买
- 禁止真实品牌、功效承诺、治病催情招财、擦边

## 内容
- MVP：5 调 6 瓶 4 订单 3 广告位；完整：8 调 12 瓶
- 合成：查表 + 标签；冲突失败或练习瓶；禁止前中后调百分比
- 客人只要 1 个标签 + 一句台词；最多 3 常客
- 主操作是调瓶不是炒菜

## 美术
- 用 generate_image。风格：2D，下午四点窗光，干净边缘，非写实实验室
- 先定妆 3 张再批量；道具透明 PNG
- 瓶型必须 spray / frost_square / round 差开
- 正式资源限尺寸，4K 只放 art/_raw

## 协作
- 大任务先计划后动手
- 结束时列出文件、人工验收步骤、未做项
- 不要一次做完整 12 周；当前阶段以外的功能只留接口或表字段
```
