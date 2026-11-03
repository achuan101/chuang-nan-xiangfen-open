import { _decorator, Component, director, Node, Label, Color, Button } from 'cc';
import { InterstitialAd } from '../ads/InterstitialAd';
import { Pot } from './Pot';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { I18n } from '../core/I18n';
import { ActionBar } from '../ui/ActionBar';
import { Tutorial } from '../ui/Tutorial';
import { BottomNav } from '../ui/BottomNav';
import {
  applyAmbientBg,
  applySprite,
  bindClick,
  ensureCanvas,
  hexColor,
  labelHeightFor,
  makeButton,
  makeLabel,
  makeNode,
  makeSceneTitle,
  paint,
  paintStroke,
  Palette,
  setLabel,
  Type,
} from '../ui/UiKit';
import { AudioKit } from '../audio/AudioKit';
import { attachAmbientLight } from '../ui/AmbientLight';

const { ccclass, property } = _decorator;
const PANEL_STROKE = new Color(225, 210, 195, 255);
const TEAL_BTN = new Color(72, 166, 148, 255);
const TEAL_STROKE = new Color(140, 227, 211, 200);

@ccclass('FarmView')
export class FarmView extends Component {
  @property([Pot])
  public potList: Pot[] = [];

  private _storageEntryLabel: Label | null = null;
  private _storageBadgeLabel: Label | null = null;
  private _storageDrawer: Node | null = null;
  private _storageOpen: boolean = false;
  private _goBenchBtn: Button | null = null;
  private _goBenchLabel: Label | null = null;
  private _windowChipLabel: Label | null = null;
  private _timer: number = 0;

  start() {
    GameModel.instance.initialize();
    AudioKit.init();
    ensureCanvas(this.node);
    this.buildUi();
    if (GameModel.instance.tutorialStep === 'go_window') {
      GameModel.instance.advanceTutorial('harvest');
    }
    this.refreshPotStatus();

    GameModel.instance.on('inventory_changed', this._onInventoryChanged);
    GameModel.instance.on('pot_changed', this._onPotChanged);
  }

  onDestroy() {
    GameModel.instance.off('inventory_changed', this._onInventoryChanged);
    GameModel.instance.off('pot_changed', this._onPotChanged);
  }

  update(dt: number) {
    this._timer += dt;
    if (this._timer >= 1.0) {
      this._timer = 0;
      this.refreshPotStatus();
    }
  }

  private _onInventoryChanged = () => {
    this.refreshStorage();
    this.refreshPotStatus();
  };

  private _onPotChanged = () => {
    this.refreshPotStatus();
  };

  public refreshPotStatus(): void {
    if (!this.potList || this.potList.length === 0) return;
    const readyCount = this.potList.filter(p => p.isReady()).length;

    if (this._windowChipLabel) {
      if (readyCount > 0) {
        setLabel(this._windowChipLabel, I18n.t('farm_chip_ready', { n: readyCount }), 13);
        this._windowChipLabel.color = new Color(21, 128, 61, 255);
        this._windowChipLabel.isBold = true;
      } else {
        setLabel(this._windowChipLabel, I18n.t('farm_chip_growing'), 13);
        this._windowChipLabel.color = Palette.ink;
        this._windowChipLabel.isBold = false;
      }
    }

    if (this._goBenchLabel) {
      if (readyCount > 0) {
        setLabel(this._goBenchLabel, I18n.t('farm_go_bench'), 16);
      } else {
        setLabel(this._goBenchLabel, I18n.t('farm_go_bench_done'), 16);
      }
    }
  }

  public buildUi(): void {
    applyAmbientBg(this.node);
    attachAmbientLight(this.node);
    makeSceneTitle(this.node, 'WindowTitle', I18n.t('scene_window'));

    // 顶部左侧场景芯片
    const chip = makeButton(this.node, 'WindowChip', I18n.t('farm_chip_growing'), 110, 36, -260, 560, Palette.paper);
    paintStroke(chip.node, Palette.paper, PANEL_STROKE, 18, 1);
    chip.label.color = Palette.ink;
    setLabel(chip.label, I18n.t('farm_chip_growing'), 13);
    this._windowChipLabel = chip.label;

    ActionBar.attach(this.node);

    // 储香阁抽屉入口按钮 (Y = 285)
    const storageText = I18n.t('farm_storage_pill', { n: 0, arrow: '▾' });
    const storageBtn = makeButton(this.node, 'StoragePill', storageText, 660, 42, 0, 285, Palette.panel);
    paintStroke(storageBtn.node, Palette.panel, PANEL_STROKE, 19, 1.2);
    storageBtn.label.color = new Color(92, 64, 40, 255);
    setLabel(storageBtn.label, storageText, 16);
    bindClick(storageBtn.node, () => this.onStorageEntryClick(), this);
    this._storageEntryLabel = storageBtn.label;

    // 三个主花盆 (居中 Y = -30，高 430，范围 -245 ~ 185)
    this.potList = [0, 1, 2].map((idx) => {
      const x = idx === 0 ? -225 : (idx === 1 ? 0 : 225);
      return Pot.create(this.node, idx, x, -30);
    });

    if (!GameModel.instance.tutorialCompleted) {
      this.potList.slice(1).forEach(p => {
        if (p.harvestBtn) p.harvestBtn.interactable = false;
        if (p.speedupBtn) p.speedupBtn.node.active = false;
        if (p.switchBtn) p.switchBtn.node.active = false;
      });
    }

    // 底部蒂芙尼青快捷前往工台按钮 (Y = -345)
    const benchBtn = makeButton(this.node, 'BtnGoBench', I18n.t('farm_go_bench_done'), 640, 50, 0, -345, TEAL_BTN);
    paintStroke(benchBtn.node, TEAL_BTN, TEAL_STROKE, 18, 1.5);
    benchBtn.label.color = Palette.paper;
    benchBtn.label.isBold = true;
    setLabel(benchBtn.label, I18n.t('farm_go_bench_done'), 16);
    bindClick(benchBtn.node, () => this.onOpenBenchClick(), this);
    this._goBenchBtn = benchBtn.button;
    this._goBenchLabel = benchBtn.label;

    BottomNav.attach(this.node, 'window');

    this.buildStorageDrawer();
    Tutorial.attach(this.node, 'window');
    this.refreshStorage();
    this.refreshPotStatus();
  }

  public onStorageEntryClick(): void {
    this.showStorageDrawer(!this._storageOpen);
    AudioKit.play('ui_tap');
  }

  private buildStorageDrawer(): void {
    this._storageDrawer = makeNode(this.node, 'StorageDrawer', 720, 1280, 0, 0);
    this._storageDrawer.setSiblingIndex(99);
    paint(this._storageDrawer, new Color(0, 0, 0, 180), 0);
    bindClick(this._storageDrawer, () => this.showStorageDrawer(false), this);

    const card = makeNode(this._storageDrawer, 'StorageCard', 720, 680, 0, -300);
    paint(card, Palette.panel, 28);

    makeLabel(card, 'StorageTitle', '🧺 窗南储香阁 · 原料库存', 400, 32, -140, 300, Type.card, Palette.ink);
    this._storageBadgeLabel = makeLabel(card, 'StorageBadge', '', 200, 26, 118, 300, Type.badge, Palette.woodDark);
    const close = makeButton(card, 'BtnStorageClose', '完成', 100, 40, 290, 300, Palette.gold);
    close.label.fontSize = Type.sub;
    close.label.color = Palette.ink;
    bindClick(close.node, () => this.showStorageDrawer(false), this);

    makeLabel(card, 'StorageHint', '✨ 窗台采摘原料自动入阁 · 工台调香随时取用', 640, 26, 0, 250, Type.badge, Palette.inkSoft);

    const notes = ConfigManager.getAllNotes();
    const cols = 4;
    const cellW = 160;
    const cellH = 150;
    const gap = 12;
    const totalW = cols * cellW + (cols - 1) * gap;
    const startX = -totalW / 2 + cellW / 2;

    notes.forEach((note, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = startX + col * (cellW + gap);
      const y = 150 - row * (cellH + gap);

      const cell = makeNode(card, `NoteCard_${note.id}`, cellW, cellH, x, y);
      paintStroke(cell, Palette.paper, Palette.slotEmptyStroke, 16, 1.5);

      const icon = makeNode(cell, 'Icon', 56, 56, 0, 38);
      applySprite(icon, `notes/${note.id}`);

      makeLabel(cell, 'Name', note.name, 150, 24, 0, -8, Type.sub, Palette.ink);
      const tagStr = note.tags ? note.tags.join('·') : '';
      makeLabel(cell, 'Tag', tagStr, 150, 21, 0, -33, Type.badge, Palette.inkSoft);
      makeLabel(cell, 'Count', '0', 150, 20, 0, -58, Type.badge, Palette.woodDark);
    });

    const toBench = makeButton(card, 'BtnStorageToBench', '🍶 前往工台调和香氛', 640, 54, 0, -290, Palette.mint);
    toBench.label.fontSize = Type.body;
    bindClick(toBench.node, () => {
      this.showStorageDrawer(false);
      this.onOpenBenchClick();
    }, this);

    this._storageDrawer.active = false;
  }

  private showStorageDrawer(open: boolean): void {
    this._storageOpen = open;
    if (this._storageDrawer) {
      this._storageDrawer.setSiblingIndex(99);
      this._storageDrawer.active = open;
    }
    this.refreshStorage();
  }

  private refreshStorage(): void {
    const model = GameModel.instance;
    const notes = ConfigManager.getAllNotes();

    if (this._storageEntryLabel) {
      const total = notes.reduce((sum, n) => sum + model.getNoteCount(n.id), 0);
      const arrow = this._storageOpen ? '▴' : '▾';
      setLabel(
        this._storageEntryLabel,
        I18n.t('farm_storage_pill', { n: total, arrow }),
        14,
      );
      if (this._storageBadgeLabel) {
        setLabel(this._storageBadgeLabel, I18n.t('farm_storage_badge', { n: total }), 13);
      }
    }

    if (!this._storageDrawer) return;
    const card = this._storageDrawer.getChildByName('StorageCard');
    if (!card) return;
    notes.forEach((note) => {
      const cell = card.getChildByName(`NoteCard_${note.id}`);
      if (!cell) return;
      const count = model.getNoteCount(note.id);
      const countLab = cell.getChildByName('Count')?.getComponent(Label);
      if (countLab) {
        setLabel(countLab, count > 0 ? `×${count}` : I18n.t('farm_no_stock'), 13);
        countLab.color = count > 0 ? Palette.woodDark : Palette.disabledText;
      }
      const nameLab = cell.getChildByName('Name')?.getComponent(Label);
      if (nameLab) setLabel(nameLab, I18n.tNote(note.id), Type.sub);
      paint(cell, count > 0 ? Palette.paper : Palette.invEmpty, 10);
    });
  }

  public onOpenBenchClick(): void {
    if (GameModel.instance.tutorialStep === 'go_bench') {
      GameModel.instance.advanceTutorial('blend');
    }
    AudioKit.play('ui_tap');
    director.loadScene('Bench');
  }

  public onBackClick(): void {
    InterstitialAd.show();
    director.loadScene('Shop');
  }
}
