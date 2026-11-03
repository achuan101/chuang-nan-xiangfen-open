import { _decorator, Button, Color, Component, Label, Node } from 'cc';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { I18n } from '../core/I18n';
import { AudioKit } from '../audio/AudioKit';
import {
  applySprite,
  applySpriteFit,
  applySpriteOrFallback,
  bindClick,
  bindPressFeedback,
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
import { popIn, squash } from '../ui/Motion';

const { ccclass, property } = _decorator;
const PANEL_STROKE = new Color(225, 210, 195, 255);
const FROST_WHITE = new Color(255, 255, 255, 205);
const FROST_WHITE_FILL = new Color(255, 255, 255, 240);
const FROST_BORDER = new Color(255, 255, 255, 235);

@ccclass('Shelf')
export class Shelf extends Component {
  @property([Node])
  public slotNodes: Node[] = [];

  private _pickerNode: Node | null = null;
  private _targetSlotIndex: number = -1;
  private _onChanged = () => this.refreshShelf();
  private _toastMsg = '';
  private _resetToast = () => {
    const tipNode = this.node.parent ? this.node.parent.getChildByName('TipLabel') : null;
    const lab = tipNode ? tipNode.getComponent(Label) : null;
    if (lab && this._toastMsg && lab.string === this._toastMsg) setLabel(lab, '');
    this._toastMsg = '';
  };

  public static attach(parent: Node): Shelf {
    let node = parent.getChildByName('ShelfArea');
    if (!node) {
      // 居中 Y = 160，高 190 (顶部 255，底部 65)
      node = makeNode(parent, 'ShelfArea', 680, 190, 0, 160);
    }
    let shelf = node.getComponent(Shelf);
    if (!shelf) shelf = node.addComponent(Shelf);
    return shelf;
  }

  start() {
    this.rebuildSlots();
    this.refreshShelf();
    GameModel.instance.on('shelf_changed', this._onChanged);
  }

  onDestroy() {
    GameModel.instance.off('shelf_changed', this._onChanged);
    this.hidePicker();
  }

  public rebuildSlots(): void {
    const model = GameModel.instance;
    const count = model.shelfSlotCount;
    this.slotNodes = [];

    const cols = 4;
    const slotW = 150;
    const slotH = 170;
    const gapX = 14;
    const startX = -((cols * slotW + (cols - 1) * gapX) / 2) + slotW / 2;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const x = startX + col * (slotW + gapX);
      const y = 0;
      const slot = makeNode(this.node, `Slot_${i}`, slotW, slotH, x, y);
      paintStroke(slot, FROST_WHITE, FROST_BORDER, 18, 1.5);

      let slotBtn = slot.getComponent(Button);
      if (!slotBtn) slotBtn = slot.addComponent(Button);
      slotBtn.transition = Button.Transition.NONE;
      bindPressFeedback(slot, slotBtn);

      const icon = makeNode(slot, 'Icon', 54, 70, 0, 24);
      icon.active = false;

      makeLabel(slot, 'SlotLabel', I18n.t('shelf_slot_empty', { n: i + 1 }), slotW - 12, 40, 0, -48, Type.badge, new Color(140, 115, 94, 255));
      bindClick(slot, () => this.onSlotClick(null, String(i)), this);
      this.slotNodes.push(slot);
    }

    for (const child of [...this.node.children]) {
      if (child.name.indexOf('Slot_') === 0) {
        const idx = parseInt(child.name.replace('Slot_', ''), 10);
        if (idx >= count) child.active = false;
      }
    }
  }

  private bottleArtPath(bottleId: string): string {
    const bottle = ConfigManager.getBottle(bottleId);
    const raw = bottle && bottle.sprite ? bottle.sprite : `art/bottles/${bottleId}.png`;
    return raw.replace(/^art\//, '').replace(/\.png$/i, '');
  }

  public refreshShelf(): void {
    if (this.slotNodes.length !== GameModel.instance.shelfSlotCount) {
      this.rebuildSlots();
    }
    const shelf = GameModel.instance.shelfBottles;
    for (let i = 0; i < this.slotNodes.length; i++) {
      const slotNode = this.slotNodes[i];
      if (!slotNode) continue;

      let icon = slotNode.getChildByName('Icon');
      if (!icon) icon = makeNode(slotNode, 'Icon', 54, 70, 0, 24);

      let labelNode = slotNode.getChildByName('SlotLabel');
      if (!labelNode) {
        makeLabel(slotNode, 'SlotLabel', '', 138, 40, 0, -48, Type.badge, new Color(140, 115, 94, 255));
        labelNode = slotNode.getChildByName('SlotLabel');
      }
      const label = labelNode ? labelNode.getComponent(Label) : null;

      icon.setSiblingIndex(0);
      if (labelNode) labelNode.setSiblingIndex(slotNode.children.length - 1);

      const bottleId = shelf[i];
      if (bottleId) {
        const bottle = ConfigManager.getBottle(bottleId);
        icon.active = true;
        icon.setPosition(0, 24);
        applySpriteOrFallback(icon, this.bottleArtPath(bottleId), 'ui/bottle_locked', Palette.panel, true);
        if (label && labelNode) {
          const bName = I18n.tBottle(bottleId).name;
          const slotStr = I18n.t('shelf_slot_take_back', { name: bName });
          setLabel(label, slotStr, Type.badge);
          labelNode.setPosition(0, -48);
          label.color = new Color(61, 43, 31, 255);
        }
        const plus = slotNode.getChildByName('SlotPlus');
        if (plus) plus.active = false;
        paintStroke(slotNode, FROST_WHITE_FILL, PANEL_STROKE, 18, 1.5);
      } else {
        icon.active = true;
        icon.setPosition(0, 20);
        applySpriteFit(
          icon,
          'ui/slot_empty',
          sp => {
            sp.color = Color.WHITE;
          },
          () => {
            icon!.active = false;
          },
        );
        if (label && labelNode) {
          const emptyStr = I18n.t('shelf_slot_empty', { n: i + 1 });
          setLabel(label, emptyStr, Type.badge);
          labelNode.setPosition(0, -48);
          label.color = new Color(140, 115, 94, 255);
        }
        let plus = slotNode.getChildByName('SlotPlus');
        if (!plus) {
          plus = makeNode(slotNode, 'SlotPlus', 40, 40, 0, 20);
          const plusLab = makeLabel(plus, 'Plus', '+', 40, 40, 0, 0, 28, new Color(171, 142, 116, 255));
          plus.setSiblingIndex(slotNode.children.length - 1);
        }
        plus.active = true;
        paintStroke(slotNode, FROST_WHITE, FROST_BORDER, 18, 1.5);
      }
    }
  }

  public onSlotClick(_event: any, customEventData: string): void {
    const slotIdx = parseInt(customEventData, 10);
    if (isNaN(slotIdx)) return;
    const model = GameModel.instance;
    const bottleId = model.shelfBottles[slotIdx];

    if (!bottleId) {
      this.showPicker(slotIdx);
    } else {
      const bName = I18n.tBottle(bottleId).name;
      model.removeBottleFromShelf(slotIdx);
      const toast = `已将【${bName}】取回行囊`;
      this.showToast(toast);
    }
  }

  public showPicker(slotIdx: number): void {
    const model = GameModel.instance;
    this._targetSlotIndex = slotIdx;

    const available = model.bottlesInventory
      .map((id, idx) => ({ id, idx }))
      .filter(item => item.id !== 'practice_bottle');

    if (this._pickerNode) {
      this._pickerNode.destroy();
      this._pickerNode = null;
    }
    const oldBlur = this.node.getChildByName('ShelfPickerBlur');
    if (oldBlur && oldBlur.isValid) oldBlur.destroy();

    if (available.length === 0) {
      const emptyToast = '行囊中暂无可上架的成品香水，去工台研制吧';
      this.showToast(emptyToast);
      return;
    }

    const uniqueMap = new Map<string, number[]>();
    available.forEach(item => {
      const list = uniqueMap.get(item.id) || [];
      list.push(item.idx);
      uniqueMap.set(item.id, list);
    });

    const entries = Array.from(uniqueMap.entries());
    const rows = Math.ceil(Math.min(entries.length, 8) / 4);
    const pickerH = rows > 1 ? 300 : 240;

    const blur = makeNode(this.node, 'ShelfPickerBlur', 720, 520, 0, 0);
    applySprite(
      blur,
      'shop/bg_blurred',
      sp => {
        sp.color = new Color(255, 255, 255, 220);
      },
      () => {
        paint(blur, new Color(40, 36, 32, 180), 0);
      },
    );

    this._pickerNode = makeNode(this.node, 'ShelfPicker', 640, pickerH, 0, 0);
    paintStroke(this._pickerNode, Palette.panel, PANEL_STROKE, 20, 2);
    popIn(this._pickerNode);

    const pickerTitle = `请选择要上架到空位 ${slotIdx + 1} 的香氛`;

    makeLabel(
      this._pickerNode,
      'PickerTitle',
      pickerTitle,
      440,
      labelHeightFor(Type.body),
      -70,
      pickerH / 2 - 36,
      Type.body,
      Palette.ink,
    );

    const closeBtn = makeButton(this._pickerNode, 'BtnClosePicker', I18n.t('action_close'), 76, 34, 255, pickerH / 2 - 36, Palette.paper);
    paintStroke(closeBtn.node, Palette.paper, PANEL_STROKE, 10, 1);
    closeBtn.label.color = Palette.inkSoft;
    bindClick(closeBtn.node, () => this.hidePicker(), this);

    const btnW = 140;
    const btnH = 70;
    const shown = entries.slice(0, 8);
    shown.forEach(([bId, indices], i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const colsInRow = row === 0 ? Math.min(4, shown.length) : shown.length - 4;
      const startX = -(colsInRow * btnW + (colsInRow - 1) * 12) / 2 + btnW / 2;
      const y = rows > 1 ? (row === 0 ? 20 : -70) : -15;
      const name = I18n.tBottle(bId).name;

      const bBtn = makeButton(
        this._pickerNode!,
        `Pick_${bId}`,
        `${name}\n×${indices.length}`,
        btnW,
        btnH,
        startX + col * (btnW + 12),
        y,
        Palette.paper,
      );
      paintStroke(bBtn.node, Palette.paper, Palette.gold, 12, 1.5);
      bBtn.label.color = Palette.ink;

      bindClick(bBtn.node, () => {
        const invIdx = model.bottlesInventory.indexOf(bId);
        if (invIdx < 0) {
          const notInBag = `【${name}】已不在行囊`;
          this.showToast(notInBag);
          this.hidePicker();
          return;
        }
        const ok = model.placeBottleOnShelf(invIdx, this._targetSlotIndex);
        if (ok) {
          AudioKit.play('shelf');
          const placedToast = `已将【${name}】摆上货架`;
          this.showToast(placedToast);
          const dropped = this.slotNodes[this._targetSlotIndex];
          if (dropped && dropped.isValid) squash(dropped);
        }
        this.hidePicker();
      }, this);
    });
  }

  public hidePicker(): void {
    const blur = this.node.getChildByName('ShelfPickerBlur');
    if (blur && blur.isValid) blur.destroy();
    if (this._pickerNode) {
      this._pickerNode.destroy();
      this._pickerNode = null;
    }
  }

  private showToast(msg: string): void {
    const shopNode = this.node.parent;
    if (shopNode) {
      const tipNode = shopNode.getChildByName('TipLabel');
      if (tipNode) {
        const lab = tipNode.getComponent(Label);
        if (lab) {
          this._toastMsg = msg;
          setLabel(lab, msg);
          this.unschedule(this._resetToast);
          this.scheduleOnce(this._resetToast, 2);
        }
      }
    }
  }
}
