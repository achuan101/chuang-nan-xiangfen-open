// 无头布局校验：node 下挂载 5 个 View，扫描状态组合，复算引擎会不会静默缩字号 / 有没有越界或顶栏撞位。
// 用法：npm run check:ui   （等价 node tests/build-check.mjs layoutCheck）
// 'cc' 由 tests/build-check.mjs 通过 esbuild alias 换成 tests/cc-ui-stub.ts。
declare const process: { exit(code?: number): never };

import { Component, Button, Graphics, Label, Node, ScrollView, Sprite, UIOpacity, UITransform } from './cc-ui-stub';

import { GameModel } from '../assets/scripts/core/GameModel';
import { ConfigManager } from '../assets/scripts/core/ConfigManager';
import { I18n, Lang } from '../assets/scripts/core/I18n';
import { ShopView } from '../assets/scripts/shop/ShopView';
import { BlendView } from '../assets/scripts/blend/BlendView';
import { FarmView } from '../assets/scripts/farm/FarmView';
import { AlbumView } from '../assets/scripts/shop/AlbumView';
import { DecorView } from '../assets/scripts/shop/DecorView';
import { GuestPresenter } from '../assets/scripts/shop/GuestPresenter';
import { Shelf } from '../assets/scripts/shop/Shelf';
import { ComicPanelModal } from '../assets/scripts/ui/ComicPanelModal';
import { NewsPresenter } from '../assets/scripts/ui/NewsPresenter';
import { Tutorial } from '../assets/scripts/ui/Tutorial';

// 内存存档：layoutCheck 只看布局，不落真档。
const _store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null),
  setItem: (k: string, v: string) => {
    _store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete _store[k];
  },
};

const fails: string[] = [];

function check(cond: boolean, msg: string): void {
  if (!cond) fails.push(msg);
}

const DESIGN_W = 720;
const DESIGN_H = 1280;
/** 刻意铺满屏幕或盖满全屏的底衬/特效/全屏弹窗模态，不参与同层撞位判定 */
const BG_NODES = new Set([
  'BG',
  'RugFX',
  'LightFX',
  'AmbientBG',
  'AmbientBGVeil',
  'Camera',
  'MistFX',
  'AmbientFX',
  'NewsModalRoot',
  'BlendResultModal',
  'StorageDrawer',
  'ComicPanelModalRoot',
  'GuideModalRoot',
  'CelebrationModalRoot',
  'GuideFingerContainer',
]);
/** 顶栏/导航/内容槽之外允许贴边的结构件 */
const TOLERANCE = 2;

interface Mounted {
  name: string;
  canvas: Node;
  comp: any;
}

const mounted: Mounted[] = [];

function mount(name: string, cls: new () => any): Mounted {
  const canvas = new Node(`${name}Canvas`);
  const comp = canvas.addComponent(cls);
  const m = { name, canvas, comp };
  mounted.push(m);
  return m;
}

function walk(
  node: Node,
  visit: (n: Node, pathStr: string, inScroll: boolean) => void,
  prefix = '',
  inScroll = false,
): void {
  const pathStr = prefix ? `${prefix}/${node.name}` : node.name;
  const scrollHere = inScroll || !!node.getComponent(ScrollView);
  visit(node, pathStr, scrollHere);
  for (const child of node.children) walk(child, visit, pathStr, scrollHere);
}

/** 泵一遍所有组件的 update（定香倒计时、生长进度这类按秒刷新的文案只有这时才会变最长） */
function pump(): void {
  for (const m of mounted) {
    m.canvas.allComponents().forEach(c => {
      if (typeof c.update === 'function') c.update(1.5);
    });
  }
}

function emitAll(): void {
  const model = GameModel.instance;
  [
    'coins_changed',
    'ap_changed',
    'speedup_changed',
    'inventory_changed',
    'shelf_changed',
    'order_changed',
    'tutorial_changed',
    'decor_changed',
    'reputation_changed',
    'album_changed',
    'curing_started',
    'curing_completed',
    'bottle_claimed',
    'blend_failed',
  ].forEach(e => model.emit(e));
}

function pathOf(node: Node): string {
  const parts: string[] = [];
  let n: Node | null = node;
  while (n) {
    parts.unshift(n.name);
    n = n.parent;
  }
  return parts.join('/');
}

function boxOf(node: Node): { w: number; h: number; cx: number; cy: number } | null {
  const tr = node.getComponent(UITransform);
  if (!tr || tr.width <= 0 || tr.height <= 0) return null;
  const c = node.centerPos();
  return { w: tr.width, h: tr.height, cx: c.x, cy: c.y };
}

/** 一次全树体检：静默缩字号 / 可读下限 / 越界 / 同层撞位 */
const seenKeys = new Set<string>();

function audit(tag: string, checkOverlap = true): void {
  const fail = (key: string, msg: string) => {
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    fails.push(`(首见于 ${tag}) ${msg}`);
  };

  for (const m of mounted) {
    walk(m.canvas, (node, _p, inScroll) => {
      const lab = node.getComponent(Label);
      if (lab) {
        const actual = lab._actualFontSize;
        const tr = node.getComponent(UITransform);
        const box = tr ? `${tr.width}x${tr.height}` : '无盒';
        const text = lab.string.replace(/\n/g, '⏎');
        if (actual < lab.fontSize) {
          fail(
            `${m.name}/${pathOf(node)}/缩`,
            `${m.name} ${pathOf(node)} 字号被静默缩：声明 ${lab.fontSize} → 实渲 ${actual}，` +
              `盒 ${box}，行高 ${lab.lineHeight}，文本「${text}」`,
          );
        }
        if (text.length > 0 && actual < 15) {
          fail(
            `${m.name}/${pathOf(node)}/下限`,
            `${m.name} ${pathOf(node)} 实渲 ${actual} 低于可读下限 15，盒 ${box}，文本「${text}」`,
          );
        }
        if (text.length > 0 && (!tr || tr.width <= 0 || tr.height <= 0)) {
          fail(`${m.name}/${pathOf(node)}/空盒`, `${m.name} ${pathOf(node)} 有文案但没有有效盒子`);
        }
      }

      const sp = node.getComponent(Sprite);
      if (sp && sp.spriteFrame) {
        const tr = node.getComponent(UITransform);
        if (!tr || tr.width <= 0 || tr.height <= 0) {
          fail(
            `${m.name}/${pathOf(node)}/贴图无盒`,
            `${m.name} ${pathOf(node)} 已贴图但没有 UITransform 尺寸，applySpriteFit 会把原盒记成 0`,
          );
        }
      }

      const box = boxOf(node);
      if (!box) return;
      if (!inScroll) {
        const overX = box.w / 2 + Math.abs(box.cx) - DESIGN_W / 2;
        const overY = box.h / 2 + Math.abs(box.cy) - DESIGN_H / 2;
        if (overX > TOLERANCE || overY > TOLERANCE) {
          fail(
            `${m.name}/${pathOf(node)}/出画`,
            `${m.name} ${pathOf(node)} 出画：盒 ${box.w}x${box.h} 中心 (${box.cx.toFixed(1)}, ${box.cy.toFixed(1)})，` +
              `超出 ${overX > TOLERANCE ? `x ${overX.toFixed(1)}` : ''}${overY > TOLERANCE ? ` y ${overY.toFixed(1)}` : ''}`,
          );
        }
      }

      // 同层撞位：只比画布直属子节点（内容块各自排布，天然会叠在父容器里）
      if (!checkOverlap || node.parent !== m.canvas) return;
      if (BG_NODES.has(node.name)) return;
      for (const sibling of node.parent.children) {
        if (sibling === node || BG_NODES.has(sibling.name)) continue;
        if (!sibling.active) continue;
        const b2 = boxOf(sibling);
        if (!b2) continue;
        const overlapX = Math.min(box.cx + box.w / 2, b2.cx + b2.w / 2) - Math.max(box.cx - box.w / 2, b2.cx - b2.w / 2);
        const overlapY = Math.min(box.cy + box.h / 2, b2.cy + b2.h / 2) - Math.max(box.cy - box.h / 2, b2.cy - b2.h / 2);
        if (overlapX > TOLERANCE && overlapY > TOLERANCE) {
          fail(
            `${m.name}/撞位/${[node.name, sibling.name].sort().join('~')}`,
            `${m.name} 同层撞位：${node.name} 与 ${sibling.name} 重叠 ${overlapX.toFixed(1)}x${overlapY.toFixed(1)}`,
          );
        }
      }
    });
  }
}

/** 隐藏态也走一遍：加速卡按钮、定香面板这类只在某状态出现的盒，最容易带着错盒上线。
 *  只查缩字号与出画 —— 互斥按钮（采摘/加速卡、定香出瓶/短片加速）本来就同位，撞位判定在这一趟无意义。 */
function auditHiddenToo(tag: string): void {
  const restored: Array<{ n: Node; v: boolean }> = [];
  const flip = (n: Node) => {
    if (!n.active) restored.push({ n, v: false });
    n.active = true;
    n.children.forEach(flip);
  };
  mounted.forEach(m => flip(m.canvas));
  audit(`${tag}+全显`, false);
  restored.forEach(r => (r.n.active = r.v));
}

function stressStates(): void {
  const model = GameModel.instance;

  // 数值拉到最长文案会出现的量级：金币 5 位、加速卡 3 位、行动点满格
  model.addCoins(99999);
  model.grantSpeedup(100);
  model.addActionPoints(ConfigManager.economy.maxActionPoints);
  model.setMuted(true);
  model.setMuted(false);

  // 8 香调全入包且数量为两位数，工台香调行与背包行同时变宽
  ConfigManager.getAllNotes().forEach(n => model.addNote(n.id, 99));
  model.tutorialCompleted = false;
  model.addReputation(10);

  // 图鉴全解锁：卡片名/标签行只有解锁态才用真名
  ConfigManager.getAlbumBottles().forEach(b => model.markBottleObtained(b.id));

  // 货架升满 12 格并铺满长瓶名
  model.upgradeShelf();
  model.upgradeShelf();
  ConfigManager.getAllBottles()
    .filter(b => b.id !== 'practice_bottle')
    .slice(0, model.shelfSlotCount)
    .forEach(b => model.putOnShelf(b.id));

  // 练习瓶堆到三位数：回收按钮文案变最长
  for (let i = 0; i < 120; i++) model.bottlesInventory.push('practice_bottle');

  // 三盆分别处于可采 / 生长中 / 刚种下
  model.pots.forEach((pot, i) => {
    pot.plantNoteId = ['A', 'E', 'H'][i] || 'A';
    pot.growDuration = 180;
    pot.plantTime = i === 0 ? Date.now() - 200000 : i === 1 ? Date.now() - 60000 : Date.now();
  });

  // 定香中：BlendView 的倒计时与「观看短片加速」文案在这一态才出现
  model.activeCuring = { bottleId: 'courtyard_orange', startTime: Date.now(), durationSeconds: 90 };
}

function sweepOrders(): void {
  const model = GameModel.instance;
  const orders = ConfigManager.getInitialOrders();
  const shop = mounted.find(m => m.name === 'Shop');
  const presenter = shop ? shop.canvas.getChildByName('GuestArea')?.getComponent(GuestPresenter) : null;

  // 每个客人/标签组合都刷一遍：台词、需求两行、交付按钮文案各自的最长态
  orders.forEach(order => {
    model.currentOrder = { ...order };
    model.emit('order_changed');
    if (presenter) presenter.refreshGuest();
    audit(`订单 ${order.id}`);
  });

  if (presenter) {
    // 有匹配瓶 → 交付按钮带瓶名与奖励；无匹配 → 缺瓶提示 + 去工台按钮
    model.shelfBottles[0] = 'spring_letter';
    model.emit('shelf_changed');
    presenter.refreshGuest();
    audit('可交付态');

    model.currentOrder = null;
    presenter.refreshGuest();
    audit('无客人态');

    model.currentOrder = { ...orders[0] };
    model.dailyGuestRefreshUsed = ConfigManager.economy.refreshOrderFreeDaily;
    model.coins = 0;
    presenter.onRefreshGuestClick();
    audit('换客失败态');
  }
}

function sweepTutorial(): void {
  const model = GameModel.instance;
  model.tutorialCompleted = false;
  const steps = ['go_window', 'harvest', 'go_bench', 'blend', 'wait_cure', 'claim', 'go_shop', 'deliver', 'done'] as const;
  steps.forEach(step => {
    model.tutorialStep = step as any;
    model.emit('tutorial_changed');
    pump();
    audit(`引导 ${step}`);
  });
}

/**
 * 交互扫描：真的去点按钮，让只有运行时才写进标签的文案（提示条、picker、飘字、按钮改价）
 * 也走一遍缩字号 / 下限 / 出画判定，顺带跑动效代码不会抛异常。
 */
function sweepInteractions(): void {
  const model = GameModel.instance;
  model.tutorialCompleted = true;
  model.addActionPoints(ConfigManager.economy.maxActionPoints);

  const noteIds = ConfigManager.getAllNotes().map(n => n.id);
  const pairOf = (want: 'success' | 'fail'): [string, string] | null => {
    for (const a of noteIds) {
      for (const b of noteIds) {
        if (a === b) continue;
        if (ConfigManager.matchRecipe([a, b]).result === want) return [a, b];
      }
    }
    return null;
  };

  const bench = mounted.find(m => m.name === 'Bench');
  if (bench) {
    const v = bench.comp;
    let blended = false;
    for (const kind of ['success', 'fail'] as const) {
      const pair = pairOf(kind);
      if (!pair) continue;
      model.addActionPoints(ConfigManager.economy.maxActionPoints);
      v.onSlotTap('A');
      v.onSlotTap('B');
      v.onPickNote(pair[0]);
      v.onPickNote(pair[1]);
      audit(`工台选料 ${kind}`);
      v.onBlendClick();
      audit(`工台调和 ${kind}`);
      if (kind === 'success') blended = !!model.activeCuring;
    }
    // 交互扫描本身也要真的跑到：静默跳过等于没测
    check(blended, '工台成功配方没有进入定香，选料/调和交互未覆盖');

    // 进度条：ops 里应有「轨道 + 填色」两段，第二段宽度就是可视进度
    const cureFillWidths = (): number[] => {
      const panel = v.node.getChildByName('CuringPanel');
      const bar = panel ? panel.getChildByName('CureBar') : null;
      const g = bar ? bar.getComponent(Graphics) : null;
      if (!g) return [];
      return (g.ops as string[])
        .filter(o => o.indexOf('rect:') === 0)
        .map(o => Number(o.slice(5).split('x')[0]));
    };
    let fill = cureFillWidths();
    check(fill.length === 2, `定香进度条没有画出轨道+填色两段，实际 ${fill.length} 段`);
    check(fill[1] === undefined || fill[1] < 40, `刚起调时进度条不该已经有长度：${fill}`);
    audit('工台定香起头');

    model.speedups = 0;
    v.onSpeedupClick();
    audit('工台加速用尽');
    model.activeCuring = { bottleId: 'courtyard_orange', startTime: Date.now() - 80 * 1000, durationSeconds: 90 };
    v.refreshCuringPanel();
    fill = cureFillWidths();
    check(fill[1] > 470 && fill[1] < 560, `定香 80/90 秒时进度条没按时间推进，实际填色 ${fill[1]}`);
    audit('工台定香过半');
    model.activeCuring = { bottleId: 'courtyard_orange', startTime: Date.now() - 200000, durationSeconds: 90 };
    v.refreshCuringPanel();
    fill = cureFillWidths();
    check(fill[1] === 560, `定香完成后进度条应铺满，实际 ${fill[1]}`);
    audit('工台定香完成');
    v.onClaimClick();
    check(!model.activeCuring, '点「定香出瓶」后仍在定香态，出瓶交互未覆盖');
    audit('工台出瓶');
  }

  const win = mounted.find(m => m.name === 'Window');
  if (win && Array.isArray(win.comp.potList)) {
    const pots = win.comp.potList;
    model.pots.forEach(p => {
      p.growDuration = 180;
      p.plantTime = Date.now() - 200000;
    });
    pots.forEach(p => p.refreshView());
    const target = model.pots[0].plantNoteId;
    const before = model.getNoteCount(target);
    pots.forEach(p => p.onHarvestClick());
    check(model.getNoteCount(target) > before, '窗台采摘没有入料，采摘交互未覆盖');
    audit('窗台采摘');
    model.speedups = 0;
    pots[0].onSpeedupClick();
    audit('窗台加速用尽');
    pots[1].onSwitchSeedClick();
    pots[2].onSwitchSeedClick();
    audit('窗台换种');
  }

  const shop = mounted.find(m => m.name === 'Shop');
  if (shop) {
    const shelfNode = shop.canvas.getChildByName('ShelfArea');
    const shelf = shelfNode ? shelfNode.getComponent(Shelf) : null;
    if (shelf) {
      shelf.onSlotClick(null, '0');
      audit('货架取回');
      shelf.showPicker(0);
      check(!!shelf.node.getChildByName('ShelfPicker'), '上架选择面板没被建出来，picker 交互未覆盖');
      audit('货架选择面板');
      const pickBtn = shelf.node.getChildByName('ShelfPicker')?.children.find(c => c.name.indexOf('Pick_') === 0);
      if (pickBtn) pickBtn.emit(Button.EventType.CLICK);
      audit('货架上架');
      shelf.hidePicker();
    }

    const presenter = shop.canvas.getChildByName('GuestArea')?.getComponent(GuestPresenter);
    if (presenter) {
      const order = ConfigManager.getInitialOrders()[0];
      model.currentOrder = { ...order };
      model.shelfBottles[0] = 'spring_letter';
      model.emit('shelf_changed');
      presenter.refreshGuest();
      const repBefore = model.reputation;
      presenter.onSubmitClick();
      check(model.reputation > repBefore, '交付没有加好评，交单交互未覆盖');
      const card = presenter.node.getChildByName('SettleCard');
      check(!!card, '交单后没出现「下一位客人」小票');
      if (card) {
        const texts: string[] = [];
        walk(card, n => {
          const lab = n.getComponent(Label);
          if (lab && lab.string) texts.push(String(lab.string));
        });
        const joined = texts.join(' ');
        const bottleName = ConfigManager.getBottle('spring_letter')!.name;
        check(joined.indexOf(bottleName) >= 0, `小票没写瓶名「${bottleName}」：${joined}`);
        check(joined.indexOf(String(order.rewardCoin)) >= 0, `小票没写金币数 ${order.rewardCoin}：${joined}`);
        check(joined.indexOf('好评') >= 0, `小票没写好评：${joined}`);
      }
      audit('交单成功');
      presenter.onSubmitClick();
      audit('交单失败');
      const dbl = presenter.node.getChildByName('SettleCard');
      if (dbl) dbl.children.find(c => c.name === 'BtnTake')?.emit(Button.EventType.CLICK);
      check(!presenter.node.getChildByName('SettleCard'), '点「下一位客人」后小票没收掉');
      audit('交单收起');
    }
  }

  // 布置页：每张券的按钮都点一次，买入态/已拥有/金币不足三种文案都会出现
  const decor = mounted.find(m => m.name === 'Decor');
  if (decor) {
    const clickables: Node[] = [];
    walk(decor.canvas, n => {
      if (/^(Paper_|BtnUpgradeShelf)/.test(n.name)) clickables.push(n);
    });
    clickables.forEach(n => n.emit(Button.EventType.CLICK));
    audit('布置购买');
    model.coins = 0;
    clickables.forEach(n => n.emit(Button.EventType.CLICK));
    audit('布置金币不足');
  }
}

/** 生长三层叠淡：进度不同 → 幼苗/成熟层的透明度必须不同，否则又退回了硬切 */
function checkGrowthLayers(): void {
  const model = GameModel.instance;
  const win = mounted.find(m => m.name === 'Window');
  if (!win || !Array.isArray(win.comp.potList)) return;
  const opacityOf = (pot: any, layerName: string): number => {
    const layer = pot.node.getChildByName('PlantIcon')?.getChildByName(layerName);
    const op = layer ? layer.getComponent(UIOpacity) : null;
    return op ? op.opacity : -1;
  };
  // 三盆分别摆到成熟 / 幼苗 / 刚种下，覆盖生长三态互斥呈现
  const progress = [1, 0.5, 0];
  let checked = 0;
  win.comp.potList.forEach((pot: any, i: number) => {
    const data = model.pots.find(p => p.id === i + 1);
    if (!data) return;
    data.growDuration = 180;
    data.plantTime = Date.now() - Math.round(180 * progress[i]) * 1000;
    pot.refreshView();
    checked += 1;
    const soil = opacityOf(pot, 'GrowSoil');
    const sprout = opacityOf(pot, 'GrowSprout');
    const ready = opacityOf(pot, 'GrowReady');
    if (progress[i] === 1) {
      check(ready === 255 && soil === 0 && sprout === 0, `${i + 1} 号盆成熟时应仅显示成熟层，实际 成熟 ${ready} / 空土 ${soil}`);
    } else if (progress[i] === 0) {
      check(soil === 255 && sprout === 0 && ready === 0, `${i + 1} 号盆刚种下应仅显示空土层，实际 空土 ${soil}`);
    } else {
      check(sprout === 255 && ready === 0 && soil === 0, `${i + 1} 号盆幼苗期应仅显示幼苗层，实际 幼苗 ${sprout}`);
    }
  });
  check(checked >= 2, `只有 ${checked} 盆有生长数据，生长判定覆盖不足`);
}

function sweepPrologueAndNews(): void {
  const shop = mounted.find(m => m.name === 'Shop');
  if (!shop) return;
  const comicModal = (shop.comp as any)._comicPanelModal as ComicPanelModal | null;
  const newsPresenter = (shop.comp as any)._newsPresenter as NewsPresenter | null;
  const tut = shop.canvas.getComponent(Tutorial);

  const panels = ConfigManager.getProloguePanels();
  const langs: Lang[] = ['zh'];

  for (const lang of langs) {
    if (comicModal) {
      comicModal.showPanels(panels);
      panels.forEach((_, idx) => {
        (comicModal as any)._currentIndex = idx;
        (comicModal as any).renderCurrentPanel();
        pump();
        audit(`漫画[${lang}][p${idx + 1}]`);
      });
      comicModal.close();
    }

    if (newsPresenter) {
      for (let day = 1; day <= 4; day++) {
        const news = ConfigManager.getNewsByDay(day);
        if (news) {
          newsPresenter.show(news);
          pump();
          audit(`晨报[${lang}][d${day}]`);
        }
      }
      if (newsPresenter.paperRootNode) newsPresenter.paperRootNode.active = false;
    }

    if (tut) {
      tut.showCelebration();
      pump();
      audit(`开张庆祝[${lang}]`);
      tut.dismissCelebration();
    }
  }
}

function main(): void {
  mount('Shop', ShopView);
  mount('Bench', BlendView);
  mount('Window', FarmView);
  mount('Album', AlbumView);
  mount('Decor', DecorView);

  check(mounted.length === 5, `应挂载 5 个视图，实际 ${mounted.length}`);
  // 窗光层是纯代码视觉，没挂上不会报错也不会报错文案 —— 只能显式点数
  ['Shop', 'Bench', 'Window', 'Decor'].forEach(name => {
    const m = mounted.find(x => x.name === name);
    const fx = m ? m.canvas.getChildByName('AmbientFX') : null;
    const motes = fx ? fx.children.filter(c => c.name === 'DustFX' || c.name === 'PollenFX') : [];
    const dots = motes.reduce((n, c) => n + c.children.length, 0);
    check(!!fx && dots === 13, `${name} 缺窗光层（AmbientFX 尘埃数 ${dots}，应为 13）`);
  });
  audit('初始');
  auditHiddenToo('初始');

  stressStates();
  emitAll();
  pump();
  audit('压力');
  auditHiddenToo('压力');
  checkGrowthLayers();

  sweepTutorial();
  sweepOrders();
  sweepInteractions();
  sweepPrologueAndNews();

  const langs: Lang[] = ['zh'];
  for (const lang of langs) {
    emitAll();
    pump();
    audit(`中文排版[${lang}]`);
    auditHiddenToo(`中文排版[${lang}]`);
  }

  const totalLabels = (() => {
    let n = 0;
    mounted.forEach(m => walk(m.canvas, node => { if (node.getComponent(Label)) n += 1; }));
    return n;
  })();

  if (fails.length > 0) {
    const uniq = Array.from(new Set(fails));
    console.error(`\nlayoutCheck 失败 ${uniq.length} 项：`);
    uniq.forEach(f => console.error('  - ' + f));
    process.exit(1);
  }
  console.log(
    `layoutCheck: 全部通过（5 屏 ${totalLabels} 个标签 × 压力/引导/订单/点击交互扫描：静默缩字号、可读下限、出画、同层撞位）`,
  );
}

main();
