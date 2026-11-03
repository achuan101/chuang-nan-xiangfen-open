import {
  _decorator,
  Component,
  director,
  Mask,
  Node,
  ScrollView,
  Vec3,
  UIOpacity,
  tween,
  Tween,
  Label,
  Color,
  Button,
} from 'cc';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { I18n } from '../core/I18n';
import { AudioKit } from '../audio/AudioKit';
import { BottomNav } from '../ui/BottomNav';
import {
  applyAmbientBg,
  applySpriteOrFallback,
  bindClick,
  ensureCanvas,
  ensureTransform,
  makeButton,
  makeLabel,
  makeNode,
  paint,
  paintStroke,
  Palette,
  setLabel,
  Type,
  NAV_Y,
} from '../ui/UiKit';
import { floatUp } from '../ui/Motion';

const { ccclass } = _decorator;

type AlbumTab = 'bottles' | 'guests';

const GOLD_ACTIVE = new Color(243, 207, 122, 255);
const GOLD_ACTIVE_STROKE = new Color(252, 231, 173, 255);
const TERRACOTTA_ACTIVE = new Color(194, 91, 78, 255);
const TERRACOTTA_STROKE = new Color(221, 120, 105, 255);
const IVORY_CARD = new Color(255, 251, 245, 245);
const CARD_STROKE = new Color(236, 220, 203, 255);
const RED_SEAL = new Color(185, 28, 28, 255);
const ROSE_HEART = new Color(244, 63, 94, 255);
const GREY_HEART = new Color(196, 173, 152, 255);

@ccclass('AlbumView')
export class AlbumView extends Component {
  private _currentTab: AlbumTab = 'bottles';
  private _tabBottlesBtn: Node | null = null;
  private _tabGuestsBtn: Node | null = null;
  private _containerNode: Node | null = null;
  private _flippedCardIds: Set<string> = new Set();
  private _modalNode: Node | null = null;

  start() {
    GameModel.instance.initialize();
    AudioKit.init();
    ensureCanvas(this.node);
    this.buildUi();
  }

  public buildUi(): void {
    applyAmbientBg(this.node);

    // 1. 场景顶栏标题与音频控制行 (y=560, h=48)
    const topBar = makeNode(this.node, 'AlbumTopBar', 680, 48, 0, 560);

    // 中间场景标题药丸
    const centerTitle = makeNode(topBar, 'TopCenterTitle', 180, 40, 0, 0);
    paint(centerTitle, new Color(42, 34, 27, 220), 20);
    paintStroke(centerTitle, new Color(42, 34, 27, 220), new Color(82, 65, 52, 255), 20, 1);
    makeLabel(centerTitle, 'TitleText', I18n.t('scene_album'), 160, 30, 0, 0, Type.head, Palette.paper);

    // 右侧音频按钮 (避让右上角胶囊)
    const bgmBtn = makeButton(topBar, 'BtnBgm', '♪', 40, 36, 235, 0, Palette.panel);
    paintStroke(bgmBtn.node, Palette.panel, new Color(216, 195, 173, 255), 18, 1);
    bgmBtn.label.color = Palette.woodDark;
    bindClick(bgmBtn.node, () => {
      AudioKit.play('ui_tap');
    }, this);

    const soundBtn = makeButton(topBar, 'BtnSound', GameModel.instance.muted ? '🔈' : '🔊', 40, 36, 285, 0, Palette.panel);
    paintStroke(soundBtn.node, Palette.panel, new Color(216, 195, 173, 255), 18, 1);
    soundBtn.label.color = Palette.woodDark;
    bindClick(soundBtn.node, () => {
      GameModel.instance.toggleMuted();
      setLabel(soundBtn.label, GameModel.instance.muted ? '🔈' : '🔊');
    }, this);

    // 2. 双 Tab 切换栏 (y=480, h=48)
    const tabBar = makeNode(this.node, 'AlbumTabBar', 680, 48, 0, 480);
    paint(tabBar, IVORY_CARD, 20);
    paintStroke(tabBar, IVORY_CARD, CARD_STROKE, 20, 1);

    const btnW = 320;
    const btnH = 40;

    const bBtn = makeButton(tabBar, 'TabBottles', I18n.t('album_tab_bottles'), btnW, btnH, -165, 0, GOLD_ACTIVE);
    this._tabBottlesBtn = bBtn.node;
    bindClick(bBtn.node, () => this.switchTab('bottles'), this);

    const gBtn = makeButton(tabBar, 'TabGuests', I18n.t('album_tab_guests'), btnW, btnH, 165, 0, Palette.paper);
    this._tabGuestsBtn = gBtn.node;
    bindClick(gBtn.node, () => this.switchTab('guests'), this);

    // 3. 主内容挂载节点 (y=-40, h=960, range: [-520, 440])
    this._containerNode = makeNode(this.node, 'TabContentRoot', 680, 960, 0, -40);

    // 4. 底部统一导航栏 (y=-560, h=64)
    BottomNav.attach(this.node, 'album');

    this.renderCurrentTab();
  }

  public switchTab(tab: AlbumTab): void {
    if (this._currentTab === tab) return;
    this._currentTab = tab;
    AudioKit.play('ui_tap');
    this.renderCurrentTab();
  }

  private renderCurrentTab(): void {
    if (!this._containerNode) return;
    this._containerNode.removeAllChildren();

    const bottles = ConfigManager.getAlbumBottles();
    const model = GameModel.instance;
    const collectedCount = bottles.filter(b => model.hasObtained(b.id)).length;

    // 更新 Tab 按钮高亮与文案
    if (this._tabBottlesBtn) {
      const isBottles = this._currentTab === 'bottles';
      paint(this._tabBottlesBtn, isBottles ? GOLD_ACTIVE : Palette.paper, 16);
      if (isBottles) paintStroke(this._tabBottlesBtn, GOLD_ACTIVE, GOLD_ACTIVE_STROKE, 16, 2);
      const l = this._tabBottlesBtn.getChildByName('Label')?.getComponent(Label);
      if (l) {
        setLabel(l, I18n.t('album_tab_bottles_count', { collected: collectedCount, total: bottles.length }));
        l.color = isBottles ? new Color(74, 46, 18, 255) : new Color(109, 77, 51, 255);
      }
    }
    if (this._tabGuestsBtn) {
      const isGuests = this._currentTab === 'guests';
      paint(this._tabGuestsBtn, isGuests ? TERRACOTTA_ACTIVE : Palette.paper, 16);
      if (isGuests) paintStroke(this._tabGuestsBtn, TERRACOTTA_ACTIVE, TERRACOTTA_STROKE, 16, 2);
      const l = this._tabGuestsBtn.getChildByName('Label')?.getComponent(Label);
      if (l) {
        setLabel(l, I18n.t('album_tab_guests_title'));
        l.color = isGuests ? Palette.paper : new Color(109, 77, 51, 255);
      }
    }

    if (this._currentTab === 'bottles') {
      this.renderBottlesTab();
    } else {
      this.renderGuestsTab();
    }
  }

  /** 渲染【研制图谱 · 香谱】视图 */
  private renderBottlesTab(): void {
    const bottles = ConfigManager.getAlbumBottles();
    const model = GameModel.instance;
    const collectedCount = bottles.filter(b => model.hasObtained(b.id)).length;
    const percent = Math.round((collectedCount / bottles.length) * 100);

    // 顶部进度卡片 (y=410, w=680, h=110)
    const progCard = makeNode(this._containerNode!, 'ProgressCard', 680, 110, 0, 410);
    paint(progCard, IVORY_CARD, 20);
    paintStroke(progCard, IVORY_CARD, CARD_STROKE, 20, 1);

    makeLabel(progCard, 'ProgTitle', I18n.t('album_prog_title'), 300, 26, -170, 28, Type.sub, Palette.ink);

    const badge = makeNode(progCard, 'ProgBadge', 180, 26, 220, 28);
    paint(badge, new Color(244, 232, 220, 255), 13);
    paintStroke(badge, new Color(244, 232, 220, 255), new Color(214, 193, 173, 255), 13, 1);
    makeLabel(badge, 'BadgeText', I18n.t('album_prog_badge', { collected: collectedCount, total: bottles.length, percent }), 170, 22, 0, 0, 15, Palette.woodDark);

    // 进度条轨道与填充
    const progTrack = makeNode(progCard, 'ProgTrack', 640, 10, 0, -4);
    paint(progTrack, new Color(235, 220, 203, 255), 5);
    const fillW = Math.max(10, Math.floor(640 * (collectedCount / bottles.length)));
    const progFill = makeNode(progTrack, 'ProgFill', fillW, 10, -320 + fillW / 2, 0);
    paint(progFill, new Color(217, 119, 6, 255), 5);

    makeLabel(progCard, 'ProgSubtitle', I18n.t('album_prog_sub'), 640, 22, 0, -32, 15, Palette.inkSoft);

    // 12 款香氛九宫格 / 十二宫格滚动区 (y=-65, w=680, h=810)
    const cols = 3;
    const cardW = 210;
    const cardH = 230;
    const gapX = 14;
    const gapY = 14;
    const padTop = 10;
    const padBottom = 20;
    const rows = Math.ceil(bottles.length / cols);
    const contentH = padTop + rows * cardH + Math.max(0, rows - 1) * gapY + padBottom;
    const totalW = cols * cardW + (cols - 1) * gapX;
    const startX = -totalW / 2 + cardW / 2;

    const { content } = this.buildScroll(this._containerNode!, 'BottleScroll', 680, 810, 0, -65, contentH);

    bottles.forEach((bottle, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = -(padTop + row * (cardH + gapY) + cardH / 2);
      const card = makeNode(content, `Album_${bottle.id}`, cardW, cardH, x, y);

      const unlocked = model.hasObtained(bottle.id);
      const isFlipped = this._flippedCardIds.has(bottle.id);

      this.renderBottleCardFace(card, bottle, isFlipped, unlocked, cardW, cardH);

      // 点击翻牌动效
      let btn = card.getComponent(Button);
      if (!btn) btn = card.addComponent(Button);
      btn.transition = Button.Transition.NONE;

      let isFlipping = false;
      bindClick(card, () => {
        if (isFlipping) return;
        isFlipping = true;
        AudioKit.play('ui_tap');
        const flipping = !this._flippedCardIds.has(bottle.id);
        if (flipping) this._flippedCardIds.add(bottle.id);
        else this._flippedCardIds.delete(bottle.id);

        Tween.stopAllByTarget(card);
        tween(card)
          .to(0.12, { scale: new Vec3(0, 1, 1) })
          .call(() => {
            this.renderBottleCardFace(card, bottle, flipping, unlocked, cardW, cardH);
          })
          .to(0.12, { scale: new Vec3(1, 1, 1) })
          .call(() => {
            isFlipping = false;
          })
          .start();
      }, this);
    });
  }

  private renderBottleCardFace(
    card: Node,
    bottle: any,
    isBack: boolean,
    unlocked: boolean,
    cardW: number,
    cardH: number,
  ): void {
    card.removeAllChildren();

    if (!isBack) {
      // ====== 正面 ======
      paint(card, unlocked ? new Color(255, 253, 248, 250) : IVORY_CARD, 20);
      paintStroke(
        card,
        unlocked ? new Color(255, 253, 248, 250) : IVORY_CARD,
        unlocked ? new Color(224, 186, 150, 255) : CARD_STROKE,
        20,
        unlocked ? 1.5 : 1,
      );

      // 解锁印章：已录
      if (unlocked) {
        const seal = makeNode(card, 'Seal', 44, 22, cardW / 2 - 32, cardH / 2 - 18);
        paint(seal, RED_SEAL, 4);
        makeLabel(seal, 'SealText', I18n.t('album_seal_done'), 40, 18, 0, 0, 15, Palette.paper);
      }

      // 香水瓶图标
      const icon = makeNode(card, 'Icon', 88, 104, 0, 24);
      if (unlocked) {
        applySpriteOrFallback(icon, `bottles/${bottle.id}`, 'ui/bottle_locked', Palette.panel, true);
      } else {
        applySpriteOrFallback(icon, 'ui/bottle_locked', null, Palette.woodDark, true);
        const op = icon.getComponent(UIOpacity) || icon.addComponent(UIOpacity);
        op.opacity = 100;
      }

      // 香氛名称
      const bName = unlocked ? I18n.tBottle(bottle.id).name : I18n.t('album_locked_name');
      makeLabel(
        card,
        'Name',
        bName,
        cardW - 16,
        24,
        0,
        -46,
        18,
        unlocked ? Palette.ink : Palette.inkSoft,
      );

      // 标签属性
      const tagStr = unlocked
        ? `[${bottle.tags.map((t: string) => I18n.tTag(t)).join(' · ')}]`
        : I18n.t('album_locked_tag', { tag: I18n.tTag(bottle.tags[0] || '香') });
      makeLabel(card, 'Tags', tagStr, cardW - 16, 20, 0, -70, 15, Palette.inkSoft);

      // 翻面提示
      makeLabel(card, 'FlipTip', I18n.t('album_flip_tip'), cardW - 16, 20, 0, -94, 15, Palette.wood);
    } else {
      // ====== 背面 ======
      paint(card, new Color(251, 245, 237, 250), 20);
      paintStroke(card, new Color(251, 245, 237, 250), new Color(216, 184, 150, 255), 20, 1.5);

      // 顶部标题与放大按钮
      makeLabel(card, 'BackTitle', unlocked ? I18n.tBottle(bottle.id).name : I18n.t('album_locked_name'), 110, 24, -36, 88, 16, Palette.ink);

      const zoomBtn = makeButton(card, 'BtnZoom', I18n.t('album_zoom'), 60, 24, 64, 88, new Color(244, 232, 220, 255));
      paintStroke(zoomBtn.node, new Color(244, 232, 220, 255), new Color(216, 195, 173, 255), 10, 1);
      zoomBtn.label.color = Palette.woodDark;
      zoomBtn.node.on(Node.EventType.TOUCH_START, (e: any) => {
        if (e && e.propagationStopped !== undefined) e.propagationStopped = true;
      });
      zoomBtn.node.on(Node.EventType.TOUCH_END, (e: any) => {
        if (e && e.propagationStopped !== undefined) e.propagationStopped = true;
      });
      bindClick(zoomBtn.node, () => {
        AudioKit.play('ui_tap');
        this.openBottleDetailModal(bottle, unlocked);
      }, this);

      // 故事简述
      const bInfo = I18n.tBottle(bottle.id);
      const loreText = unlocked
        ? (bottle.lore || bottle.blurb || I18n.t('album_back_lore_fallback'))
        : `古籍记载：此香蕴含『${bottle.tags.join('』与『')}』之韵，需在研制台集齐相应香调融合。`;
      makeLabel(card, 'BackLore', loreText, cardW - 20, 72, 0, 26, 15, Palette.ink);

      // 配方 / 韵味提示
      const recipe = ConfigManager.getAllRecipes().find(r => r.bottleId === bottle.id && r.result === 'success');
      const recipeText = unlocked && recipe && recipe.inputs
        ? recipe.inputs.map(id => I18n.tNote(id)).join(' + ')
        : bottle.tags.map((t: string) => `#${I18n.tTag(t)}`).join(' ');

      const recNode = makeNode(card, 'RecipePill', cardW - 24, 26, 0, -46);
      paint(recNode, new Color(240, 227, 211, 220), 8);
      const recPillText = unlocked ? I18n.t('album_recipe_pill', { recipe: recipeText }) : I18n.t('album_clue_pill', { recipe: recipeText });
      makeLabel(recNode, 'RecipeText', recPillText, cardW - 30, 20, 0, 0, 15, Palette.woodDark);

      // 翻回提示
      makeLabel(card, 'FlipBackTip', I18n.t('album_flip_back'), cardW - 16, 20, 0, -94, 15, Palette.wood);
    }
  }

  /** 打开香水大图全览弹窗 (对应截图 1) */
  private openBottleDetailModal(bottle: any, unlocked: boolean): void {
    if (this._modalNode) this._modalNode.destroy();

    const root = makeNode(this.node, 'DetailModal', 720, 1280, 0, 0);
    this._modalNode = root;

    // 半透明遮罩
    const mask = makeNode(root, 'ModalMask', 720, 1280, 0, 0);
    paint(mask, new Color(0, 0, 0, 160), 0);
    bindClick(mask, () => root.destroy(), this);

    // 主弹窗卡片 (w=640, h=940)
    const dialog = makeNode(root, 'Dialog', 640, 940, 0, 0);
    paint(dialog, IVORY_CARD, 24);
    paintStroke(dialog, IVORY_CARD, CARD_STROKE, 24, 2);

    // 右上角关闭按钮
    const closeBtn = makeButton(dialog, 'BtnClose', '✕', 44, 44, 276, 430, new Color(244, 232, 220, 200));
    paintStroke(closeBtn.node, new Color(244, 232, 220, 200), CARD_STROKE, 22, 1);
    closeBtn.label.color = Palette.woodDark;
    bindClick(closeBtn.node, () => root.destroy(), this);

    // 香氛立体插画槽位 (w=180, h=190, y=285)
    const iconWell = makeNode(dialog, 'IconWell', 180, 190, 0, 285);
    paint(iconWell, new Color(244, 232, 220, 180), 20);
    paintStroke(iconWell, new Color(244, 232, 220, 180), new Color(228, 209, 189, 255), 20, 1);
    const spriteNode = makeNode(iconWell, 'Sprite', 120, 150, 0, 0);
    if (unlocked) {
      applySpriteOrFallback(spriteNode, `bottles/${bottle.id}`, 'ui/bottle_locked', Palette.panel, true);
    } else {
      applySpriteOrFallback(spriteNode, 'ui/bottle_locked', null, Palette.woodDark, true);
      const op = spriteNode.getComponent(UIOpacity) || spriteNode.addComponent(UIOpacity);
      op.opacity = 110;
    }

    // 香氛大标题 (y=160)
    makeLabel(dialog, 'Title', unlocked ? bottle.name : '待探明香氛', 400, 32, 0, 160, 26, Palette.ink);

    // 标签与瓶型行 (y=116)
    const tagsRow = makeNode(dialog, 'TagsRow', 500, 32, 0, 116);
    let tagX = -120;
    bottle.tags.forEach((tag: string) => {
      const tagChip = makeNode(tagsRow, `Tag_${tag}`, 70, 26, tagX, 0);
      paint(tagChip, new Color(235, 220, 203, 255), 8);
      makeLabel(tagChip, 'Text', `#${tag}`, 64, 20, 0, 0, 15, Palette.ink);
      tagX += 80;
    });
    const shapeMap: Record<string, string> = { spray: '喷雾瓶', frost_square: '磨砂方瓶', round: '圆润瓶' };
    const shapeChip = makeNode(tagsRow, 'ShapeChip', 90, 26, tagX + 10, 0);
    paint(shapeChip, new Color(254, 243, 199, 255), 8);
    makeLabel(shapeChip, 'Text', shapeMap[bottle.shape] || '雅致瓶', 84, 20, 0, 0, 15, new Color(146, 64, 14, 255));

    // 卡片一：香氛小传与心境 (y=-15, w=580, h=180)
    const loreCard = makeNode(dialog, 'LoreCard', 580, 180, 0, -15);
    paint(loreCard, new Color(246, 238, 228, 255), 18);
    paintStroke(loreCard, new Color(246, 238, 228, 255), new Color(229, 212, 195, 255), 18, 1);

    makeLabel(loreCard, 'LoreHead', '📖 香氛小传与心境', 540, 26, 0, 60, 18, Palette.woodDark);
    const story = bottle.lore || bottle.blurb || '江南巧匠研制，芬芳悠远。';
    makeLabel(loreCard, 'LoreBody', story, 540, 64, 0, 6, 15, Palette.ink);
    makeLabel(loreCard, 'LoreQuote', `✨ “${bottle.blurb}”`, 540, 24, 0, -56, 15, new Color(217, 119, 6, 255));

    // 卡片二：调香配方 (y=-175, w=580, h=140)
    const recCard = makeNode(dialog, 'RecipeCard', 580, 140, 0, -175);
    paint(recCard, new Color(251, 246, 239, 255), 18);
    paintStroke(recCard, new Color(251, 246, 239, 255), new Color(229, 212, 195, 255), 18, 1);

    const recipe = ConfigManager.getAllRecipes().find(r => r.bottleId === bottle.id && r.result === 'success');
    const matchStr = recipe ? `合律：${recipe.match.replace('tags:', '')}` : '传承秘方';
    makeLabel(recCard, 'RecHead', '⚗ 调香配方', 200, 26, -160, 46, 18, Palette.woodDark);
    makeLabel(recCard, 'RecMatch', matchStr, 200, 22, 160, 46, 15, Palette.inkSoft);

    if (unlocked && recipe && recipe.inputs && recipe.inputs.length >= 2) {
      const n1 = ConfigManager.getNote(recipe.inputs[0]);
      const n2 = ConfigManager.getNote(recipe.inputs[1]);

      // 原料 1 药丸
      const p1 = makeNode(recCard, 'Pill1', 180, 56, -110, -12);
      paint(p1, Palette.paper, 12);
      paintStroke(p1, Palette.paper, CARD_STROKE, 12, 1);
      makeLabel(p1, 'Name', n1?.name || recipe.inputs[0], 170, 22, 0, 10, 16, Palette.ink);
      makeLabel(p1, 'Tags', (n1?.tags || []).join(' · '), 170, 18, 0, -12, 15, Palette.inkSoft);

      makeLabel(recCard, 'Plus', '+', 40, 30, 0, -12, 22, new Color(180, 83, 9, 255));

      // 原料 2 药丸
      const p2 = makeNode(recCard, 'Pill2', 180, 56, 110, -12);
      paint(p2, Palette.paper, 12);
      paintStroke(p2, Palette.paper, CARD_STROKE, 12, 1);
      makeLabel(p2, 'Name', n2?.name || recipe.inputs[1], 170, 22, 0, 10, 16, Palette.ink);
      makeLabel(p2, 'Tags', (n2?.tags || []).join(' · '), 170, 18, 0, -12, 15, Palette.inkSoft);
    } else {
      makeLabel(
        recCard,
        'LockedHint',
        `配方尚未探明 · 需集齐带有『${bottle.tags.join('』与『')}』香调特征的原料`,
        540,
        40,
        0,
        -12,
        15,
        Palette.inkSoft,
      );
    }

    // 标价与收录状态 (y=-280)
    makeLabel(dialog, 'Price', `出肆标价：${bottle.price} 金币`, 260, 26, -140, -280, 18, Palette.woodDark);
    makeLabel(
      dialog,
      'Status',
      unlocked ? '✔ 已录入香谱' : '尚未在调香台研制',
      260,
      26,
      140,
      -280,
      18,
      unlocked ? new Color(21, 128, 61, 255) : Palette.inkSoft,
    );

    // 底部大操作按钮：前往研制台调配此香 (y=-365, w=580, h=60)
    const craftBtn = makeButton(
      dialog,
      'BtnGoBench',
      '⚗ 前往研制台调配此香',
      580,
      60,
      0,
      -365,
      new Color(140, 89, 50, 255),
    );
    paintStroke(craftBtn.node, new Color(140, 89, 50, 255), new Color(175, 120, 75, 255), 18, 2);
    craftBtn.label.color = Palette.paper;
    bindClick(craftBtn.node, () => {
      AudioKit.play('ui_tap');
      root.destroy();
      director.loadScene('Bench');
    }, this);
  }

  /** 渲染【熟客随喜 · 评定好感】手札视图 (对应截图 2) */
  private renderGuestsTab(): void {
    const guests = ConfigManager.getAllGuests();
    const model = GameModel.instance;

    // 顶部说明卡片 (y=400, w=680, h=130)
    const headCard = makeNode(this._containerNode!, 'GuestHeaderCard', 680, 130, 0, 400);
    paint(headCard, IVORY_CARD, 20);
    paintStroke(headCard, IVORY_CARD, CARD_STROKE, 20, 1);

    makeLabel(headCard, 'HeadTitle', I18n.t('album_guest_head_title'), 280, 28, -170, 36, Type.sub, Palette.ink);

    const badge = makeNode(headCard, 'CtrlBadge', 180, 26, 210, 36);
    paint(badge, new Color(244, 232, 220, 255), 13);
    paintStroke(badge, new Color(244, 232, 220, 255), new Color(214, 193, 173, 255), 13, 1);
    makeLabel(badge, 'Text', '自由评定 · 控制频次', 170, 22, 0, 0, 15, Palette.woodDark);

    makeLabel(
      headCard,
      'HeadDesc',
      I18n.t('album_guest_head_desc'),
      640,
      56,
      0,
      -18,
      15,
      Palette.inkSoft,
    );

    // 熟客卡片列表滚动区 (y=-75, w=680, h=790)
    const cardW = 680;
    const cardH = 160;
    const gapY = 16;
    const padTop = 10;
    const padBottom = 24;
    const contentH = padTop + guests.length * (cardH + gapY) + padBottom;

    const { content } = this.buildScroll(this._containerNode!, 'GuestScroll', 680, 790, 0, -75, contentH);

    guests.forEach((guest, idx) => {
      const y = -(padTop + idx * (cardH + gapY) + cardH / 2);
      const card = makeNode(content, `GuestCard_${guest.id}`, cardW, cardH, 0, y);
      paint(card, IVORY_CARD, 20);
      paintStroke(card, IVORY_CARD, CARD_STROKE, 20, 1);

      // 左侧头像框 (w=90, h=120, x=-275)
      const avatarBox = makeNode(card, 'AvatarBox', 90, 120, -275, 0);
      paint(avatarBox, new Color(244, 232, 220, 220), 16);
      paintStroke(avatarBox, new Color(244, 232, 220, 220), new Color(216, 194, 170, 255), 16, 1);

      const avatar = makeNode(avatarBox, 'AvatarSprite', 82, 110, 0, 0);
      const avatarPath = (guest.avatar || `art/guests/${guest.id}.png`)
        .replace(/^art\//, '')
        .replace(/\.png$/, '');
      applySpriteOrFallback(avatar, avatarPath, 'ui/bottle_locked', Palette.woodDark, true);

      // 右侧信息：第一行 (客名 + 称谓标签 + 出现率标签)
      const rating = model.getGuestAffinity(guest.id);
      const title = model.getAffinityTitle(rating);

      const guestName = I18n.tGuest(guest.id).name || guest.name;
      makeLabel(card, 'Name', guestName, 160, 26, -140, 48, 18, Palette.ink);

      const titlePill = makeNode(card, 'TitlePill', 90, 24, -5, 48);
      paint(titlePill, new Color(246, 230, 214, 255), 12);
      paintStroke(titlePill, new Color(246, 230, 214, 255), new Color(221, 194, 171, 255), 12, 1);
      makeLabel(titlePill, 'TitleText', title, 84, 20, 0, 0, 15, new Color(147, 84, 39, 255));

      const boostPill = makeNode(card, 'BoostPill', 220, 24, 165, 48);
      paint(boostPill, new Color(255, 251, 235, 255), 6);
      paintStroke(boostPill, new Color(255, 251, 235, 255), new Color(253, 230, 138, 255), 6, 1);
      const bText = `常寻【${guest.requiredTag}】香 · 出现率 +${rating * 140}%`;
      makeLabel(
        boostPill,
        'BoostText',
        bText,
        210,
        20,
        0,
        0,
        15,
        new Color(147, 84, 39, 255),
      );

      // 第二行：顾客台词
      const gData = I18n.tGuest(guest.id);
      const dialog = ConfigManager.getRandomGuestDialogue(guest.id, guest.dialog);
      makeLabel(card, 'Dialog', `“${dialog}”`, 510, 36, 50, 4, 15, Palette.inkSoft);

      // 第三行：掌柜评级心意选择器
      makeLabel(card, 'RatingLabel', '掌柜评级：', 100, 24, -165, -46, 16, Palette.inkSoft);

      const heartBar = makeNode(card, 'HeartBar', 230, 34, 15, -46);
      paint(heartBar, new Color(247, 237, 226, 255), 17);
      paintStroke(heartBar, new Color(247, 237, 226, 255), new Color(230, 211, 192, 255), 17, 1);

      let hx = -80;
      for (let star = 1; star <= 5; star++) {
        const isFilled = star <= rating;
        const heartBtn = makeButton(
          heartBar,
          `Heart_${star}`,
          isFilled ? '♥' : '♡',
          32,
          30,
          hx,
          0,
          Palette.paper,
        );
        heartBtn.label.color = isFilled ? ROSE_HEART : GREY_HEART;

        bindClick(heartBtn.node, () => {
          AudioKit.play('ui_tap');
          const target = rating === star ? star - 1 : star;
          model.setGuestAffinity(guest.id, target);
          floatUp(this.node, `${guest.name} 知音心级：${target} 心（${model.getAffinityTitle(target)}）`, 0, 80, ROSE_HEART);
          this.renderGuestsTab();
        }, this);

        hx += 36;
      }

      makeLabel(heartBar, 'HeartCount', `${rating}心`, 40, 22, 88, 0, 16, new Color(180, 83, 9, 255));
    });
  }

  /** 竖向 ScrollView：root 为视口，view+Mask 裁剪，content 顶锚点向下排 */
  private buildScroll(
    parent: Node,
    name: string,
    w: number,
    h: number,
    x: number,
    y: number,
    contentH: number,
  ): { scroll: ScrollView; content: Node } {
    const root = makeNode(parent, name, w, h, x, y);
    const scroll = root.getComponent(ScrollView) || root.addComponent(ScrollView);
    scroll.horizontal = false;
    scroll.vertical = true;
    scroll.inertia = true;
    scroll.brake = 0.75;
    scroll.elastic = true;
    scroll.cancelInnerEvents = true;

    const view = makeNode(root, 'view', w, h, 0, 0);
    let mask = view.getComponent(Mask);
    if (!mask) mask = view.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;

    const content = makeNode(view, 'content', w, Math.max(h, contentH), 0, h / 2);
    const ct = ensureTransform(content, w, Math.max(h, contentH));
    ct.setAnchorPoint(0.5, 1);
    content.setPosition(0, h / 2, 0);

    scroll.content = content;
    return { scroll, content };
  }
}
