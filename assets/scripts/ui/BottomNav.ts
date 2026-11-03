import { _decorator, Component, director, Node, Color, Label } from 'cc';
import { GameModel } from '../core/GameModel';
import { AudioKit } from '../audio/AudioKit';
import { I18n } from '../core/I18n';
import { bindClick, makeButton, makeNode, paint, paintStroke, Palette, setLabel, NAV_Y } from './UiKit';

const { ccclass } = _decorator;

export type NavTabId = 'shop' | 'bench' | 'window' | 'album';

interface TabConfig {
  id: NavTabId;
  scene: string;
}

const TABS: TabConfig[] = [
  { id: 'shop', scene: 'Shop' },
  { id: 'bench', scene: 'Bench' },
  { id: 'window', scene: 'Window' },
  { id: 'album', scene: 'Album' },
];

const GOLD_ACTIVE = new Color(230, 180, 75, 255);
const GOLD_STROKE = new Color(252, 231, 173, 255);
const INK_ACTIVE = new Color(74, 46, 18, 255);
const INACTIVE_BG = new Color(140, 107, 78, 220);
const INACTIVE_STROKE = new Color(173, 140, 111, 160);
const INACTIVE_TEXT = new Color(246, 238, 227, 255);
const RED_DOT = new Color(239, 68, 68, 255);
const WHITE_STROKE = new Color(255, 255, 255, 255);

@ccclass('BottomNav')
export class BottomNav extends Component {
  private _currentTab: NavTabId = 'shop';

  public static attach(parent: Node, currentTab: NavTabId): BottomNav {
    let node = parent.getChildByName('BottomNav');
    if (!node) {
      // 居中 Y = -560，宽 660，高 68，透明容器承载 4 枚独立悬浮卡片
      node = makeNode(parent, 'BottomNav', 660, 68, 0, NAV_Y);
    }
    let nav = node.getComponent(BottomNav);
    if (!nav) nav = node.addComponent(BottomNav);
    nav.setup(currentTab);
    return nav;
  }

  public setup(tab: NavTabId): void {
    this._currentTab = tab;
    this.buildTabs();
  }

  start() {}

  onDestroy() {}

  private buildTabs(): void {
    this.node.removeAllChildren();
    const model = GameModel.instance;
    const now = Date.now();

    const isCuringReady =
      !!model.activeCuring && (now - model.activeCuring.startTime) / 1000 >= model.activeCuring.durationSeconds;
    const hasReadyPot = model.pots.some(p => (now - p.plantTime) / 1000 >= p.growDuration);

    const tabW = 154;
    const tabH = 58;
    const gap = 12;
    const totalW = TABS.length * tabW + (TABS.length - 1) * gap;
    const startX = -totalW / 2 + tabW / 2;

    TABS.forEach((t, i) => {
      const x = startX + i * (tabW + gap);
      const isActive = t.id === this._currentTab;
      const labelText = I18n.t(`tab_${t.id}`);

      const btn = makeButton(
        this.node,
        `NavTab_${t.id}`,
        labelText,
        tabW,
        tabH,
        x,
        0,
        isActive ? GOLD_ACTIVE : INACTIVE_BG,
      );

      if (isActive) {
        paintStroke(btn.node, GOLD_ACTIVE, GOLD_STROKE, 16, 1.5);
        btn.label.color = INK_ACTIVE;
        btn.label.isBold = true;
        setLabel(btn.label, labelText, 18);
      } else {
        paintStroke(btn.node, INACTIVE_BG, INACTIVE_STROKE, 16, 1.2);
        btn.label.color = INACTIVE_TEXT;
        btn.label.isBold = true;
        setLabel(btn.label, labelText, 17);
      }

      // 右上角浮动提示小红点（当前所处界面不重复打红点，非当前界面有待办时提醒）
      const showBadge = !isActive && ((t.id === 'bench' && isCuringReady) || (t.id === 'window' && hasReadyPot));
      if (showBadge) {
        const dot = makeNode(btn.node, 'BadgeDot', 12, 12, tabW / 2 - 8, tabH / 2 - 6);
        paintStroke(dot, RED_DOT, WHITE_STROKE, 6, 1.5);
      }

      bindClick(btn.node, () => {
        AudioKit.play('ui_tap');
        if (t.id === this._currentTab) return;
        director.loadScene(t.scene);
      }, this);
    });
  }
}

