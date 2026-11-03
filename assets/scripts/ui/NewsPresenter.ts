import { _decorator, Component, Label, Button, Node, Color } from 'cc';
import { NewsItem } from '../core/Types';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { AudioKit } from '../audio/AudioKit';
import { I18n } from '../core/I18n';
import { applySpriteFit, bindClick, labelHeightFor, makeButton, makeLabel, makeNode, paint, Palette, setLabel, Type } from './UiKit';
import { floatUp } from './Motion';

const { ccclass, property } = _decorator;

@ccclass('NewsPresenter')
export class NewsPresenter extends Component {
  @property(Node)
  public paperRootNode: Node | null = null;

  @property(Node)
  public illustrationNode: Node | null = null;

  @property(Label)
  public dayLabel: Label | null = null;

  @property(Label)
  public headlineLabel: Label | null = null;

  @property(Label)
  public summaryLabel: Label | null = null;

  @property(Label)
  public effectLabel: Label | null = null;

  @property(Label)
  public bonusLabel: Label | null = null;

  @property(Button)
  public confirmBtn: Button | null = null;

  private _onDismissCallback: (() => void) | null = null;

  public static attach(parent: Node): NewsPresenter {
    let node = parent.getChildByName('NewsModalRoot');
    if (!node) {
      node = makeNode(parent, 'NewsModalRoot', 720, 1280, 0, 0);
      paint(node, new Color(0, 0, 0, 180), 0);
      node.setSiblingIndex(99);

      const card = makeNode(node, 'PaperCard', 640, 800, 0, 0);
      paint(card, Palette.paper, 20);

      const dayLabel = makeLabel(card, 'NewsDay', '窗南晨报', 580, labelHeightFor(Type.head), 0, 340, Type.head, Palette.woodDark);
      const headline = makeLabel(card, 'NewsHeadline', '', 560, labelHeightFor(Type.card, 2), 0, 275, Type.card, Palette.ink);
      headline.isBold = true;

      // 插画底衬卡片
      const illusBox = makeNode(card, 'NewsIllustrationBox', 560, 220, 0, 125);
      paint(illusBox, Palette.cream, 8);

      // 插画图片承载节点（纯净 Node，不挂载 Graphics，避免 Cocos 3.8 UIRenderer 互斥）
      const illustration = makeNode(illusBox, 'NewsIllustration', 540, 205, 0, 0);

      const summary = makeLabel(card, 'NewsSummary', '', 560, labelHeightFor(Type.body, 3), 0, -60, Type.body, Palette.inkSoft);
      const effect = makeLabel(card, 'NewsEffect', '', 560, labelHeightFor(Type.sub, 2), 0, -175, Type.sub, Palette.mint);
      effect.isBold = true;

      // 晨光签到礼提示行
      const bonus = makeLabel(card, 'NewsBonus', '', 560, labelHeightFor(Type.sub), 0, -225, Type.sub, Palette.gold);
      bonus.isBold = true;

      const confirmBtn = makeButton(card, 'NewsConfirmBtn', '开启今日营业 ✨', 300, 56, 0, -285, Palette.wood);
      confirmBtn.label.fontSize = Type.card;
      confirmBtn.label.color = Palette.paper;

      const presenter = node.addComponent(NewsPresenter);
      presenter.paperRootNode = node;
      presenter.illustrationNode = illustration;
      presenter.dayLabel = dayLabel;
      presenter.headlineLabel = headline;
      presenter.summaryLabel = summary;
      presenter.effectLabel = effect;
      presenter.bonusLabel = bonus;
      presenter.confirmBtn = confirmBtn.button;

      bindClick(confirmBtn.node, () => presenter.dismiss(), presenter);
      card.on(Node.EventType.TOUCH_END, (e: any) => { e.propagationStopped = true; });
      bindClick(node, () => presenter.dismiss(), presenter);
      node.active = false;
      return presenter;
    }
    return node.getComponent(NewsPresenter)!;
  }

  public show(news: NewsItem, onDismiss?: () => void): void {
    this._onDismissCallback = onDismiss || null;

    if (this.paperRootNode) {
      this.paperRootNode.setSiblingIndex(99);
      this.paperRootNode.active = true;
    }

    if (this.dayLabel) {
      setLabel(this.dayLabel, I18n.t('news_header', { day: news.day }), Type.head);
    }
    if (this.headlineLabel) {
      setLabel(this.headlineLabel, news.headline, Type.card);
    }
    if (this.summaryLabel) {
      setLabel(this.summaryLabel, news.summary, Type.body);
    }
    if (this.effectLabel) {
      setLabel(this.effectLabel, `📊 ${I18n.t('news_trend')}：${news.marketEffect}`, Type.sub);
    }
    if (this.illustrationNode && news.illustration) {
      const cleanPath = news.illustration.replace(/^art\//i, '').replace(/\.png$/i, '');
      applySpriteFit(this.illustrationNode, cleanPath);
    }

    const model = GameModel.instance;
    const canSignin = model.lastSigninDate !== model.todayKey();
    if (this.bonusLabel) {
      if (canSignin) {
        setLabel(this.bonusLabel, I18n.t('news_bonus_available'), 15);
        this.bonusLabel.color = Palette.gold;
      } else {
        setLabel(this.bonusLabel, I18n.t('news_bonus_claimed'), 15);
        this.bonusLabel.color = Palette.inkSoft;
      }
    }
    if (this.confirmBtn) {
      const lab = this.confirmBtn.node.getChildByName('Label')?.getComponent(Label);
      if (lab) {
        setLabel(lab, canSignin ? I18n.t('news_btn_claim_open') : I18n.t('news_btn_open'), 15);
      }
    }
  }

  public isShowing(): boolean {
    return !!(this.paperRootNode && this.paperRootNode.active);
  }

  public checkAndShowCurrent(onDismiss?: () => void): boolean {
    const model = GameModel.instance;
    const day = model.currentBusinessDay || 1;
    const news = ConfigManager.getNewsByDay(day);
    if (!news || model.hasReadNews(day)) return false;
    this.show(news, () => {
      model.markNewsRead(day);
      if (onDismiss) onDismiss();
    });
    return true;
  }

  public dismiss(): void {
    const model = GameModel.instance;
    if (model.lastSigninDate !== model.todayKey()) {
      const res = model.trySignin();
      if (res.ok) {
        AudioKit.play('coin');
        floatUp(this.node.parent || this.node, res.msg, 0, 80, Palette.gold, 18);
      }
    }
    if (this.paperRootNode) {
      this.paperRootNode.active = false;
    }
    if (this._onDismissCallback) {
      const cb = this._onDismissCallback;
      this._onDismissCallback = null;
      cb();
    }
  }
}
