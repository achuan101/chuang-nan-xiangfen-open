import { _decorator, Component, director, Label, Button, Node, Color } from 'cc';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { I18n } from '../core/I18n';
import { InterstitialAd } from '../ads/InterstitialAd';
import { adEntryVisible, isWeChatRuntime, RewardedAd } from '../ads/RewardedAd';
import { Shelf } from './Shelf';
import { GuestPresenter } from './GuestPresenter';
import { ActionBar } from '../ui/ActionBar';
import { Tutorial } from '../ui/Tutorial';
import { BottomNav } from '../ui/BottomNav';
import { Share } from '../share/Share';
import { AudioKit } from '../audio/AudioKit';
import { applyWallpaperTo } from './Wallpaper';
import { NewsPresenter } from '../ui/NewsPresenter';
import { ComicPanelModal } from '../ui/ComicPanelModal';
import {
  bindClick,
  ensureCanvas,
  makeButton,
  makeLabel,
  makeNode,
  makeSceneTitle,
  paint,
  paintStroke,
  Palette,
  ensureArtBundle,
  setLabel,
  Type,
  labelHeightFor,
} from '../ui/UiKit';
import { attachAmbientLight } from '../ui/AmbientLight';
import { floatUp } from '../ui/Motion';

const { ccclass, property } = _decorator;
const PANEL_STROKE = new Color(225, 210, 195, 255);

@ccclass('ShopView')
export class ShopView extends Component {
  @property(Shelf)
  public shelf: Shelf | null = null;

  @property(GuestPresenter)
  public guestPresenter: GuestPresenter | null = null;

  @property(Label)
  public tipLabel: Label | null = null;

  private _bgNode: Node | null = null;
  private _decorBtn: Button | null = null;
  private _recycleBtn: Button | null = null;
  private _atmosphereLabel: Label | null = null;
  private _shelfBannerLabel: Label | null = null;
  private _newsPresenter: NewsPresenter | null = null;
  private _comicPanelModal: ComicPanelModal | null = null;
  private _onTutorial = () => this.refreshNavLock();
  private _onInventory = () => {
    this.refreshRecycleBtn();
    this.refreshAtmosphereTip();
  };
  private _onDecor = () => this.applyWallpaper();
  private _onAtmosphere = () => this.refreshAtmosphereTip();

  start() {
    GameModel.instance.initialize();
    RewardedAd.init();
    InterstitialAd.init();
    Share.initWeChatShareMenu();
    ensureCanvas(this.node);
    ensureArtBundle(() => {
      if (!this.node || !this.node.isValid) return;
      AudioKit.init();
      this.buildUi();
      if (GameModel.instance.tutorialStep === 'go_shop') {
        GameModel.instance.advanceTutorial('deliver');
      }
      this.playPrologueThenNews();
      GameModel.instance.on('inventory_changed', this._onInventory);
      GameModel.instance.on('decor_changed', this._onDecor);
      GameModel.instance.on('shelf_changed', this._onAtmosphere);
      GameModel.instance.on('order_changed', this._onAtmosphere);
      GameModel.instance.on('tutorial_changed', this._onAtmosphere);
    });
  }

  onDestroy() {
    GameModel.instance.off('tutorial_changed', this._onTutorial);
    GameModel.instance.off('inventory_changed', this._onInventory);
    GameModel.instance.off('decor_changed', this._onDecor);
    GameModel.instance.off('shelf_changed', this._onAtmosphere);
    GameModel.instance.off('order_changed', this._onAtmosphere);
    GameModel.instance.off('tutorial_changed', this._onAtmosphere);
  }

  private refreshNavLock(): void {
    // 不锁功能入口
  }

  private playPrologueThenNews(): void {
    const model = GameModel.instance;
    const showNews = () => {
      if (model.tutorialCompleted) {
        this._newsPresenter?.checkAndShowCurrent();
      }
    };
    const panels = ConfigManager.getProloguePanels();
    if (!model.prologueShown && this._comicPanelModal && panels.length > 0) {
      if (Tutorial.instance) {
        Tutorial.instance.hideAll();
      }
      this._comicPanelModal.showPanels(panels, () => {
        model.markPrologueShown();
        if (Tutorial.instance) {
          Tutorial.instance.onPrologueFinished();
        }
        showNews();
      });
    } else {
      showNews();
      if (Tutorial.instance) {
        Tutorial.instance.refresh();
      }
    }
  }

  public buildUi(): void {
    this._bgNode = makeNode(this.node, 'BG', 720, 1280, 0, 0);


    this.applyWallpaper();
    attachAmbientLight(this.node);

    // 顶部标题芯片
    makeSceneTitle(this.node, 'ShopTitle', I18n.t('scene_shop'));

    // 顶部左侧「装潢」入口药丸芯片 (x=-260, y=560)
    const decorChip = makeButton(this.node, 'BtnDecor', '🏮 ' + I18n.t('tab_decor'), 98, 36, -260, 560, Palette.paper);
    paintStroke(decorChip.node, Palette.paper, PANEL_STROKE, 18, 1);
    decorChip.label.color = Palette.ink;
    setLabel(decorChip.label, '🏮 ' + I18n.t('tab_decor'), 13);
    bindClick(decorChip.node, () => this.onOpenDecorClick(), this);
    this._decorBtn = decorChip.button;

    // 顶部右侧「今日晨报」圆形芯片 (x=230, y=560)
    const newsBtn = makeButton(this.node, 'BtnNews', '📰', 38, 38, 230, 560, Palette.paper);
    paintStroke(newsBtn.node, Palette.paper, PANEL_STROKE, 19, 1);
    newsBtn.label.color = Palette.ink;
    setLabel(newsBtn.label, '📰', 16);
    bindClick(newsBtn.node, () => {
      const day = GameModel.instance.currentBusinessDay || 1;
      const n = ConfigManager.getNewsByDay(day);
      if (n && this._newsPresenter) this._newsPresenter.show(n);
    }, this);

    ActionBar.attach(this.node);

    // 货架区域标题行容器 (Y = 285)
    const shelfHeader = makeNode(this.node, 'ShelfHeaderRow', 660, 36, 0, 285);

    // 左侧药丸徽章：今日货架
    const shelfTitleNode = makeNode(shelfHeader, 'ShelfTitle', 110, 32, -265, 0);
    paintStroke(shelfTitleNode, Palette.paper, PANEL_STROKE, 16, 1);
    const shelfTitleText = I18n.t('shelf_title');
    makeLabel(shelfTitleNode, 'Text', shelfTitleText, 100, 28, 0, 0, Type.badge, Palette.ink);

    // 回收练习瓶按钮 (如果有练习瓶时显示)
    const recycle = makeButton(shelfHeader, 'BtnRecyclePractice', I18n.t('action_clear'), 160, 32, 245, 0, Palette.paper);
    paintStroke(recycle.node, Palette.paper, Palette.gold, 14, 1.2);
    recycle.label.color = Palette.wood;
    setLabel(recycle.label, I18n.t('action_clear'), 14);
    recycle.node.active = false;
    this._recycleBtn = recycle.button;
    bindClick(recycle.node, () => this.onRecycleClick(), this);

    // 货架主体 ShelfArea (居中 Y = 160)
    this.shelf = Shelf.attach(this.node);

    // 客人区域 GuestArea (居中 Y = -105)
    this.guestPresenter = GuestPresenter.attach(this.node);

    // 底部提示 TipLabel (Y = -290)
    if (!this.tipLabel) {
      this.tipLabel = makeLabel(this.node, 'TipLabel', '', 680, 32, 0, -290, Type.body, Palette.inkSoft);
    }

    // 氛围漫谈短句 AtmosphereHint (Y = -350)
    if (!this._atmosphereLabel) {
      this._atmosphereLabel = makeLabel(this.node, 'AtmosphereHint', '', 680, 48, 0, -350, Type.sub, Palette.inkSoft);
    }

    // 底部四标签导航栏
    BottomNav.attach(this.node, 'shop');

    this._newsPresenter = NewsPresenter.attach(this.node);
    this._comicPanelModal = ComicPanelModal.attach(this.node);
    Tutorial.attach(this.node, 'shop');

    this.refreshNavLock();
    this.refreshRecycleBtn();
    this.refreshAtmosphereTip();
    GameModel.instance.on('tutorial_changed', this._onTutorial);
  }

  private refreshAtmosphereTip(): void {
    if (!this._atmosphereLabel) return;
    const model = GameModel.instance;
    if (!model.tutorialCompleted) {
      this._atmosphereLabel.string = '';
      return;
    }
    const shelfEmpty = model.shelfBottles.every(id => !id);
    const successInv = model.bottlesInventory.filter(id => id !== 'practice_bottle');
    if (!model.currentOrder) {
      setLabel(this._atmosphereLabel, I18n.t('atmosphere_no_guest'));
    } else if (shelfEmpty && successInv.length === 0) {
      setLabel(this._atmosphereLabel, I18n.t('atmosphere_shelf_empty_no_inv'));
    } else if (shelfEmpty) {
      setLabel(this._atmosphereLabel, I18n.t('atmosphere_shelf_empty'));
    } else {
      setLabel(this._atmosphereLabel, I18n.t('atmosphere_welcome'));
    }
  }

  private refreshRecycleBtn(): void {
    if (!this._recycleBtn) return;
    const count = GameModel.instance.practiceBottleCount;
    const banner = this.node.getChildByName('ShelfHeaderRow')?.getChildByName('ShelfAtmosphereBanner');
    if (count > 0) {
      this._recycleBtn.node.active = true;
      if (banner) banner.active = false;
      const lab = this._recycleBtn.node.getChildByName('Label')?.getComponent(Label);
      if (lab) setLabel(lab, I18n.t('clear_practice_hint', { n: count }), 12);
    } else {
      this._recycleBtn.node.active = false;
      if (banner) banner.active = true;
    }
  }

  public onRecycleClick(): void {
    const res = GameModel.instance.sellPracticeBottle();
    if (res.ok) {
      AudioKit.play('coin');
      const tip = `回收 ${res.count} 只练习瓶，获得 ${res.coin} 金币`;
      this.showTip(tip, 2);
      this.refreshRecycleBtn();
    } else {
      AudioKit.play('ui_tap');
    }
  }

  public onAdForApClick(): void {
    GameModel.instance.tryWatchAdForActionPoints((ok, msg) => this.showAdResult(ok, msg));
  }

  private showAdResult(ok: boolean, msg: string): void {
    AudioKit.play(ok ? 'coin' : 'ui_tap');
    this.showTip(msg, 2);
  }

  private showTip(msg: string, seconds: number = 2): void {
    floatUp(this.node, msg, 0, -80, Palette.gold, 18);
  }

  public onOpenBenchClick(): void {
    if (GameModel.instance.tutorialStep === 'go_bench') {
      GameModel.instance.advanceTutorial('blend');
    }
    AudioKit.play('ui_tap');
    director.loadScene('Bench');
  }

  public onOpenWindowClick(): void {
    if (GameModel.instance.tutorialStep === 'go_window') {
      GameModel.instance.advanceTutorial('harvest');
    }
    AudioKit.play('ui_tap');
    director.loadScene('Window');
  }

  public onOpenAlbumClick(): void {
    AudioKit.play('ui_tap');
    director.loadScene('Album');
  }

  public onOpenDecorClick(): void {
    AudioKit.play('ui_tap');
    director.loadScene('Decor');
  }

  public applyWallpaper(): void {
    applyWallpaperTo(this._bgNode);
  }
}
