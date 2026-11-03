import { _decorator, Component, Node, Label, Button, Graphics, UIOpacity, Tween, tween, director, Color } from 'cc';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { I18n } from '../core/I18n';
import { BlendSystem } from './BlendSystem';
import { ActionBar } from '../ui/ActionBar';
import { Tutorial } from '../ui/Tutorial';
import { InterstitialAd } from '../ads/InterstitialAd';
import { adEntryVisible, RewardedAd } from '../ads/RewardedAd';
import { AudioKit } from '../audio/AudioKit';
import { BottomNav } from '../ui/BottomNav';
import {
  applyAmbientBg,
  applySprite,
  bindClick,
  ensureCanvas,
  ensureTransform,
  formatMmSs,
  hexColor,
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
import { floatUp, popIn, shakeX, squash } from '../ui/Motion';
import { attachAmbientLight } from '../ui/AmbientLight';

const { ccclass, property } = _decorator;

const CURE_TRACK = new Color(228, 218, 204, 255);
const CURE_BAR_W = 560;
const CURE_BAR_H = 16;
const PANEL_STROKE = new Color(225, 210, 195, 255);

/** 展开态摆 6 款配方（2 列 × 3 行） */
const GUIDE_SLOTS = 6;

// 纵向尺寸常量
const CABINET_H = 346;
const CRUCIBLE_H = 246;
const CURING_PANEL_H = 240;

// 香调柜网格：4 列 × 2 行
const CAB_CELL_W = 155;
const CAB_CELL_H = 140;
const CAB_CELL_GAP = 10;
const CAB_COLS = 4;

function cabCellX(col: number): number {
  const totalW = CAB_COLS * CAB_CELL_W + (CAB_COLS - 1) * CAB_CELL_GAP;
  return -totalW / 2 + CAB_CELL_W / 2 + col * (CAB_CELL_W + CAB_CELL_GAP);
}

@ccclass('BlendView')
export class BlendView extends Component {
  @property(Label)
  public slotALabel: Label | null = null;

  @property(Label)
  public slotBLabel: Label | null = null;

  @property(Label)
  public inventoryNotesLabel: Label | null = null;

  @property(Button)
  public blendBtn: Button | null = null;

  @property(Label)
  public messageLabel: Label | null = null;

  @property(Node)
  public curingPanel: Node | null = null;

  @property(Label)
  public curingStatusLabel: Label | null = null;

  @property(Button)
  public speedupBtn: Button | null = null;

  @property(Button)
  public claimBtn: Button | null = null;

  private _selectedA: string | null = null;
  private _selectedB: string | null = null;
  private _timer: number = 0;
  private _cabinet: Node | null = null;
  private _crucible: Node | null = null;
  private _mist: Node | null = null;
  private _cureBar: Node | null = null;
  private _cureReadyPlayedFor: string | null = null;
  private _adSpeedupBtn: Button | null = null;
  private _picking: 'A' | 'B' | null = null;
  private _clearSlotsBtn: Button | null = null;
  private _guideContainer: Node | null = null;
  private _curingContainer: Node | null = null;
  private _recipeGuidePanel: Node | null = null;
  private _guideToggleNode: Node | null = null;
  private _guideToggleLabel: Label | null = null;
  private _guideClosedTip: Node | null = null;
  private _guideOpen: boolean = true;
  private _guideSig: string = '';
  private _resultModalNode: Node | null = null;
  private _resultModalCard: Node | null = null;
  private _curingBottleArt: Node | null = null;
  private _curingTagsLabel: Label | null = null;
  private _curingTimeLabel: Label | null = null;
  private _curingSubtitleLabel: Label | null = null;

  private _onCuringStarted = () => this.refreshCuringPanel();
  private _onCuringCompleted = () => this.refreshCuringPanel();
  private _onClaimed = () => this.refreshCuringPanel();
  private _onFailed = () => {
    this.refreshNoteCards();
    this.refreshSlots();
  };
  private _onInventory = () => {
    this.refreshSlots();
    this.refreshNoteCards();
  };

  start() {
    GameModel.instance.initialize();
    AudioKit.init();
    ensureCanvas(this.node);
    this.buildUi();

    if (!GameModel.instance.tutorialCompleted && GameModel.instance.getNoteCount('A') > 0 && GameModel.instance.getNoteCount('E') > 0) {
      this._selectedA = 'A';
      this._selectedB = 'E';
    }
    if (GameModel.instance.tutorialStep === 'go_bench') {
      GameModel.instance.advanceTutorial('blend');
    }

    this.refreshSlots();
    this.refreshNoteCards();
    this.refreshCuringPanel();

    const model = GameModel.instance;
    model.on('curing_started', this._onCuringStarted);
    model.on('curing_completed', this._onCuringCompleted);
    model.on('bottle_claimed', this._onClaimed);
    model.on('blend_failed', this._onFailed);
    model.on('inventory_changed', this._onInventory);
  }

  onDestroy() {
    const model = GameModel.instance;
    model.off('curing_started', this._onCuringStarted);
    model.off('curing_completed', this._onCuringCompleted);
    model.off('bottle_claimed', this._onClaimed);
    model.off('blend_failed', this._onFailed);
    model.off('inventory_changed', this._onInventory);
  }

  update(dt: number) {
    this._timer += dt;
    if (this._timer >= 1.0) {
      this._timer = 0;
      this.refreshCuringPanel();
      if (GameModel.instance.activeCuring && BlendSystem.isCuringComplete()) {
        GameModel.instance.advanceTutorial('claim');
      }
    }
  }

  public buildUi(): void {
    applyAmbientBg(this.node);
    attachAmbientLight(this.node);

    makeSceneTitle(this.node, 'BenchTitle', I18n.t('scene_bench'));
    ActionBar.attach(this.node);

    this.buildCabinet();
    this.buildCrucible();
    this.buildBottomSection();
    this.buildResultModal();

    this._mist = makeNode(this.node, 'MistFX', 720, 1280, 0, 0);
    this._mist.active = false;

    BottomNav.attach(this.node, 'bench');
    Tutorial.attach(this.node, 'bench');
  }

  /** 调香原料案：4×2 共 8 味香调彩色卡片 */
  private buildCabinet(): void {
    // 居中 Y = 167，高 346（占位 Y: -6 ~ 340）
    const block = makeNode(this.node, 'BenchCabinet', 680, CABINET_H, 0, 167);
    paintStroke(block, Palette.panel, PANEL_STROKE, 20, 1.5);
    this._cabinet = block;

    makeLabel(block, 'CabinetTitle', I18n.t('bench_cabinet_title'), 260, 26, -180, 146, 16, new Color(74, 53, 37, 255));
    makeLabel(block, 'CabinetSub', I18n.t('bench_cabinet_sub'), 260, 24, 180, 146, Type.badge, Palette.inkSoft);
  }

  /** 合香池：双槽位 + 连接符 + 调和按钮 + 提示 */
  private buildCrucible(): void {
    // 居中 Y = -143，高 246（占位 Y: -266 ~ -20）
    const block = makeNode(this.node, 'BenchCrucible', 680, CRUCIBLE_H, 0, -143);
    paintStroke(block, Palette.panel, PANEL_STROKE, 20, 1.5);
    this._crucible = block;

    makeLabel(block, 'CrucibleTitle', I18n.t('bench_crucible_title'), 220, 26, -210, 96, Type.sub, new Color(74, 53, 37, 255));

    const clear = makeButton(block, 'BtnClearSlots', I18n.t('clear_slots'), 148, 32, 236, 96, hexColor('#f7eedf'));
    setLabel(clear.label, I18n.t('clear_slots'), Type.badge);
    clear.label.color = Palette.woodDark;
    this._clearSlotsBtn = clear.button;
    paintStroke(clear.node, hexColor('#f7eedf'), Palette.slotEmptyStroke, 12, 1.5);
    bindClick(clear.node, () => this.onClearSlotsClick(), this);
    clear.node.active = false;

    // Slot A (主香调)
    const slotA = makeButton(block, 'SlotA', I18n.t('bench_slot_a'), 280, 72, -175, 36, Palette.paper);
    paintStroke(slotA.node, Palette.slotEmptyFill, Palette.slotEmptyStroke, 16, 1.5);
    slotA.label.color = Palette.inkSoft;
    setLabel(slotA.label, I18n.t('bench_slot_a'), 16);
    this.slotALabel = slotA.label;
    bindClick(slotA.node, () => this.onSlotTap('A'), this);

    makeLabel(block, 'SlotConnector', '＋', 40, 36, 0, 36, 24, Palette.woodDark);

    // Slot B (辅香调)
    const slotB = makeButton(block, 'SlotB', I18n.t('bench_slot_b'), 280, 72, 175, 36, Palette.paper);
    paintStroke(slotB.node, Palette.slotEmptyFill, Palette.slotEmptyStroke, 16, 1.5);
    slotB.label.color = Palette.inkSoft;
    setLabel(slotB.label, I18n.t('bench_slot_b'), 16);
    this.slotBLabel = slotB.label;
    bindClick(slotB.node, () => this.onSlotTap('B'), this);

    // 调和按钮
    const blend = makeButton(block, 'BtnBlend', I18n.t('bench_choose_two_notes'), 640, 48, 0, -32, Palette.disabled);
    this.blendBtn = blend.button;
    setLabel(blend.label, I18n.t('bench_choose_two_notes'), 16);
    blend.label.color = Palette.disabledText;
    bindClick(blend.node, () => this.onBlendClick(), this);

    // 提示说明：给够盒高 44，允许折行，避免长字串缩小
    this.messageLabel = makeLabel(
      block,
      'Message',
      I18n.t('bench_pair_tip'),
      640,
      44,
      0,
      -84,
      Type.badge,
      Palette.inkSoft,
    );
    this.messageLabel.enableWrapText = true;
  }

  /**
   * 底部区域（CuringPanel）：
   * 居中 Y = -396，高 240（占位 Y: -516 ~ -276）。
   * 定香中展示凝香进度，闲置时展示掌柜香方谱，位置完全固定，杜绝画布直接子节点碰撞。
   */
  private buildBottomSection(): void {
    const card = makeNode(this.node, 'CuringPanel', 680, CURING_PANEL_H, 0, -396);
    paintStroke(card, Palette.panel, PANEL_STROKE, 20, 1.5);
    this.curingPanel = card;

    // ---------------- 定香容器 (CuringContainer) ----------------
    this._curingContainer = makeNode(card, 'CuringContainer', 680, CURING_PANEL_H, 0, 0);

    makeLabel(this._curingContainer, 'CuringTitle', '🏺 案前温鼎', 220, 26, -200, 94, Type.sub, new Color(74, 53, 37, 255));
    this._curingSubtitleLabel = makeLabel(this._curingContainer, 'CuringSubtitle', '温鼎凝炼 · 待香气凝实', 240, 24, 180, 94, Type.badge, Palette.inkSoft);

    this._curingBottleArt = makeNode(this._curingContainer, 'CuringBottleArt', 64, 64, -240, 26);
    this.curingStatusLabel = makeLabel(this._curingContainer, 'CuringStatus', '', 440, 26, 50, 40, 16, Palette.ink);
    this._curingTagsLabel = makeLabel(this._curingContainer, 'CuringTags', '', 440, 22, 50, 16, Type.badge, Palette.inkSoft);

    // CureBar 直接挂在 curingPanel 下（满足 layoutCheck 测试套件的 getChildByName 探测）
    this._cureBar = makeNode(card, 'CureBar', CURE_BAR_W, CURE_BAR_H, 0, -16);
    this._curingTimeLabel = makeLabel(this._curingContainer, 'CuringTime', '', 560, 22, 0, -38, Type.badge, Palette.woodDark);

    const speed = makeButton(this._curingContainer, 'BtnSpeedup', I18n.t('action_speedup_card'), 310, 44, -162, -82, Palette.mint);
    setLabel(speed.label, I18n.t('action_speedup_card'), Type.badge);
    speed.label.color = Palette.paper;
    this.speedupBtn = speed.button;
    bindClick(speed.node, () => this.onSpeedupClick(), this);

    const claim = makeButton(this._curingContainer, 'BtnClaim', '✨ ' + I18n.t('action_claim'), 640, 46, 0, -82, new Color(21, 128, 61, 255));
    setLabel(claim.label, '✨ ' + I18n.t('action_claim'), 16);
    claim.label.color = Palette.paper;
    this.claimBtn = claim.button;
    bindClick(claim.node, () => this.onClaimClick(), this);

    if (adEntryVisible()) {
      const adSpeed = makeButton(this._curingContainer, 'BtnAdSpeedup', I18n.t('action_speedup'), 310, 44, 162, -82, Palette.wood);
      setLabel(adSpeed.label, I18n.t('action_speedup'), Type.badge);
      adSpeed.label.color = Palette.paper;
      this._adSpeedupBtn = adSpeed.button;
      bindClick(adSpeed.node, () => this.onAdSpeedupClick(), this);
    }

    // ---------------- 香方谱容器 (GuideContainer) ----------------
    this._guideContainer = makeNode(card, 'GuideContainer', 680, CURING_PANEL_H, 0, 0);

    const toggle = makeButton(this._guideContainer, 'BtnGuideToggle', '📜 掌柜香方谱', 650, 38, 0, 92, hexColor('#fff9e6'));
    paintStroke(toggle.node, hexColor('#fff9e6'), Palette.gold, 14, 1.5);
    setLabel(toggle.label, '📜 掌柜香方谱', Type.badge);
    toggle.label.color = Palette.ink;
    this._guideToggleLabel = toggle.label;
    this._guideToggleNode = toggle.node;
    bindClick(toggle.node, () => this.onGuideToggleClick(), this);

    this._recipeGuidePanel = makeNode(this._guideContainer, 'RecipeGuidePanel', 650, 160, 0, -22);

    const tip = makeLabel(this._guideContainer, 'GuideTip', '📜 香方谱已收起 · 点击上方展开查看 12 款雅致配方并一键置入', 620, 32, 0, 0, Type.badge, Palette.inkSoft);
    this._guideClosedTip = tip.node;
    this._guideClosedTip.active = false;
  }

  public onGuideToggleClick(): void {
    this._guideOpen = !this._guideOpen;
    if (this._recipeGuidePanel) this._recipeGuidePanel.active = this._guideOpen;
    if (this._guideClosedTip) this._guideClosedTip.active = !this._guideOpen;
    this.refreshRecipeGuide();
    AudioKit.play('ui_tap');
  }

  /** 刷新调香原料案 8 张彩色香调卡片 */
  private refreshNoteCards(): void {
    if (!this._cabinet) return;
    const model = GameModel.instance;
    const notes = ConfigManager.getAllNotes();

    notes.forEach((note, idx) => {
      const col = idx % CAB_COLS;
      const row = Math.floor(idx / CAB_COLS);
      const cellName = `Note_${note.id}`;
      let cell = this._cabinet!.getChildByName(cellName);
      const qty = model.getNoteCount(note.id);
      const unlocked = model.isNoteUnlocked(note.id);
      const tutorialLock = !model.tutorialCompleted && note.id !== 'A' && note.id !== 'E';
      const picked = this._selectedA === note.id || this._selectedB === note.id;
      const usable = unlocked && !tutorialLock && qty > 0;

      const noteName = I18n.tNote(note.id);
      if (!cell) {
        const cellY = 51 - row * (CAB_CELL_H + CAB_CELL_GAP);
        const cellObj = makeButton(this._cabinet!, cellName, '', CAB_CELL_W, CAB_CELL_H, cabCellX(col), cellY, Palette.paper);
        cell = cellObj.node;

        const icon = makeNode(cell, 'Icon', 60, 60, 0, 26);
        applySprite(icon, `notes/${note.id}`);

        const badge = makeNode(cell, 'Badge', 42, 24, 54, 48);
        paint(badge, Palette.paper, 12);
        makeLabel(badge, 'Text', `×${qty}`, 42, 22, 0, 0, Type.badge, Palette.woodDark);

        const nameLab = makeLabel(cell, 'Name', noteName, 140, 26, 0, -42, 16, Palette.paper);
        nameLab.isBold = true;

        bindClick(cell, () => this.onPickNote(note.id), this);
      }

      // 卡片底色与边框：有库存用调配专属柔和色，选中有金边
      const fillColor = usable ? hexColor(note.colorHex) : Palette.invEmpty;
      const strokeColor = picked ? Palette.gold : Palette.slotEmptyStroke;
      paintStroke(cell, fillColor, strokeColor, 18, picked ? 3 : 1.5);

      // 角标
      const badge = cell.getChildByName('Badge');
      if (badge) {
        const badgeFill = picked ? Palette.gold : usable ? hexColor('#ffffffd8') : hexColor('#ded7cc');
        paint(badge, badgeFill, 12);
        const lab = badge.getChildByName('Text')?.getComponent(Label);
        if (lab) {
          lab.string = !unlocked ? '🔒' : tutorialLock ? '🔒' : `×${qty}`;
          lab.color = picked ? new Color(120, 53, 15, 255) : usable ? new Color(146, 64, 14, 255) : Palette.disabledText;
        }
      }

      // 名字文字颜色与多语言
      const nameLab = cell.getChildByName('Name')?.getComponent(Label);
      if (nameLab) {
        setLabel(nameLab, noteName, 16);
        nameLab.color = usable ? Color.WHITE : Palette.disabledText;
      }

      const btn = cell.getComponent(Button);
      if (btn) btn.interactable = usable;
    });
  }

  public onSlotTap(slot: 'A' | 'B'): void {
    if (slot === 'A' && this._selectedA) {
      this._selectedA = null;
      this._picking = null;
    } else if (slot === 'B' && this._selectedB) {
      this._selectedB = null;
      this._picking = null;
    } else {
      this._picking = slot;
      if (this.messageLabel) {
        setLabel(this.messageLabel, `点上方香调案，放入${slot === 'A' ? '左' : '右'}槽`, Type.badge);
      }
    }
    this.refreshSlots();
    this.refreshNoteCards();
  }

  public onPickNote(noteId: string): void {
    if (this._picking === 'A') {
      this._selectedA = noteId;
      this._picking = this._selectedB ? null : 'B';
    } else if (this._picking === 'B') {
      this._selectedB = noteId;
      this._picking = null;
    } else if (!this._selectedA) {
      this._selectedA = noteId;
      this._picking = this._selectedB ? null : 'B';
    } else if (!this._selectedB) {
      this._selectedB = noteId;
      this._picking = null;
    } else {
      this._selectedA = noteId;
      this._picking = null;
    }
    this.refreshSlots();
    this.refreshNoteCards();
  }

  public selectNoteA(noteId: string): void {
    this._selectedA = noteId;
    this.refreshSlots();
    this.refreshNoteCards();
  }

  public selectNoteB(noteId: string): void {
    this._selectedB = noteId;
    this.refreshSlots();
    this.refreshNoteCards();
  }

  public onClearSlotsClick(): void {
    this._selectedA = null;
    this._selectedB = null;
    this._picking = null;
    this.refreshSlots();
    this.refreshNoteCards();
    AudioKit.play('ui_tap');
  }

  public loadRecipe(noteA: string, noteB: string): void {
    this._selectedA = noteA;
    this._selectedB = noteB;
    this._picking = null;
    this.refreshSlots();
    this.refreshNoteCards();
    AudioKit.play('ui_tap');
  }

  public refreshSlots(): void {
    const noteA = this._selectedA ? ConfigManager.getNote(this._selectedA) : null;
    const noteB = this._selectedB ? ConfigManager.getNote(this._selectedB) : null;

    const paintSlot = (slotNode: Node | null, label: Label | null, note: ReturnType<typeof ConfigManager.getNote>, slotKey: string) => {
      if (!slotNode || !label) return;

      const slotEmpty = slotKey === 'A' ? I18n.t('bench_slot_a') : I18n.t('bench_slot_b');
      const noteName = note ? I18n.tNote(note.id) : slotEmpty;
      setLabel(label, noteName, note ? 16 : 15);
      label.node.setPosition(note ? 15 : 0, note ? 12 : 0);
      label.color = note ? Palette.ink : Palette.inkSoft;
      label.isBold = !!note;

      let icon = slotNode.getChildByName('Icon');
      if (!icon) icon = makeNode(slotNode, 'Icon', 48, 48, -95, 0);
      icon.active = !!note;
      if (note) applySprite(icon, `notes/${note.id}`);

      let tag = slotNode.getChildByName('SlotTag');
      if (note) {
        if (!tag) tag = makeNode(slotNode, 'SlotTag', 150, 22, 15, -14);
        tag.active = true;
        let lab = tag.getComponent(Label);
        if (!lab) lab = tag.addComponent(Label);
        lab.string = note.tags ? note.tags.map(t => I18n.tTag(t)).join(' · ') : '';
        lab.fontSize = Type.badge;
        lab.lineHeight = 20;
        lab.color = Palette.inkSoft;
        lab.overflow = Label.Overflow.SHRINK;
      } else if (tag) {
        tag.active = false;
      }

      if (note) paintStroke(slotNode, Palette.paper, Palette.gold, 16, 2);
      else paintStroke(slotNode, Palette.slotEmptyFill, Palette.slotEmptyStroke, 16, 1.5);
    };

    if (this.slotALabel) paintSlot(this.slotALabel.node.parent, this.slotALabel, noteA, 'A');
    if (this.slotBLabel) paintSlot(this.slotBLabel.node.parent, this.slotBLabel, noteB, 'B');

    if (this._clearSlotsBtn) {
      this._clearSlotsBtn.node.active = !!(this._selectedA || this._selectedB);
    }

    // 研制按钮 BtnBlend 与底部预测提示
    if (this.blendBtn) {
      const isCuring = !!GameModel.instance.activeCuring;
      const check = BlendSystem.canBlend(this._selectedA, this._selectedB);
      const plan = GameModel.instance.autoFillBlendSlots(this._selectedA, this._selectedB);
      const blendNode = this.blendBtn.node;
      const blendLab = blendNode.getChildByName('Label')?.getComponent(Label);

      if (isCuring) {
        this.blendBtn.interactable = false;
        paint(blendNode, Palette.disabled, 16);
        if (blendLab) {
          setLabel(blendLab, I18n.t('bench_curing_in_crucible'), 15);
          blendLab.color = Palette.disabledText;
        }
        if (this.messageLabel) {
          setLabel(this.messageLabel, I18n.t('bench_curing_in_crucible'), Type.badge);
        }
      } else if (check.ok) {
        this.blendBtn.interactable = true;
        paint(blendNode, Palette.gold, 16);
        const match = ConfigManager.matchRecipe([this._selectedA!, this._selectedB!]);
        const bottle = match.result === 'success' ? ConfigManager.getBottle(match.bottleId) : null;
        const bName = bottle ? I18n.tBottle(bottle.id).name : (match.result === 'success' ? match.bottleId : I18n.tBottle('practice_bottle').name);
        if (blendLab) {
          const blendStr = I18n.t('bench_start_craft', { name: bName });
          setLabel(blendLab, blendStr, 16);
          blendLab.color = Palette.ink;
          blendLab.isBold = true;
        }
        if (this.messageLabel) {
          setLabel(this.messageLabel, BlendSystem.describePair(this._selectedA!, this._selectedB!).tip, Type.badge);
        }
      } else if (plan.kind === 'filled') {
        const aName = I18n.tNote(plan.noteA);
        const bName = I18n.tNote(plan.noteB);
        this.blendBtn.interactable = true;
        paint(blendNode, Palette.gold, 16);
        if (blendLab) {
          setLabel(blendLab, I18n.t('bench_fill_btn', { a: aName, b: bName }), 16);
          blendLab.color = Palette.ink;
          blendLab.isBold = true;
        }
        if (this.messageLabel) {
          setLabel(this.messageLabel, I18n.t('bench_fill_tip'), Type.badge);
        }
      } else {
        this.blendBtn.interactable = false;
        paint(blendNode, Palette.disabled, 16);
        if (blendLab) {
          const fallbackReason = plan.kind === 'no_stock' ? I18n.t('bench_pick_note_first') : (check.reason || I18n.t('bench_choose_two_notes'));
          setLabel(blendLab, fallbackReason, 15);
          blendLab.color = Palette.disabledText;
          blendLab.isBold = false;
        }
        if (this.messageLabel) {
          setLabel(this.messageLabel, check.reason || I18n.t('bench_tap_notes_tip'), Type.badge);
        }
      }
    }

    this.refreshRecipeGuide();
  }

  public refreshInventoryNotes(): void {
    if (!this.inventoryNotesLabel) return;
    const notes = GameModel.instance.notesInventory;
    const items = Object.keys(notes)
      .filter(k => notes[k] > 0)
      .map(k => {
        const conf = ConfigManager.getNote(k);
        return `${conf ? conf.name : k} ${notes[k]}`;
      });
    setLabel(this.inventoryNotesLabel, items.length > 0 ? `背包：${items.join(' · ')}` : '暂无香调原料', 15);
  }

  /** 获取排序列出的香方 */
  private getGuideRecipes(): { id: string; bottleId: string; a: string; b: string }[] {
    const rank = new Map<string, number>();
    GameModel.instance.getCraftableRecipes().forEach((r, i) => rank.set(r.id, i));
    const rankOf = (id: string) => (rank.has(id) ? (rank.get(id) as number) : Number.MAX_SAFE_INTEGER);
    return this.getAllGuidePairs()
      .sort((x, y) => rankOf(x.id) - rankOf(y.id))
      .slice(0, GUIDE_SLOTS);
  }

  private getAllGuidePairs(): { id: string; bottleId: string; a: string; b: string }[] {
    return ConfigManager.getAllRecipes()
      .filter(r => r.result === 'success' && r.inputs.length === 2)
      .map(r => ({ id: r.id, bottleId: r.bottleId, a: r.inputs[0], b: r.inputs[1] }));
  }

  private buildGuideRows(recipes: { id: string; bottleId: string; a: string; b: string }[]): void {
    if (!this._recipeGuidePanel) return;
    this._recipeGuidePanel.removeAllChildren();

    const colW = 318;
    const rowH = 44;
    recipes.forEach((r, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = col === 0 ? -164 : 164;
      const y = 52 - row * (rowH + 8);
      const bName = I18n.tBottle(r.bottleId).name;
      const nameA = I18n.tNote(r.a);
      const nameB = I18n.tNote(r.b);

      const btn = makeButton(this._recipeGuidePanel!, `RecipeBtn_${idx}`, `${nameA}＋${nameB} ➔ ${bName}`, colW, rowH, x, y, Palette.paper);
      setLabel(btn.label, `${nameA}＋${nameB} ➔ ${bName}`, Type.badge);
      btn.label.color = Palette.ink;
      btn.label.node.setPosition(-32, 0);
      ensureTransform(btn.label.node, 220, 24);
      paintStroke(btn.node, hexColor('#fdf8f0'), Palette.slotEmptyStroke, 12, 1.5);

      const badgeNode = makeNode(btn.node, 'Badge', 68, 24, 118, 0);
      paint(badgeNode, Palette.mint, 8);
      makeLabel(badgeNode, 'Text', I18n.t('bench_guide_can_craft'), 68, 22, 0, 0, Type.badge, Palette.paper);

      bindClick(btn.node, () => this.loadRecipe(r.a, r.b), this);
    });
  }

  private refreshRecipeGuide(): void {
    if (!this._recipeGuidePanel) return;
    const model = GameModel.instance;
    const recipes = this.getGuideRecipes();

    const sig = recipes.map(r => r.bottleId).join(',');
    if (sig !== this._guideSig) {
      this._guideSig = sig;
      this.buildGuideRows(recipes);
    }

    recipes.forEach((r, idx) => {
      const btnNode = this._recipeGuidePanel!.getChildByName(`RecipeBtn_${idx}`);
      if (!btnNode) return;
      const needA = r.a === r.b ? 2 : 1;
      const needB = r.a === r.b ? 2 : 1;
      const countA = model.getNoteCount(r.a);
      const countB = model.getNoteCount(r.b);
      const canCraft = countA >= needA && countB >= needB;

      const badgeNode = btnNode.getChildByName('Badge');
      if (badgeNode) {
        paint(badgeNode, canCraft ? Palette.mint : hexColor('#e5dfd5'), 8);
        const lab = badgeNode.getChildByName('Text')?.getComponent(Label);
        if (lab) {
          lab.string = canCraft ? I18n.t('bench_guide_can_craft') : `${countA}/${needA}·${countB}/${needB}`;
          lab.color = canCraft ? Palette.paper : new Color(120, 113, 108, 255);
        }
      }
      paintStroke(btnNode, canCraft ? hexColor('#fff9e6') : hexColor('#fdf8f0'), canCraft ? Palette.gold : Palette.slotEmptyStroke, 12, 1.5);
    });

    if (this._guideToggleLabel) {
      const n = model.getCraftableRecipes().length;
      const arrow = this._guideOpen ? I18n.t('bench_guide_close') : I18n.t('bench_guide_open');
      setLabel(
        this._guideToggleLabel,
        `${I18n.t('bench_guide_title')} ${I18n.t('bench_guide_can_craft')} ${n}/${this.getAllGuidePairs().length} ${arrow}`,
        Type.badge,
      );
    }
  }

  public refreshCuringPanel(): void {
    const curing = GameModel.instance.activeCuring;
    if (!this.curingPanel) return;

    const isCuring = !!curing;
    if (this._curingContainer) this._curingContainer.active = isCuring;
    if (this._cureBar) this._cureBar.active = isCuring;
    if (this._guideContainer) this._guideContainer.active = !isCuring;

    if (!isCuring) {
      this._cureReadyPlayedFor = null;
      this.refreshRecipeGuide();
      return;
    }

    const remain = BlendSystem.getRemainingCuringSeconds();
    const bottleName = I18n.tBottle(curing.bottleId).name;

    if (this._curingBottleArt) {
      applySprite(this._curingBottleArt, `bottles/${curing.bottleId}`);
    }

    if (this.curingStatusLabel) {
      const statusText = remain > 0
        ? `【${bottleName}】定香中`
        : `【${bottleName}】定香完成 · 正在出鼎`;
      setLabel(
        this.curingStatusLabel,
        statusText,
        16,
      );
      this.curingStatusLabel.color = remain > 0 ? new Color(180, 83, 9, 255) : new Color(21, 128, 61, 255);
    }

    if (this._curingTagsLabel) {
      const bottle = ConfigManager.getBottle(curing.bottleId);
      const tagStr = bottle && bottle.tags
        ? bottle.tags.map((t: string) => I18n.tTag(t)).join(' · ')
        : '精雅香氛';
      setLabel(this._curingTagsLabel, tagStr, Type.badge);
    }

    const total = Math.max(1, curing.durationSeconds);
    const ratio = Math.max(0, Math.min(1, 1 - remain / total));
    this.drawCureBar(ratio);

    if (this._curingTimeLabel) {
      setLabel(
        this._curingTimeLabel,
        remain > 0 ? `${formatMmSs(remain)} · 完成后可定香出瓶` : '定香大成，即可收瓶上架',
        Type.badge,
      );
    }

    if (remain <= 0) {
      const key = `${curing.bottleId}:${curing.startTime}`;
      if (this._cureReadyPlayedFor !== key) {
        this._cureReadyPlayedFor = key;
        AudioKit.play('cure_ready');
        if (this.claimBtn) squash(this.claimBtn.node);
      }
      if (this.speedupBtn) this.speedupBtn.node.active = false;
      if (this._adSpeedupBtn) this._adSpeedupBtn.node.active = false;
      if (this.claimBtn) this.claimBtn.node.active = true;
    } else {
      this._cureReadyPlayedFor = null;
      if (this.claimBtn) this.claimBtn.node.active = false;
      if (this.speedupBtn) {
        this.speedupBtn.node.active = true;
        const n = GameModel.instance.speedups;
        const lab = this.speedupBtn.node.getChildByName('Label')?.getComponent(Label);
        if (lab) setLabel(lab, n > 0 ? `⚡ 使用加速卡 (${n})` : '加速卡已用完', Type.badge);
        this.speedupBtn.interactable = n > 0;
      }
      if (this._adSpeedupBtn) {
        this._adSpeedupBtn.node.active = true;
      }
    }
  }

  private drawCureBar(ratio: number): void {
    const node = this._cureBar;
    if (!node) return;
    let g = node.getComponent(Graphics);
    if (!g) g = node.addComponent(Graphics);
    const r = Math.max(0, Math.min(1, ratio));
    const half = CURE_BAR_H / 2;
    g.clear();
    g.fillColor = CURE_TRACK;
    g.roundRect(-CURE_BAR_W / 2, -half, CURE_BAR_W, CURE_BAR_H, half);
    g.fill();

    const fillW = Math.round(CURE_BAR_W * r);
    g.fillColor = r >= 1 ? Palette.gold : new Color(16, 185, 129, 255);
    g.roundRect(-CURE_BAR_W / 2, -half, fillW, CURE_BAR_H, half);
    g.fill();
  }

  private playMist(fail: boolean): void {
    if (!this._mist) return;
    const mist = this._mist;
    mist.active = true;
    const color: Color = fail ? Palette.mistFail : Palette.mistOk;
    applySprite(
      mist,
      fail ? 'fx/mist_fail' : 'fx/mist_success',
      (sp) => {
        sp.color = Color.WHITE;
      },
      () => paint(mist, color, 0),
    );
    const op = mist.getComponent(UIOpacity) || mist.addComponent(UIOpacity);
    Tween.stopAllByTarget(op);
    op.opacity = 0;
    tween(op).to(0.18, { opacity: 200 }, { easing: 'quadOut' }).delay(0.4).to(0.5, { opacity: 0 }).start();
    this.unschedule(this.hideMist);
    this.scheduleOnce(this.hideMist, 1.1);
  }

  private hideMist = (): void => {
    if (this._mist) this._mist.active = false;
  };

  public onBlendClick(): void {
    if (!this._selectedA || !this._selectedB) {
      const fill = GameModel.instance.autoFillBlendSlots(this._selectedA, this._selectedB);
      if (fill.kind === 'filled') {
        this._selectedA = fill.noteA;
        this._selectedB = fill.noteB;
        this.refreshSlots();
        this.refreshNoteCards();
        AudioKit.play('ui_tap');
        if (this.messageLabel) {
          setLabel(this.messageLabel, '已为你选好原料，再次点击「研制」即可开始制作', Type.badge);
        }
        return;
      }
      if (fill.kind === 'no_stock') {
        AudioKit.play('ui_tap');
        if (this.messageLabel) setLabel(this.messageLabel, '香调原料不足，请先前往窗台采摘', Type.badge);
        if (this.blendBtn) shakeX(this.blendBtn.node);
        return;
      }
      AudioKit.play('ui_tap');
      if (this.messageLabel) setLabel(this.messageLabel, '当前香调暂无搭档原料，请采摘或换一种尝试', Type.badge);
      if (this.blendBtn) shakeX(this.blendBtn.node);
      return;
    }

    try {
      AudioKit.play('blend_start');
      const noteA = this._selectedA;
      const noteB = this._selectedB;
      const result = BlendSystem.startBlend(noteA, noteB);
      AudioKit.play(result.success ? 'blend_ok' : 'blend_fail');
      this.playMist(!result.success);
      this.refreshSlots();
      this.refreshNoteCards();
      this.refreshCuringPanel();

      this.showResultModal(result, noteA, noteB);
    } catch (e: any) {
      if (this.messageLabel) setLabel(this.messageLabel, e.message || '调和失败', Type.badge);
      if (this.blendBtn) shakeX(this.blendBtn.node);
    }
  }

  private buildResultModal(): void {
    this._resultModalNode = makeNode(this.node, 'BlendResultModal', 720, 1280, 0, 0);
    this._resultModalNode.setSiblingIndex(99);
    paint(this._resultModalNode, new Color(0, 0, 0, 180), 0);
    bindClick(this._resultModalNode, () => this.hideResultModal(), this);

    const card = makeNode(this._resultModalNode, 'ResultCard', 600, 560, 0, 0);
    paint(card, Palette.panel, 20);
    this._resultModalCard = card;
    this._resultModalNode.active = false;
  }

  public showResultModal(
    result: { success: boolean; bottleId: string; refundNoteId?: string },
    noteA: string,
    noteB: string,
  ): void {
    if (!this._resultModalNode || !this._resultModalCard) return;
    this._resultModalCard.removeAllChildren();
    this._resultModalNode.setSiblingIndex(99);
    this._resultModalNode.active = true;

    const bottle = ConfigManager.getBottle(result.bottleId);
    const bName = bottle ? bottle.name : (result.success ? result.bottleId : '灰雾练习瓶');

    if (result.success) {
      makeLabel(this._resultModalCard, 'Badge', '✨ 妙香天成 · 移入温鼎', 500, 26, 0, 230, 16, Palette.mint);
      makeLabel(this._resultModalCard, 'Title', `【${bName}】`, 500, 32, 0, 180, Type.card, Palette.ink);

      const artNode = makeNode(this._resultModalCard, 'Art', 140, 160, 0, 60);
      applySprite(artNode, `bottles/${result.bottleId}`);

      const blurb = bottle?.blurb || '幽香浮动，令人神清气爽。';
      makeLabel(this._resultModalCard, 'Blurb', `「${blurb}」`, 520, 36, 0, -56, 16, Palette.inkSoft);
      makeLabel(this._resultModalCard, 'Tip', '⏳ 温鼎定香已开启，完成后自动出鼎上货架，可先去窗台或铺面忙别的', 520, 40, 0, -106, Type.badge, Palette.woodDark);

      const cards = GameModel.instance.speedups;
      const speedText = cards > 0 ? `⚡ 加速卡催生（${cards}）` : '⚡ 加速卡已用完';
      const speedBtn = makeButton(this._resultModalCard, 'BtnModalSpeedup', speedText, 320, 46, 0, -162, Palette.gold);
      setLabel(speedBtn.label, speedText, 16);
      bindClick(speedBtn.node, () => {
        this.hideResultModal();
        this.onSpeedupClick();
      }, this);

      const stayBtn = makeButton(this._resultModalCard, 'BtnModalStay', '⏳ 留在工台静待出鼎', 240, 44, -130, -224, Palette.wood);
      setLabel(stayBtn.label, '⏳ 留在工台静待出鼎', Type.badge);
      bindClick(stayBtn.node, () => this.hideResultModal(), this);

      const shopBtn = makeButton(this._resultModalCard, 'BtnModalShop', '🏪 回铺面打理货架', 240, 44, 130, -224, Palette.woodDark);
      setLabel(shopBtn.label, '🏪 回铺面打理货架', Type.badge);
      bindClick(shopBtn.node, () => {
        this.hideResultModal();
        director.loadScene('Shop');
      }, this);
    } else {
      makeLabel(this._resultModalCard, 'Badge', '💨 气息对冲 · 灰雾沉淀', 500, 26, 0, 230, 16, Palette.disabledText);
      makeLabel(this._resultModalCard, 'Title', `【${bName}】`, 500, 32, 0, 180, Type.card, Palette.ink);

      const artNode = makeNode(this._resultModalCard, 'Art', 140, 160, 0, 60);
      applySprite(artNode, 'bottles/practice_bottle');

      const refundNote = result.refundNoteId ? ConfigManager.getNote(result.refundNoteId) : null;
      const refundText = refundNote ? `🌱 随风返还：已退回 1 份「${refundNote.name}」原料\n` : '';
      const desc = BlendSystem.describePair(noteA, noteB);

      makeLabel(this._resultModalCard, 'Desc', `${refundText}两气未能化作名香，但余香凝成了练习瓶。已存入背包，可去铺面回收变现！`, 520, 44, 0, -56, Type.badge, Palette.inkSoft);
      makeLabel(this._resultModalCard, 'Clue', `💡 寻香秘籍：${desc.tip}`, 520, 40, 0, -110, Type.badge, Palette.woodDark);

      const retryBtn = makeButton(this._resultModalCard, 'BtnModalRetry', '🔄 重新选料调配', 240, 46, -130, -195, Palette.wood);
      setLabel(retryBtn.label, '🔄 重新选料调配', Type.badge);
      bindClick(retryBtn.node, () => this.hideResultModal(), this);

      const recycleBtn = makeButton(this._resultModalCard, 'BtnModalRecycle', '🪙 去铺面回收换钱(8金)', 250, 46, 130, -195, Palette.gold);
      setLabel(recycleBtn.label, '🪙 去铺面回收换钱(8金)', Type.badge);
      bindClick(recycleBtn.node, () => {
        this.hideResultModal();
        director.loadScene('Shop');
      }, this);
    }
  }

  public hideResultModal(): void {
    if (this._resultModalNode) this._resultModalNode.active = false;
  }

  public onSpeedupClick(): void {
    const ok = BlendSystem.speedUpCuring(() => {
      this.refreshCuringPanel();
    });
    if (!ok) {
      if (this.messageLabel) {
        setLabel(this.messageLabel, '加速卡已用尽，可稍待定香或观看短片', Type.badge);
      }
      if (this.speedupBtn) shakeX(this.speedupBtn.node);
    }
  }

  public onAdSpeedupClick(): void {
    const model = GameModel.instance;
    if (!model.activeCuring || BlendSystem.isCuringComplete()) return;
    RewardedAd.show(
      () => {
        BlendSystem.completeCuring();
        this.refreshCuringPanel();
        if (this.messageLabel) {
          setLabel(this.messageLabel, '短片观看完毕，定香立刻大成！', Type.badge);
        }
      },
      () => {
        if (this.messageLabel) {
          setLabel(this.messageLabel, '短片未完成，定香继续静置计时', Type.badge);
        }
      },
    );
  }

  public onClaimClick(): void {
    const res = BlendSystem.claimBottle();
    if (res) {
      AudioKit.play(res.putOnShelf ? 'shelf' : 'coin');
      const bottle = ConfigManager.getBottle(res.bottleId);
      const bottleName = bottle ? bottle.name : res.bottleId;
      if (this.messageLabel) {
        setLabel(this.messageLabel, res.putOnShelf ? `「${bottleName}」已收瓶摆上铺面货架` : `货架已满，「${bottleName}」已存入行囊`, Type.badge);
      }
      floatUp(this.node, `${bottleName} 出瓶`, 0, -120, Palette.gold);
      this.refreshCuringPanel();
      this.refreshSlots();
      this.refreshNoteCards();
    }
  }

  public onBackClick(): void {
    InterstitialAd.show();
    director.loadScene('Shop');
  }
}
