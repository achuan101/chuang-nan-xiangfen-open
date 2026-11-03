import { _decorator, Component, Label, Button, Node, director, Color } from 'cc';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { I18n } from '../core/I18n';
import { OrderSystem } from '../order/OrderSystem';
import { AudioKit } from '../audio/AudioKit';
import {
  applySpriteOrFallback,
  bindClick,
  labelHeightFor,
  makeButton,
  makeLabel,
  makeNode,
  paint,
  paintStroke,
  Palette,
  setLabel,
  Type,
} from '../ui/UiKit';
import { floatUp, popIn, shakeX } from '../ui/Motion';

const { ccclass, property } = _decorator;
const PANEL_STROKE = new Color(225, 210, 195, 255);
const ROSE_PILL = new Color(246, 230, 214, 255);
const ROSE_STROKE = new Color(221, 194, 171, 255);
const ROSE_TEXT = new Color(147, 84, 39, 255);
const GOLD_ORDER = new Color(180, 83, 9, 255);

@ccclass('GuestPresenter')
export class GuestPresenter extends Component {
  @property(Label)
  public nameLabel: Label | null = null;

  @property(Label)
  public dialogLabel: Label | null = null;

  @property(Label)
  public requirementLabel: Label | null = null;

  @property(Button)
  public submitBtn: Button | null = null;

  @property(Label)
  public submitBtnLabel: Label | null = null;

  @property(Button)
  public refreshBtn: Button | null = null;

  @property(Button)
  public gotoBenchBtn: Button | null = null;

  private _settling = false;
  private _isRefreshing = false;
  private _affinityBtn: Button | null = null;
  private _reviewLabel: Label | null = null;

  private _onChanged = () => {
    if (this._settling) return;
    this.checkCanSubmit();
  };
  private _onOrderChanged = () => {
    if (this._settling) return;
    this.refreshGuest();
  };

  public static attach(parent: Node): GuestPresenter {
    let node = parent.getChildByName('GuestArea');
    if (!node) {
      // 居中 Y = -105，高 280 (顶部 35，底部 -245)
      node = makeNode(parent, 'GuestArea', 660, 280, 0, -105);
      paintStroke(node, new Color(255, 251, 245, 245), PANEL_STROKE, 24, 1.5);
    }
    let presenter = node.getComponent(GuestPresenter);
    if (!presenter) presenter = node.addComponent(GuestPresenter);
    presenter.buildIfNeeded();
    presenter.refreshGuest();
    return presenter;
  }

  public buildIfNeeded(): void {
    paintStroke(this.node, new Color(255, 251, 245, 245), PANEL_STROKE, 24, 1.5);

    // 左侧头像框：纯净展示客人立绘，不遮盖任何角标与文字
    let avatarBox = this.node.getChildByName('AvatarBox');
    if (!avatarBox) {
      avatarBox = makeNode(this.node, 'AvatarBox', 96, 114, -225, 42);
      paintStroke(avatarBox, Palette.paper, PANEL_STROKE, 16, 1.2);
      const avatar = makeNode(avatarBox, 'GuestAvatar', 90, 108, 0, 0);
      applySpriteOrFallback(avatar, 'guests/guest_tea', 'ui/bottle_locked', Palette.woodDark);
    }
    const oldBadge = avatarBox.getChildByName('MoodBadge');
    if (oldBadge && oldBadge.isValid) oldBadge.destroy();

    // 客人姓名
    const nameNode = this.node.getChildByName('GuestName');
    if (nameNode) {
      this.nameLabel = nameNode.getComponent(Label);
    } else {
      this.nameLabel = makeLabel(this.node, 'GuestName', '客人', 220, labelHeightFor(20), -45, 92, 20, Palette.ink);
      this.nameLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
      this.nameLabel.isBold = true;
    }

    // 好感徽章 (点击跳转图鉴)
    if (!this._affinityBtn) {
      const affText = '♥ ' + GameModel.instance.getAffinityTitle(0);
      const affBtn = makeButton(this.node, 'BtnAffinityBadge', affText, 116, 28, 165, 92, ROSE_PILL);
      paintStroke(affBtn.node, ROSE_PILL, ROSE_STROKE, 13, 1);
      affBtn.label.color = ROSE_TEXT;
      setLabel(affBtn.label, affText, 14);
      bindClick(affBtn.node, () => {
        AudioKit.play('ui_tap');
        director.loadScene('Album');
      }, this);
      this._affinityBtn = affBtn.button;
    }

    // 客人台词（点击可聆听客人更多心声）
    const dialogNode = this.node.getChildByName('GuestDialog');
    if (dialogNode) {
      this.dialogLabel = dialogNode.getComponent(Label);
    } else {
      this.dialogLabel = makeLabel(this.node, 'GuestDialog', '', 440, 52, 70, 46, 19, new Color(92, 64, 40, 255));
      this.dialogLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    }
    if (this.dialogLabel) {
      bindClick(this.dialogLabel.node, () => this.onDialogClick(), this);
    }

    // 需求与赏钱行
    const reqNode = this.node.getChildByName('GuestRequirement');
    if (reqNode) {
      this.requirementLabel = reqNode.getComponent(Label);
    } else {
      this.requirementLabel = makeLabel(this.node, 'GuestRequirement', '', 440, 28, 70, 3, 19, Palette.ink);
      this.requirementLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    }

    // 铺面短评行
    const revNode = this.node.getChildByName('GuestReview');
    if (revNode) {
      this._reviewLabel = revNode.getComponent(Label);
    } else {
      this._reviewLabel = makeLabel(this.node, 'GuestReview', '', 440, 22, 70, -24, 15, new Color(140, 109, 82, 255));
      this._reviewLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    }

    // 分隔线
    let sep = this.node.getChildByName('Separator');
    if (!sep) {
      sep = makeNode(this.node, 'Separator', 600, 1, 0, -44);
      paint(sep, new Color(235, 220, 203, 255), 0);
    }

    // 操作按钮：交付订单
    if (!this.submitBtn) {
      const btn = makeButton(this.node, 'BtnSubmitOrder', '货架尚缺对应香调', 370, 48, -85, -82, Palette.disabled);
      this.submitBtn = btn.button;
      this.submitBtnLabel = btn.label;
      bindClick(btn.node, () => this.onSubmitClick(), this);
    }

    // 操作按钮：换一位客人
    if (!this.refreshBtn) {
      const refText = GameModel.instance.guestRefreshButtonLabel();
      const rBtn = makeButton(this.node, 'BtnRefreshGuest', refText, 180, 48, 205, -82, new Color(140, 107, 78, 255));
      paintStroke(rBtn.node, new Color(140, 107, 78, 255), new Color(115, 84, 59, 255), 14, 1);
      rBtn.label.color = Palette.paper;
      setLabel(rBtn.label, refText, 15);
      this.refreshBtn = rBtn.button;
      bindClick(rBtn.node, () => this.onRefreshGuestClick(), this);
    }

    // 缺香调时备用：去工台调配
    if (!this.gotoBenchBtn) {
      const gBtn = makeButton(this.node, 'BtnGotoBench', '去工台调配', 370, 48, -85, -82, Palette.disabled);
      this.gotoBenchBtn = gBtn.button;
      gBtn.node.active = false;
      bindClick(gBtn.node, () => this.onGotoBenchClick(), this);
    }
  }

  start() {
    this.buildIfNeeded();
    this.refreshGuest();
    GameModel.instance.on('shelf_changed', this._onChanged);
    GameModel.instance.on('inventory_changed', this._onChanged);
    GameModel.instance.on('bottle_claimed', this._onChanged);
    GameModel.instance.on('order_changed', this._onOrderChanged);
  }

  onDestroy() {
    GameModel.instance.off('shelf_changed', this._onChanged);
    GameModel.instance.off('inventory_changed', this._onChanged);
    GameModel.instance.off('bottle_claimed', this._onChanged);
    GameModel.instance.off('order_changed', this._onOrderChanged);
    this.clearSettleCard();
    this._settling = false;
    this._isRefreshing = false;
  }

  public refreshGuest(): void {
    if (this._settling) return;
    const model = GameModel.instance;
    const order = model.currentOrder;

    if (!order) {
      if (this.nameLabel) setLabel(this.nameLabel, '店里闲适', 20);
      if (this.dialogLabel) setLabel(this.dialogLabel, I18n.t('atmosphere_no_guest'), 18);
      if (this.requirementLabel) setLabel(this.requirementLabel, '', 19);
      if (this._reviewLabel) setLabel(this._reviewLabel, '', 15);
      if (this._affinityBtn) this._affinityBtn.node.active = false;
      if (this.submitBtn) this.submitBtn.interactable = false;
      if (this.gotoBenchBtn) this.gotoBenchBtn.node.active = false;
      return;
    }

    const guest = ConfigManager.getGuest(order.guestId);
    if (guest) {
      const affinity = model.getGuestAffinity(guest.id);
      const affinityTitle = model.getAffinityTitle(affinity);

      if (this.nameLabel) {
        setLabel(this.nameLabel, I18n.tGuest(guest.id).name || guest.name, 20);
      }

      if (this._affinityBtn) {
        this._affinityBtn.node.active = true;
        const lab = this._affinityBtn.node.getChildByName('Label')?.getComponent(Label);
        if (lab) setLabel(lab, `♥ ${affinityTitle}`, 14);
      }

      const dialog = ConfigManager.getRandomGuestDialogue(guest.id, guest.dialog);
      if (this.dialogLabel) {
        setLabel(this.dialogLabel, `“${dialog}”`, 19);
        this.dialogLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
      }

      if (this.requirementLabel) {
        const reqStr = `想要：【${order.requiredTag}】      赏钱：${order.rewardCoin} 金币`;
        setLabel(this.requirementLabel, reqStr, 19);
        this.requirementLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
      }

      if (this._reviewLabel) {
        const shortReview = ConfigManager.getRandomGuestShortReview(guest.id);
        const cleanRev = shortReview.replace(/^.*?留评：/, '').replace(/^['\u2018\u201C]/, '').replace(/['\u2019\u201D]$/, '');
        const revStr = `铺面短评：${cleanRev}`;
        setLabel(this._reviewLabel, revStr, 15);
        this._reviewLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
      }

      const avatarBox = this.node.getChildByName('AvatarBox');
      const avatar = avatarBox ? avatarBox.getChildByName('GuestAvatar') : null;
      if (avatar) {
        const avatarPath = (guest.avatar || `art/guests/${guest.id}.png`)
          .replace(/^art\//, '')
          .replace(/\.png$/, '');
        applySpriteOrFallback(avatar, avatarPath, 'ui/bottle_locked', Palette.woodDark);
      }
      if (avatarBox) {
        const oldBadge = avatarBox.getChildByName('MoodBadge');
        if (oldBadge && oldBadge.isValid) oldBadge.destroy();
      }
    }

    if (this.refreshBtn) {
      this.refreshBtn.node.active = GameModel.instance.tutorialCompleted;
      const rLabel = this.refreshBtn.node.getChildByName('Label')?.getComponent(Label);
      if (rLabel) {
        setLabel(rLabel, model.guestRefreshButtonLabel(), 15);
      }
    }

    this.checkCanSubmit();
  }

  public onDialogClick(): void {
    if (this._settling) return;
    const model = GameModel.instance;
    const order = model.currentOrder;
    if (!order) return;
    const guest = ConfigManager.getGuest(order.guestId);
    if (!guest || !this.dialogLabel) return;
    AudioKit.play('ui_tap');
    const newLine = ConfigManager.getRandomGuestDialogue(guest.id, guest.dialog);
    setLabel(this.dialogLabel, `“${newLine}”`, 19);
  }

  public onRefreshGuestClick(): void {
    if (this._settling || this._isRefreshing) return;
    this._isRefreshing = true;
    this.scheduleOnce(() => {
      this._isRefreshing = false;
    }, 0.35);

    const res = GameModel.instance.refreshGuestOrder();
    AudioKit.play('ui_tap');
    if (!res.ok) {
      if (this.dialogLabel) setLabel(this.dialogLabel, res.msg || '金币不足');
      if (this.refreshBtn) shakeX(this.refreshBtn.node);
    }
  }

  public onGotoBenchClick(): void {
    AudioKit.play('ui_tap');
    director.loadScene('Bench');
  }

  public checkCanSubmit(): void {
    if (this._settling) return;
    const model = GameModel.instance;
    const order = model.currentOrder;
    if (!order || !this.submitBtn) return;

    const matchingBottle = OrderSystem.findMatchingBottle(order.requiredTag);
    if (matchingBottle) {
      this.submitBtn.node.active = true;
      this.submitBtn.interactable = true;
      paintStroke(this.submitBtn.node, new Color(185, 132, 83, 255), new Color(166, 113, 64, 255), 14, 1.5);
      if (this.submitBtnLabel) {
        const bName = I18n.tBottle(matchingBottle.bottle.id).name;
        const deliverText = `✨ 交付【${bName}】(+${order.rewardCoin}金币)`;
        setLabel(this.submitBtnLabel, deliverText, 16);
        this.submitBtnLabel.color = Palette.paper;
        this.submitBtnLabel.isBold = true;
      }
      if (this.gotoBenchBtn) this.gotoBenchBtn.node.active = false;
      this.updateGuestExpression('happy');
    } else {
      this.submitBtn.interactable = false;
      paint(this.submitBtn.node, new Color(235, 220, 203, 255), 14);
      if (this.submitBtnLabel) {
        setLabel(this.submitBtnLabel, '货架尚缺对应香调', 16);
        this.submitBtnLabel.color = new Color(156, 129, 106, 255);
        this.submitBtnLabel.isBold = false;
      }
      if (this.gotoBenchBtn) {
        this.gotoBenchBtn.node.active = false;
      }
      this.updateGuestExpression('normal');
    }
  }

  public onSubmitClick(): void {
    if (this._settling) return;
    const model = GameModel.instance;
    const wasTutorial = !model.tutorialCompleted;
    const order = model.currentOrder;
    const missingHint = order
      ? `这位客人想要【${order.requiredTag}】香调（请先调和/上架）`
      : '暂无客人';

    this._settling = true;
    const guest = order ? ConfigManager.getGuest(order.guestId) : null;
    const guestName = guest ? (I18n.tGuest(guest.id).name || guest.name) : '客人';
    const result = OrderSystem.deliver();
    if (!result.ok) {
      this._settling = false;
      if (this.dialogLabel) setLabel(this.dialogLabel, result.reason || missingHint);
      shakeX(this.node);
      this.updateGuestExpression('anxious');
      return;
    }

    AudioKit.play('deliver');
    AudioKit.play('coin');

    const feedback = order
      ? ConfigManager.getRandomGuestFeedback(
          order.guestId,
          '太好闻了，正是这种温润感觉。多谢掌柜的。',
        )
      : '太好闻了，正是这种温润感觉。多谢掌柜的。';
    if (this.dialogLabel) {
      setLabel(this.dialogLabel, `“${feedback}”`);
    }

    this.flashCoinGain(result.coin);
    floatUp(this.node, `+♥${result.rep}`, -230, 110, Palette.woodDark);
    floatUp(this.node, `“${feedback}”`, 0, 150, Palette.mint, 20);

    if (this.requirementLabel) setLabel(this.requirementLabel, '');
    if (this._reviewLabel) setLabel(this._reviewLabel, '');

    if (wasTutorial) {
      this._settling = false;
      this.refreshGuest();
      return;
    }

    if (this.submitBtn) this.submitBtn.node.active = false;
    if (this.refreshBtn) this.refreshBtn.node.active = false;
    if (this.gotoBenchBtn) this.gotoBenchBtn.node.active = false;

    this.clearSettleCard();
    const card = makeNode(this.node, 'SettleCard', 620, 120, 0, -80);
    paintStroke(card, Palette.paper, Palette.gold, 16, 2);

    makeLabel(card, 'SettleTitle', `「${result.bottleName}」→ ${guestName}`, 580, labelHeightFor(Type.card), 0, 32, Type.card, Palette.ink);
    const affTitle = typeof result.affinity === 'number' ? model.getAffinityTitle(result.affinity) : '知心常客';
    const rewStr = `+${result.coin} 金币 · 好评 +${result.rep} · 好感提升至「${affTitle}」`;
    makeLabel(card, 'SettleReward', rewStr, 580, labelHeightFor(Type.body), 0, 4, Type.body, Palette.woodDark);
    const nextText = '下一位客人';
    const takeBtn = makeButton(card, 'BtnTake', nextText, 200, 42, 0, -34, Palette.wood);
    popIn(card);

    let closed = false;
    const closeOverlay = () => {
      if (closed) return;
      closed = true;
      this.clearSettleCard();
      if (this.submitBtn) this.submitBtn.node.active = true;
      if (this.refreshBtn) this.refreshBtn.node.active = true;
      this._settling = false;
      this.refreshGuest();
    };

    bindClick(takeBtn.node, () => closeOverlay(), this);
  }

  private clearSettleCard(): void {
    const leftover = this.node.getChildByName('SettleCard');
    if (leftover && leftover.isValid) leftover.destroy();
  }

  private flashCoinGain(coin: number): void {
    floatUp(this.node, `+${coin} 金币`, 0, 150, Palette.gold);
  }

  public updateGuestExpression(_state: 'normal' | 'happy' | 'anxious' | 'blush'): void {
    // 保持头像框纯净立绘质感，不遮盖任何文字或角标
  }
}
