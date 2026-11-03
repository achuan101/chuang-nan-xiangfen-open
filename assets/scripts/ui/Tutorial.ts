import { _decorator, Component, Label, Node, Color, director, BlockInputEvents, Vec3, tween, Tween } from 'cc';
import { GameModel } from '../core/GameModel';
import { TutorialStep } from '../core/Types';
import {
  bindClick,
  labelHeightFor,
  makeButton,
  makeLabel,
  makeNode,
  paint,
  paintStroke,
  Palette,
  setLabel,
  TUTORIAL_Y,
  Type,
} from './UiKit';
import { AudioKit } from '../audio/AudioKit';
import { Pot } from '../farm/Pot';
import { GuestPresenter } from '../shop/GuestPresenter';
import { I18n } from '../core/I18n';

const { ccclass } = _decorator;
const PANEL_STROKE = new Color(225, 210, 195, 255);
const GOLD_ACCENT = new Color(232, 196, 104, 255);
const MINT_DONE = new Color(126, 200, 200, 255);
const DOT_INACTIVE = new Color(235, 216, 192, 255);

const PHASE_ICONS: Record<number, string> = {
  1: '🌿',
  2: '🧪',
  3: '⏳',
  4: '🎁',
};

interface FingerTarget {
  x: number;
  y: number;
  direction: 'up' | 'down';
  tip: string;
}

@ccclass('Tutorial')
export class Tutorial extends Component {
  public static instance: Tutorial | null = null;
  private static _minimizedPhase: number = 0;
  private static _lastPhase: number = 0;
  public static get celebrationShown(): boolean {
    return GameModel.instance.tutorialCelebrated;
  }

  public screenType: 'shop' | 'window' | 'bench' = 'shop';

  private _pillNode: Node | null = null;
  private _pillLabel: Label | null = null;
  private _modalRoot: Node | null = null;
  private _celebrationRoot: Node | null = null;

  // Modal elements
  private _badgeLabel: Label | null = null;
  private _iconLabel: Label | null = null;
  private _titleLabel: Label | null = null;
  private _storyLabel: Label | null = null;
  private _actionBtnLabel: Label | null = null;
  private _subBtnLabel: Label | null = null;
  private _skipBtnLabel: Label | null = null;
  private _dotNodes: Node[] = [];

  // Celebration elements
  private _celebBadgeLabel: Label | null = null;
  private _celebTitleLabel: Label | null = null;
  private _celebDescLabel: Label | null = null;
  private _celebTagLabels: Label[] = [];
  private _celebBtnLabel: Label | null = null;

  // Finger pointer elements
  private _fingerContainer: Node | null = null;
  private _fingerIconLabel: Label | null = null;
  private _fingerTipLabel: Label | null = null;

  private _onModelChanged = () => this.refresh();

  public static attach(parent: Node, screen: 'shop' | 'window' | 'bench' = 'shop'): Tutorial {
    let comp = parent.getComponent(Tutorial);
    if (!comp) comp = parent.addComponent(Tutorial);
    comp.screenType = screen;
    Tutorial.instance = comp;
    comp.buildUi(parent);
    return comp;
  }

  start() {
    Tutorial.instance = this;
    GameModel.instance.on('tutorial_changed', this._onModelChanged);
    GameModel.instance.on('prologue_finished', this._onModelChanged);
    GameModel.instance.on('lang_changed', this._onModelChanged);
    this.refresh();
  }

  onDestroy() {
    if (Tutorial.instance === this) Tutorial.instance = null;
    GameModel.instance.off('tutorial_changed', this._onModelChanged);
    GameModel.instance.off('prologue_finished', this._onModelChanged);
    GameModel.instance.off('lang_changed', this._onModelChanged);
    if (this._fingerContainer) {
      Tween.stopAllByTarget(this._fingerContainer);
    }
  }

  public hideAll(): void {
    if (this._pillNode) this._pillNode.active = false;
    if (this._modalRoot) this._modalRoot.active = false;
    if (this._fingerContainer) this._fingerContainer.active = false;
  }

  public onPrologueFinished(): void {
    Tutorial._minimizedPhase = 0;
    Tutorial._lastPhase = 0;
    this.openModal();
    this.refresh();
  }

  private buildUi(parent: Node): void {
    // 1. 顶部 Y = TUTORIAL_Y (484) 槽位的悬浮指引药丸（指明当前目标与操作，点击可展开居中指引卡片）
    let pillNode = parent.getChildByName('GuidePill');
    if (!pillNode) {
      const pill = makeButton(parent, 'GuidePill', '🏮 指引 (1/4) · 采摘原料 ›', 560, 42, 0, TUTORIAL_Y, GOLD_ACCENT);
      paintStroke(pill.node, GOLD_ACCENT, Palette.paper, 21, 1.5);
      pill.label.color = Palette.ink;
      pill.label.isBold = true;
      setLabel(pill.label, '🏮 指引 (1/4) · 采摘原料 ›', 14);
      bindClick(pill.node, () => this.openModal(), this);
      pillNode = pill.node;
      this._pillLabel = pill.label;
    } else {
      this._pillLabel = pillNode.getChildByName('Label')?.getComponent(Label) || null;
    }
    pillNode.active = false;
    this._pillNode = pillNode;

    // 2. 指引手指与提示气泡 (GuideFingerContainer)
    let fingerNode = parent.getChildByName('GuideFingerContainer');
    if (fingerNode) {
      Tween.stopAllByTarget(fingerNode);
      fingerNode.removeFromParent();
      fingerNode.destroy();
      fingerNode = null;
    }

    fingerNode = makeNode(parent, 'GuideFingerContainer', 220, 90, 0, 0);
    fingerNode.setSiblingIndex(85);

    // 手势图标：默认在容器内 (0, -16)
    const finger = makeLabel(fingerNode, 'Finger', '👇', 60, 44, 0, -16, 36, Palette.gold);
    finger.isBold = true;
    this._fingerIconLabel = finger;

    // 气泡提示盒：默认在手势上方 (0, 26)
    const tipBox = makeNode(fingerNode, 'TipBox', 200, 34, 0, 26);
    paintStroke(tipBox, Palette.paper, GOLD_ACCENT, 14, 1.5);
    const tipLab = makeLabel(tipBox, 'TipText', '点这里前往窗台', 190, 26, 0, 0, 14, Palette.ink);
    tipLab.isBold = true;
    this._fingerTipLabel = tipLab;

    fingerNode.active = false;
    this._fingerContainer = fingerNode;

    // 3. 居中引导卡片模态框（全屏遮罩 + 温暖卡片，规范参考 chuang-nan-xiangfen-xhs）
    let modalNode = parent.getChildByName('GuideModalRoot');
    if (!modalNode) {
      modalNode = makeNode(parent, 'GuideModalRoot', 720, 1280, 0, 0);
      paint(modalNode, new Color(25, 20, 16, 185), 0);
      modalNode.addComponent(BlockInputEvents);

      const card = makeNode(modalNode, 'GuideModalCard', 580, 520, 0, 0);
      paintStroke(card, Palette.paper, GOLD_ACCENT, 24, 2);

      // 顶部条：徽章 + 关闭(收起)按钮
      const headerRow = makeNode(card, 'GuideHeader', 520, 36, 0, 215);
      const badgeBg = makeNode(headerRow, 'BadgeBg', 320, 34, -40, 0);
      paintStroke(badgeBg, Palette.cream, PANEL_STROKE, 14, 1);
      const badgeLab = makeLabel(badgeBg, 'BadgeText', '🏮 新人指引 (1/4) · 采摘原料', 300, 26, 0, 0, 15, Palette.woodDark);
      badgeLab.isBold = true;
      this._badgeLabel = badgeLab;

      const closeBtn = makeButton(headerRow, 'BtnClose', '✕', 34, 34, 230, 0, Palette.cream);
      paintStroke(closeBtn.node, Palette.cream, PANEL_STROKE, 12, 1);
      closeBtn.label.color = Palette.inkSoft;
      setLabel(closeBtn.label, '✕', 16);
      bindClick(closeBtn.node, () => this.minimizeModal(), this);

      // 进度小圆点 (4步)
      const dotsRow = makeNode(card, 'GuideDots', 200, 20, 0, 168);
      this._dotNodes = [];
      [-48, -16, 16, 48].forEach((x, idx) => {
        const dot = makeNode(dotsRow, `Dot_${idx}`, 12, 12, x, 0);
        paint(dot, DOT_INACTIVE, 6);
        this._dotNodes.push(dot);
      });

      // 阶段主图标
      this._iconLabel = makeLabel(card, 'GuideIcon', '🌿', 100, 54, 0, 112, 46, Palette.woodDark);

      // 标题
      this._titleLabel = makeLabel(card, 'GuideTitle', '采摘新鲜原料', 520, 34, 0, 58, 25, Palette.ink);
      this._titleLabel.isBold = true;

      // 故事背景描述文案
      this._storyLabel = makeLabel(
        card,
        'GuideStory',
        '窗南小铺新开张，窗台种植的「雨后」香调已经成熟。先前往窗台采摘原料吧！',
        500,
        70,
        0,
        -12,
        17,
        Palette.inkSoft,
      );
      this._storyLabel.enableWrapText = true;

      // 核心主行动按钮（一键直达/关闭卡片引导手指）
      const actionBtn = makeButton(card, 'GuideActionBtn', '前往「窗台」 ›', 480, 56, 0, -105, GOLD_ACCENT);
      paintStroke(actionBtn.node, GOLD_ACCENT, Palette.paper, 16, 1.5);
      actionBtn.label.color = Palette.ink;
      actionBtn.label.isBold = true;
      setLabel(actionBtn.label, '前往「窗台」 ›', 19);
      bindClick(actionBtn.node, () => this.executeAction(), this);
      this._actionBtnLabel = actionBtn.label;

      // 次级行动：「先关掉卡片，我自己点」
      const subBtn = makeButton(card, 'GuideSubBtn', I18n.t('tut_sub_btn'), 240, 32, 0, -165, Palette.paper);
      subBtn.label.color = Palette.wood;
      setLabel(subBtn.label, I18n.t('tut_sub_btn'), 15);
      bindClick(subBtn.node, () => this.minimizeModal(), this);
      this._subBtnLabel = subBtn.label;

      // 底部跳过指引文字按钮
      const skipBtn = makeButton(card, 'GuideSkipBtn', I18n.t('tut_skip_btn'), 140, 26, 0, -210, Palette.paper);
      skipBtn.label.color = Palette.inkSoft;
      setLabel(skipBtn.label, I18n.t('tut_skip_btn'), 14);
      bindClick(skipBtn.node, () => this.skipTutorial(), this);
      this._skipBtnLabel = skipBtn.label;

      card.on(Node.EventType.TOUCH_END, (e: any) => {
        e.propagationStopped = true;
      });
      // 注意：不给全屏 modalNode 绑定点击关闭，防止触控穿透或误触导致居中卡片被秒关！
      modalNode.active = false;
    } else {
      const card = modalNode.getChildByName('GuideModalCard');
      const oldFinger = card?.getChildByName('CardFinger');
      if (oldFinger) {
        Tween.stopAllByTarget(oldFinger);
        oldFinger.removeFromParent();
        oldFinger.destroy();
      }
      this._badgeLabel = card?.getChildByName('GuideHeader')?.getChildByName('BadgeBg')?.getChildByName('BadgeText')?.getComponent(Label) || null;
      this._iconLabel = card?.getChildByName('GuideIcon')?.getComponent(Label) || null;
      this._titleLabel = card?.getChildByName('GuideTitle')?.getComponent(Label) || null;
      this._storyLabel = card?.getChildByName('GuideStory')?.getComponent(Label) || null;
      this._actionBtnLabel = card?.getChildByName('GuideActionBtn')?.getChildByName('Label')?.getComponent(Label) || null;
      this._subBtnLabel = card?.getChildByName('GuideSubBtn')?.getChildByName('Label')?.getComponent(Label) || null;
      this._skipBtnLabel = card?.getChildByName('GuideSkipBtn')?.getChildByName('Label')?.getComponent(Label) || null;
      const dotsRow = card?.getChildByName('GuideDots');
      this._dotNodes = dotsRow ? dotsRow.children : [];
    }
    this._modalRoot = modalNode;

    // 4. 庆祝结算卡片（开张大吉）
    let celebNode = parent.getChildByName('CelebrationModalRoot');
    if (!celebNode) {
      celebNode = makeNode(parent, 'CelebrationModalRoot', 720, 1280, 0, 0);
      paint(celebNode, new Color(20, 16, 12, 210), 0);
      celebNode.addComponent(BlockInputEvents);

      const card = makeNode(celebNode, 'CelebrationCard', 580, 560, 0, 0);
      paintStroke(card, Palette.paper, GOLD_ACCENT, 24, 2);

      const badge = makeLabel(card, 'Badge', I18n.t('celeb_badge'), 300, 30, 0, 220, 18, Palette.woodDark);
      badge.isBold = true;
      this._celebBadgeLabel = badge;

      const title = makeLabel(card, 'Title', I18n.t('celeb_title'), 500, 34, 0, 175, 24, Palette.ink);
      title.isBold = true;
      this._celebTitleLabel = title;

      makeLabel(card, 'Icon', '💐 🎁 ✨', 200, 54, 0, 115, 46, Palette.woodDark);

      const desc = makeLabel(
        card,
        'Desc',
        I18n.t('celeb_desc'),
        500,
        60,
        0,
        40,
        17,
        Palette.inkSoft,
      );
      desc.enableWrapText = true;
      this._celebDescLabel = desc;

      // 4 枚奖励标签
      const tagsBox = makeNode(card, 'RewardTags', 520, 80, 0, -50);
      const tagKeys = ['celeb_tag_rep', 'celeb_tag_pots', 'celeb_tag_album', 'celeb_tag_craft'];
      const tagW = 118;
      const tagGap = 10;
      const startX = -((tagKeys.length * tagW + (tagKeys.length - 1) * tagGap) / 2) + tagW / 2;
      this._celebTagLabels = [];
      tagKeys.forEach((k, i) => {
        const box = makeNode(tagsBox, `Tag_${i}`, tagW, 36, startX + i * (tagW + tagGap), 0);
        paintStroke(box, Palette.cream, PANEL_STROKE, 10, 1);
        const l = makeLabel(box, 'Text', I18n.t(k), tagW, 26, 0, 0, 14, Palette.woodDark);
        l.isBold = true;
        this._celebTagLabels.push(l);
      });

      const closeBtn = makeButton(card, 'BtnClaimCelebration', I18n.t('celeb_btn'), 460, 56, 0, -160, GOLD_ACCENT);
      paintStroke(closeBtn.node, GOLD_ACCENT, Palette.paper, 16, 1.5);
      closeBtn.label.color = Palette.ink;
      closeBtn.label.isBold = true;
      setLabel(closeBtn.label, I18n.t('celeb_btn'), 19);
      bindClick(closeBtn.node, () => this.dismissCelebration(), this);
      this._celebBtnLabel = closeBtn.label;

      card.on(Node.EventType.TOUCH_END, (e: any) => {
        e.propagationStopped = true;
      });
      bindClick(celebNode, () => this.dismissCelebration(), this);
      celebNode.active = false;
    } else {
      const card = celebNode.getChildByName('CelebrationCard');
      this._celebBadgeLabel = card?.getChildByName('Badge')?.getComponent(Label) || null;
      this._celebTitleLabel = card?.getChildByName('Title')?.getComponent(Label) || null;
      this._celebDescLabel = card?.getChildByName('Desc')?.getComponent(Label) || null;
      this._celebBtnLabel = card?.getChildByName('BtnClaimCelebration')?.getChildByName('Label')?.getComponent(Label) || null;
      const tagsBox = card?.getChildByName('RewardTags');
      this._celebTagLabels = tagsBox ? tagsBox.children.map(c => c.getChildByName('Text')?.getComponent(Label)!).filter(Boolean) : [];
    }
    this._celebrationRoot = celebNode;
  }

  public refresh(): void {
    const model = GameModel.instance;

    // 0. 如果开场漫画还没播完，指引全面静默，严禁抢占弹窗！
    if (!model.prologueShown) {
      if (this._pillNode) this._pillNode.active = false;
      if (this._modalRoot) this._modalRoot.active = false;
      if (this._fingerContainer) this._fingerContainer.active = false;
      return;
    }

    const info = model.tutorialInfo(this.screenType);

    // 1. 如果已完成且未展示过庆祝卡片
    if (model.tutorialCompleted) {
      if (this._pillNode) this._pillNode.active = false;
      if (this._modalRoot) this._modalRoot.active = false;
      if (this._fingerContainer) this._fingerContainer.active = false;
      if (!model.tutorialCelebrated && this.screenType === 'shop') {
        this.showCelebration();
      }
      return;
    }

    if (!info) {
      if (this._pillNode) this._pillNode.active = false;
      if (this._modalRoot) this._modalRoot.active = false;
      if (this._fingerContainer) this._fingerContainer.active = false;
      return;
    }

    // 2. 更新胶囊按钮文案与状态
    const stepTipKey = `tut_step_${model.tutorialStep}`;
    const stepTip = I18n.t(stepTipKey);
    const actionTip = stepTip !== stepTipKey ? stepTip : info.tip;
    if (this._pillNode && this._pillLabel) {
      setLabel(this._pillLabel, I18n.t('tut_pill', { phase: info.phase, total: info.totalPhases, name: info.phaseName, tip: actionTip }), 14);
    }

    // 3. 更新卡片模态框文案与状态
    if (this._badgeLabel) {
      setLabel(this._badgeLabel, I18n.t('tut_badge', { phase: info.phase, total: info.totalPhases, name: info.phaseName }), 14);
    }
    if (this._iconLabel) {
      setLabel(this._iconLabel, PHASE_ICONS[info.phase] || '🌿', 46);
    }
    if (this._titleLabel) {
      setLabel(this._titleLabel, info.title, 25);
    }
    if (this._storyLabel) {
      setLabel(this._storyLabel, info.story, 17);
    }
    if (this._actionBtnLabel) {
      setLabel(this._actionBtnLabel, `${info.actionText} ›`, 19);
    }
    if (this._subBtnLabel) {
      setLabel(this._subBtnLabel, I18n.t('tut_sub_btn'), 15);
    }
    if (this._skipBtnLabel) {
      setLabel(this._skipBtnLabel, I18n.t('tut_skip_btn'), 14);
    }

    // 4. 更新步骤圆点
    this._dotNodes.forEach((dot, idx) => {
      const stepNum = idx + 1;
      if (stepNum < info.phase) {
        paint(dot, MINT_DONE, 6);
        dot.setScale(1, 1, 1);
      } else if (stepNum === info.phase) {
        paint(dot, GOLD_ACCENT, 6);
        dot.setScale(1.8, 1, 1);
      } else {
        paint(dot, DOT_INACTIVE, 6);
        dot.setScale(1, 1, 1);
      }
    });

    // 5. 阶段递进时自动弹出居中指引卡片（指引卡片在中间！）；同一阶段若已关闭收起则保持最小化并展示场景内手势引导
    if (Tutorial._lastPhase !== info.phase) {
      Tutorial._lastPhase = info.phase;
      Tutorial._minimizedPhase = 0; // 只要进入新阶段，强制重置最小化状态，弹出居中卡片！
    }

    if (Tutorial._minimizedPhase !== info.phase) {
      this.openModal();
    } else {
      if (this._modalRoot) this._modalRoot.active = false;
      if (this._pillNode) this._pillNode.active = true;
      this.updateFingerGuide();
    }
  }

  public openModal(): void {
    AudioKit.play('ui_tap');
    if (this._modalRoot && this._modalRoot.parent) {
      // 必须置于父节点顶层，避免被下层的货架/客人等组件覆盖
      this._modalRoot.setSiblingIndex(this._modalRoot.parent.children.length - 1);
      this._modalRoot.active = true;
    }
    if (this._pillNode) {
      this._pillNode.active = false;
    }
    // 模态弹窗开启时，隐藏手指，避免背景穿透干扰
    if (this._fingerContainer) {
      this._fingerContainer.active = false;
    }
  }

  public minimizeModal(): void {
    AudioKit.play('ui_tap');
    const info = GameModel.instance.tutorialInfo(this.screenType);
    if (info) {
      Tutorial._minimizedPhase = info.phase;
    }
    if (this._modalRoot) {
      this._modalRoot.active = false;
    }
    if (this._pillNode && !GameModel.instance.tutorialCompleted) {
      this._pillNode.active = true;
    }
    // 模态卡片关闭后，立刻显现点击手指引导玩家点击具体按钮！
    this.updateFingerGuide();
  }

  public skipTutorial(): void {
    AudioKit.play('ui_tap');
    this.minimizeModal();
    GameModel.instance.skipTutorial();
    this.refresh();
  }

  public showCelebration(): void {
    GameModel.instance.markTutorialCelebrated();
    if (this._celebBadgeLabel) setLabel(this._celebBadgeLabel, I18n.t('celeb_badge'), 18);
    if (this._celebTitleLabel) setLabel(this._celebTitleLabel, I18n.t('celeb_title'), 24);
    if (this._celebDescLabel) setLabel(this._celebDescLabel, I18n.t('celeb_desc'), 17);
    const tagKeys = ['celeb_tag_rep', 'celeb_tag_pots', 'celeb_tag_album', 'celeb_tag_craft'];
    this._celebTagLabels.forEach((l, i) => {
      if (tagKeys[i]) setLabel(l, I18n.t(tagKeys[i]), 14);
    });
    if (this._celebBtnLabel) setLabel(this._celebBtnLabel, I18n.t('celeb_btn'), 19);

    if (this._celebrationRoot && this._celebrationRoot.parent) {
      this._celebrationRoot.setSiblingIndex(this._celebrationRoot.parent.children.length - 1);
      this._celebrationRoot.active = true;
      AudioKit.play('coin');
    }
    if (this._pillNode) {
      this._pillNode.active = false;
    }
    if (this._fingerContainer) {
      this._fingerContainer.active = false;
    }
  }

  public dismissCelebration(): void {
    AudioKit.play('ui_tap');
    GameModel.instance.markTutorialCelebrated();
    if (this._celebrationRoot) {
      this._celebrationRoot.active = false;
    }
  }

  /**
   * 引导手势与提示气泡定位：
   * 精确指向当前场景中必须点击的交互按钮，并带有动态跳跃与气泡提示
   */
  private updateFingerGuide(): void {
    const model = GameModel.instance;
    if (model.tutorialCompleted || !model.prologueShown || !this._fingerContainer) {
      if (this._fingerContainer) this._fingerContainer.active = false;
      return;
    }
    if (this._modalRoot && this._modalRoot.active) {
      this._fingerContainer.active = false;
      return;
    }

    const target = this.getFingerTarget(model.tutorialStep, this.screenType);
    if (!target) {
      this._fingerContainer.active = false;
      return;
    }

    // 停止正在进行的缓动，确保从当前基准位置重新开始动画
    Tween.stopAllByTarget(this._fingerContainer);
    this._fingerContainer.setPosition(target.x, target.y, 0);
    if (this._fingerContainer.parent) {
      this._fingerContainer.setSiblingIndex(this._fingerContainer.parent.children.length - 1);
    }
    this._fingerContainer.active = true;

    const isDown = target.direction === 'down';
    if (this._fingerIconLabel) {
      this._fingerIconLabel.string = isDown ? '👇' : '👆';
      this._fingerIconLabel.node.setPosition(0, isDown ? -16 : 16, 0);
    }
    if (this._fingerTipLabel) {
      setLabel(this._fingerTipLabel, target.tip, 14);
      const tipBox = this._fingerContainer.getChildByName('TipBox');
      if (tipBox) {
        tipBox.setPosition(0, isDown ? 26 : -26, 0);
      }
    }

    // 动态弹性跳跃指向
    const bounceY = isDown ? -8 : 8;
    tween(this._fingerContainer)
      .by(0.42, { position: new Vec3(0, bounceY, 0) })
      .by(0.42, { position: new Vec3(0, -bounceY, 0) })
      .repeatForever()
      .start();
  }

  private getFingerTarget(step: TutorialStep, screen: 'shop' | 'window' | 'bench'): FingerTarget | null {
    if (screen === 'shop') {
      if (step === 'go_window') {
        // 指向底部导航「窗台」按钮 (BottomNav x=83, y=-560，顶边缘 y=-531)
        // 容器放在 (83, -485)，手指在 -16 (y=-501)，向下指向按钮顶边缘；气泡在 +26 (y=-459)
        return { x: 83, y: -485, direction: 'down', tip: I18n.t('tut_finger_window') };
      }
      if (step === 'deliver') {
        // 指向客人卡片中的「交付」按钮 (GuestArea y=-105, 交付按钮在 x=-85, y=-80 -> 场景坐标 y=-185)
        // 容器放在 (-85, -260)，手指在 +16 (y=-244)，向上指向交付按钮；气泡在 -26 (y=-286)
        return { x: -85, y: -260, direction: 'up', tip: I18n.t('tut_finger_deliver') };
      }
      // 其他阶段在铺面需前往工台
      if (step === 'go_bench' || step === 'blend' || step === 'wait_cure' || step === 'claim') {
        return { x: -83, y: -485, direction: 'down', tip: I18n.t('tut_finger_bench') };
      }
      return null;
    }

    if (screen === 'window') {
      if (step === 'harvest') {
        // 指向 1 号盆「采摘」按钮 (Pot1 x=-225, BtnHarvest 场景坐标 y=-170)
        return { x: -225, y: -105, direction: 'down', tip: I18n.t('tut_finger_harvest') };
      }
      if (step === 'go_bench') {
        // 指向底部快捷前往工台按钮 BtnGoBench (y=-345)
        return { x: 0, y: -280, direction: 'down', tip: I18n.t('tut_finger_bench_craft') };
      }
      if (step === 'go_shop' || step === 'deliver') {
        // 指向底部导航「铺面」按钮 (x=-249, y=-560)
        return { x: -249, y: -485, direction: 'down', tip: I18n.t('tut_finger_shop') };
      }
      return null;
    }

    if (screen === 'bench') {
      if (step === 'blend') {
        // 指向合香池「✨ 开始研制」按钮 BtnBlend (y=-175)
        return { x: 0, y: -110, direction: 'down', tip: I18n.t('tut_finger_blend') };
      }
      if (step === 'wait_cure') {
        // 指向定香面板「⚡ 使用加速卡」按钮 (x=-162, y=-478)
        return { x: -162, y: -415, direction: 'down', tip: I18n.t('tut_finger_speedup') };
      }
      if (step === 'claim') {
        // 指向定香面板「定香出瓶」按钮 (x=0, y=-478)
        return { x: 0, y: -415, direction: 'down', tip: I18n.t('tut_finger_claim') };
      }
      if (step === 'go_shop' || step === 'deliver') {
        // 指向底部导航「铺面」按钮 (x=-249, y=-560)
        return { x: -249, y: -485, direction: 'down', tip: I18n.t('tut_finger_shop') };
      }
      return null;
    }

    return null;
  }

  public executeAction(): void {
    const model = GameModel.instance;
    const info = model.tutorialInfo(this.screenType);
    if (!info) return;

    AudioKit.play('ui_tap');
    this.minimizeModal();

    switch (info.actionAct) {
      case 'goto-window':
        director.loadScene('Window');
        break;

      case 'goto-bench':
        director.loadScene('Bench');
        break;

      case 'goto-shop':
        director.loadScene('Shop');
        break;

      case 'harvest': {
        const potNode = this.node.getChildByName('Pot1') || this.node.parent?.getChildByName('Pot1');
        const pot = potNode?.getComponent(Pot);
        if (pot) {
          pot.onHarvestClick();
        }
        break;
      }

      case 'blend': {
        const blendComp = (this.node.getComponent('BlendView') || this.node.parent?.getComponent('BlendView')) as any;
        if (blendComp && typeof blendComp.onBlendClick === 'function') {
          blendComp.onBlendClick();
        }
        break;
      }

      case 'speedup': {
        const blendComp = (this.node.getComponent('BlendView') || this.node.parent?.getComponent('BlendView')) as any;
        if (blendComp && typeof blendComp.onSpeedupClick === 'function') {
          blendComp.onSpeedupClick();
        }
        break;
      }

      case 'claim': {
        const blendComp = (this.node.getComponent('BlendView') || this.node.parent?.getComponent('BlendView')) as any;
        if (blendComp && typeof blendComp.onClaimClick === 'function') {
          blendComp.onClaimClick();
        }
        break;
      }

      case 'deliver': {
        const guestPres = this.node.getComponentInChildren(GuestPresenter) || this.node.parent?.getComponentInChildren(GuestPresenter);
        if (guestPres) {
          guestPres.onSubmitClick();
        }
        break;
      }

      default:
        break;
    }
  }
}
