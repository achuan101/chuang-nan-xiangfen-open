import { _decorator, Component, Label, Node, Color, director } from 'cc';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { I18n } from '../core/I18n';
import { bindClick, HUD_Y, makeButton, makeLabel, makeNode, paintStroke, Palette, setLabel, Type } from './UiKit';
import { rollNumber } from './Motion';

const { ccclass, property } = _decorator;

const PANEL_STROKE = new Color(225, 210, 195, 255);
const BLUE_ACCENT = new Color(37, 99, 235, 255);
const GOLD_ACCENT = new Color(180, 83, 9, 255);

@ccclass('ActionBar')
export class ActionBar extends Component {
  @property(Label)
  public apLabel: Label | null = null;

  @property(Label)
  public coinLabel: Label | null = null;

  private _timer: number = 0;
  private _speedupLabel: Label | null = null;
  private _muteLabel: Label | null = null;
  private _onCoins = () => this.refreshCoins();
  private _onAp = () => this.refreshAP();
  private _onSpeedup = () => this.refreshSpeedups();
  private _onMuted = () => this.refreshMuteBtn();

  public static attach(parent: Node): ActionBar {
    let node = parent.getChildByName('TopActionBar');
    if (!node) {
      node = makeNode(parent, 'TopActionBar', 660, 52, 0, HUD_Y);
      paintStroke(node, new Color(255, 252, 247, 255), PANEL_STROKE, 22, 1.2);
    }
    let bar = node.getComponent(ActionBar);
    if (!bar) bar = node.addComponent(ActionBar);
    bar.buildIfNeeded();
    return bar;
  }

  public buildIfNeeded(): void {
    paintStroke(this.node, new Color(255, 252, 247, 255), PANEL_STROKE, 22, 1.2);

    // 行动点
    if (!this.apLabel) {
      this.apLabel = makeLabel(this.node, 'APLabel', `${I18n.t('hud_ap')} 20/20`, 180, 40, -185, 0, 15, Palette.ink);
      this.apLabel.isBold = true;
    }

    // 分割线 1
    if (!this.node.getChildByName('Div1')) {
      const d1 = makeLabel(this.node, 'Div1', '|', 20, 30, -80, 0, 14, new Color(220, 205, 190, 255));
    }

    // 金币
    if (!this.coinLabel) {
      this.coinLabel = makeLabel(this.node, 'CoinLabel', `${I18n.t('hud_coin')} 0`, 150, 40, 28, 0, 15, GOLD_ACCENT);
      this.coinLabel.isBold = true;
    }

    // 分割线 2
    if (!this.node.getChildByName('Div2')) {
      const d2 = makeLabel(this.node, 'Div2', '|', 20, 30, 130, 0, 14, new Color(220, 205, 190, 255));
    }

    // 加速卡
    if (!this.node.getChildByName('SpeedupLabel')) {
      const lab = makeLabel(this.node, 'SpeedupLabel', `${I18n.t('hud_speedup')} 0`, 150, 40, 222, 0, 15, BLUE_ACCENT);
      lab.isBold = true;
      this._speedupLabel = lab;
    }

    // 右上角音效切换按钮 (Y = 160，即屏幕绝对 Y = 560 标题栏右侧，避让微信胶囊安全区)
    if (!this.node.getChildByName('BtnMute')) {
      const mute = makeButton(this.node, 'BtnMute', '♪', 40, 40, 240, 160, Palette.paper);
      paintStroke(mute.node, Palette.paper, PANEL_STROKE, 20, 1.2);
      mute.label.color = Palette.ink;
      setLabel(mute.label, '♪', 18);
      bindClick(mute.node, () => this.onMuteClick(), this);
      this._muteLabel = mute.label;
    } else if (!this._muteLabel) {
      const n = this.node.getChildByName('BtnMute');
      const lab = n ? n.getChildByName('Label') : null;
      this._muteLabel = lab ? lab.getComponent(Label) : null;
      if (n) bindClick(n, () => this.onMuteClick(), this);
    }
  }

  start() {
    this.buildIfNeeded();
    const speedNode = this.node.getChildByName('SpeedupLabel');
    this._speedupLabel = speedNode ? speedNode.getComponent(Label) : null;
    this.refreshView();
    GameModel.instance.on('coins_changed', this._onCoins);
    GameModel.instance.on('ap_changed', this._onAp);
    GameModel.instance.on('speedup_changed', this._onSpeedup);
    GameModel.instance.on('muted_changed', this._onMuted);
    this.refreshMuteBtn();
  }

  onDestroy() {
    GameModel.instance.off('coins_changed', this._onCoins);
    GameModel.instance.off('ap_changed', this._onAp);
    GameModel.instance.off('speedup_changed', this._onSpeedup);
    GameModel.instance.off('muted_changed', this._onMuted);
  }

  update(dt: number) {
    this._timer += dt;
    if (this._timer >= 1.0) {
      this._timer = 0;
      GameModel.instance.checkApRecovery();
      this.refreshAP();
    }
  }

  public refreshView(): void {
    this.refreshCoins();
    this.refreshAP();
    this.refreshSpeedups();
    this.refreshMuteBtn();
  }

  public refreshSpeedups(): void {
    if (!this._speedupLabel) {
      const speedNode = this.node.getChildByName('SpeedupLabel');
      this._speedupLabel = speedNode ? speedNode.getComponent(Label) : null;
    }
    if (this._speedupLabel) {
      setLabel(this._speedupLabel, `${I18n.t('hud_speedup')} ${GameModel.instance.speedups}`, 15);
      this._speedupLabel.color = BLUE_ACCENT;
    }
  }

  public refreshCoins(): void {
    if (!this.coinLabel) return;
    const lab = this.coinLabel;
    rollNumber(lab, GameModel.instance.coins, v => {
      setLabel(lab, `${I18n.t('hud_coin')} ${v}`, 15);
      lab.color = GOLD_ACCENT;
    });
  }

  public refreshAP(): void {
    if (!this.apLabel) return;
    const lab = this.apLabel;
    const model = GameModel.instance;
    const eco = ConfigManager.economy;
    const points = model.apManager.points;

    let suffix = '';
    if (points < eco.maxActionPoints) {
      const remainSec = model.apManager.getSecondsToNextPoint();
      const min = Math.floor(remainSec / 60);
      const sec = remainSec % 60;
      suffix = ` (${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')})`;
    }
    rollNumber(lab, points, v => {
      setLabel(lab, `${I18n.t('hud_ap')} ${v}/${eco.maxActionPoints}${suffix}`, 15);
      lab.color = Palette.ink;
    });
  }

  private refreshMuteBtn(): void {
    const n = this.node.getChildByName('BtnMute');
    if (!this._muteLabel) {
      const lab = n ? n.getChildByName('Label') : null;
      this._muteLabel = lab ? lab.getComponent(Label) : null;
    }
    const muted = GameModel.instance.muted;
    if (this._muteLabel) {
      setLabel(this._muteLabel, muted ? '✕' : '♪', 18);
    }
    if (n) {
      paintStroke(n, Palette.paper, muted ? Palette.disabled : PANEL_STROKE, 20, 1.2);
      if (this._muteLabel) this._muteLabel.color = muted ? Palette.disabledText : Palette.ink;
    }
  }

  public onMuteClick(): void {
    GameModel.instance.toggleMuted();
    this.refreshMuteBtn();
  }
}
