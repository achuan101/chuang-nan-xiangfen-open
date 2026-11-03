import { _decorator, Component, director, Label, Button, Node } from 'cc';
import { InterstitialAd } from '../ads/InterstitialAd';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { I18n } from '../core/I18n';
import { ActionBar } from '../ui/ActionBar';
import { applyWallpaperTo } from './Wallpaper';
import {
  bindClick,
  ensureCanvas,
  labelHeightFor,
  makeButton,
  makeLabel,
  makeNode,
  makeSceneTitle,
  paint,
  Palette,
  setLabel,
  Type,
} from '../ui/UiKit';
import { attachAmbientLight } from '../ui/AmbientLight';

const { ccclass } = _decorator;

const TIP_DEFAULT = '🌿 布置只花金币 · 上方实时预览窗景';
const TIP_SECONDS = 2.5;

/** 每张窗景卡片的尺寸与间距（5 张横排铺满 640 容器） */
const CARD_W = 118;
const CARD_H = 148;
const CARD_GAP = 8;

@ccclass('DecorView')
export class DecorView extends Component {
  private _bgNode: Node | null = null;
  private _tip: Label | null = null;
  private _shelfNowLabel: Label | null = null;
  private _shelfUpgradeBtn: Button | null = null;
  private _decorBtns: Map<string, { btn: Button; label: Label }> = new Map();

  start() {
    GameModel.instance.initialize();
    ensureCanvas(this.node);
    this.buildUi();
    this.refreshView();
  }

  public buildUi(): void {
    // ── 背景：全屏预览 ──────────────────────────────────
    this._bgNode = makeNode(this.node, 'BG', 720, 1280, 0, 0);
    this.applyWallpaper();
    attachAmbientLight(this.node);

    makeSceneTitle(this.node, 'DecorTitle', I18n.t('scene_decor'));
    ActionBar.attach(this.node);

    // ── Bottom Sheet（高度 620，坐标 -330 使顶部留约 310 给预览）──
    const sheet = makeNode(this.node, 'BottomSheet', 720, 620, 0, -330);
    paint(sheet, Palette.panel, 28);

    // ① 顶部提示条
    this._tip = makeLabel(
      sheet, 'DecorTip', TIP_DEFAULT,
      660, labelHeightFor(Type.sub, 1), 0, 280,
      Type.sub, Palette.inkSoft,
    );

    // ② 货架卡片（y=195，高 96）
    const shelfCard = makeNode(sheet, 'ShelfCard', 660, 96, 0, 190);
    paint(shelfCard, Palette.cream, 16);

    // 左侧：当前格数标签
    this._shelfNowLabel = makeLabel(
      shelfCard, 'ShelfNow', '',
      260, 52, -160, 6, Type.body, Palette.ink,
    );

    // 左侧副文案
    makeLabel(
      shelfCard, 'ShelfSub', '扩建可陈列更多香氛',
      260, 28, -160, -18, Type.sub, Palette.inkSoft,
    );

    // 右侧：升级按钮
    const shelfBtn = makeButton(shelfCard, 'BtnUpgradeShelf', '', 280, 52, 170, 0, Palette.wood);
    this._shelfUpgradeBtn = shelfBtn.button;
    bindClick(shelfBtn.node, () => this.onUpgradeShelf(), this);

    // ③ 窗景分区标题
    makeLabel(
      sheet, 'PaperTitle', '🌸 节气窗景',
      660, 30, 0, 108, Type.body, Palette.ink,
    );

    // ④ 窗景卡片（横排，自适应容器宽度与卡片数量）
    const papers = ConfigManager.decor.wallpapers;
    const maxRowW = 600;
    const cardGap = papers.length > 5 ? 6 : CARD_GAP;
    const cardW = papers.length > 5 ? Math.floor((maxRowW - (papers.length - 1) * cardGap) / papers.length) : CARD_W;
    const totalW = papers.length * (cardW + cardGap) - cardGap;
    const startX = -totalW / 2 + cardW / 2;
    papers.forEach((paper, i) => {
      const btn = makeButton(
        sheet, `Paper_${paper.id}`, '',
        cardW, CARD_H,
        startX + i * (cardW + cardGap), 5,
        Palette.wood,
      );
      this._decorBtns.set(paper.id, { btn: btn.button, label: btn.label });
      bindClick(btn.node, () => this.onPaper(paper.id), this);
    });

    // ⑤ 底部氛围说明
    makeLabel(
      sheet, 'AtmoTip',
      '💡 窗景同步铺面背景与天色，四季闲情随心换',
      640, labelHeightFor(Type.sub, 2), 0, -110,
      Type.sub, Palette.inkSoft,
    );

    // ⑥ 返回按钮
    const back = makeButton(sheet, 'BtnBack', '返回铺面 ›', 400, 52, 0, -210, Palette.woodDark);
    bindClick(back.node, () => {
      InterstitialAd.show();
      director.loadScene('Shop');
    }, this);
  }

  public applyWallpaper(): void {
    applyWallpaperTo(this._bgNode);
  }

  /** 使用中 / 已拥有 / 可购买 / 金币不足：按状态上色 */
  private applyItemTone(
    item: { btn: Button; label: Label },
    equipped: boolean,
    owned: boolean,
    affordable = true,
  ): void {
    if (equipped) {
      paint(item.btn.node, Palette.mint, 12);
      item.label.color = Palette.paper;
      item.btn.interactable = true;
    } else if (!affordable) {
      paint(item.btn.node, Palette.disabled, 12);
      item.label.color = Palette.disabledText;
      item.btn.interactable = false;
    } else if (owned) {
      paint(item.btn.node, Palette.panel, 12);
      item.label.color = Palette.ink;
      item.btn.interactable = true;
    } else {
      paint(item.btn.node, Palette.wood, 12);
      item.label.color = Palette.paper;
      item.btn.interactable = true;
    }
  }

  public refreshView(): void {
    const model = GameModel.instance;
    const eco = ConfigManager.economy;
    const rawCost = eco.shelfUpgradeCosts[model.shelfTier];
    const canUpgrade =
      model.shelfTier + 1 < eco.shelfSlotTiers.length && typeof rawCost === 'number';
    const cost = canUpgrade ? rawCost : 0;
    const nextSlots = canUpgrade
      ? eco.shelfSlotTiers[model.shelfTier + 1]
      : model.shelfSlotCount;

    if (this._shelfNowLabel) {
      setLabel(this._shelfNowLabel, `货架：${model.shelfSlotCount} 格`);
    }
    if (this._shelfUpgradeBtn) {
      const affordable = model.coins >= cost;
      this._shelfUpgradeBtn.interactable = canUpgrade && affordable;
      const btnNode = this._shelfUpgradeBtn.node;
      paint(btnNode, canUpgrade && affordable ? Palette.wood : Palette.disabled, 12);
      const lab = btnNode.getChildByName('Label')?.getComponent(Label);
      if (lab) {
        const upgText = canUpgrade
          ? `升级到 ${nextSlots} 格（${cost} 金币）`
          : '已是最高档';
        setLabel(lab, upgText);
        lab.color = canUpgrade && affordable ? Palette.paper : Palette.disabledText;
      }
    }

    const papers = ConfigManager.decor.wallpapers;
    papers.forEach(paper => {
      const item = this._decorBtns.get(paper.id);
      if (!item) return;
      const equipped = model.wallpaperId === paper.id;
      const owned = model.hasWallpaper(paper.id);
      const affordable = model.coins >= paper.cost;
      // 三行文案：图标 · 名称 · 状态
      const moodIcon = this.moodIcon(paper.id);
      const pName = I18n.tDecor(paper.id);
      const stateLine = equipped
        ? '✓ 使用中'
        : owned
          ? '✓ 已拥有'
          : affordable
            ? `${paper.cost} 🪙`
            : `-${paper.cost - model.coins} 🪙`;
      setLabel(item.label, `${moodIcon}\n${pName}\n${stateLine}`, Type.sub);
      this.applyItemTone(item, equipped, owned, affordable);
    });

    this.applyWallpaper();
  }

  /** 根据 id 返回对应心情 emoji，让卡片更有温度 */
  private moodIcon(id: string): string {
    const map: Record<string, string> = {
      paper_warm: '☀️',
      paper_snow: '❄️',
      paper_night: '🌙',
      paper_mint: '🌿',
      paper_dusk: '🌅',
    };
    return map[id] ?? '🪟';
  }

  /** 提示 2.5 秒后自动恢复默认文案 */
  private showTip(msg: string): void {
    if (!this._tip) return;
    setLabel(this._tip, msg);
    this.unschedule(this.resetTip);
    this.scheduleOnce(this.resetTip, TIP_SECONDS);
  }

  private resetTip(): void {
    if (this._tip) setLabel(this._tip, TIP_DEFAULT);
  }

  public onUpgradeShelf(): void {
    const res = GameModel.instance.upgradeShelf();
    this.showTip(res.ok ? '✨ 货架已加宽，迎接更多香氛' : (res.reason || '无法升级'));
    this.refreshView();
  }

  public onPaper(id: string): void {
    const res = GameModel.instance.setWallpaper(id);
    this.showTip(res.ok ? '🌸 窗景已换上，感受新氛围' : (res.reason || '无法更换'));
    this.refreshView();
  }
}
