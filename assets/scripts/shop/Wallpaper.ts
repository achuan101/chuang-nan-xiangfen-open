import { Color, Node, UITransform, Component } from 'cc';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { applySprite, hexColor, paint } from '../ui/UiKit';

const FALLBACK_SPRITE = 'shop/bg';

class SnowEffect extends Component {
  private _speeds: number[] = [];

  start() {
    this._speeds = this.node.children.map((_, i) => 35 + (i % 5) * 15);
  }

  update(dt: number) {
    const children = this.node.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const pos = child.position;
      const speed = this._speeds[i] || 45;
      let newY = pos.y - speed * dt;
      if (newY < -640) newY = 640;
      child.setPosition(pos.x, newY);
    }
  }
}

function updateSnowLayer(bgNode: Node): void {
  const isSnow = GameModel.instance.wallpaperId === 'paper_snow';
  let snowNode = bgNode.getChildByName('SnowLayer');
  if (!isSnow) {
    if (snowNode) snowNode.active = false;
    return;
  }
  if (!snowNode) {
    snowNode = new Node('SnowLayer');
    bgNode.addChild(snowNode);
    snowNode.addComponent(UITransform).setContentSize(720, 1280);

    // 生成 18 颗微动雪花
    for (let i = 0; i < 18; i++) {
      const flake = new Node(`Flake_${i}`);
      const size = 3 + (i % 4) * 2;
      flake.addComponent(UITransform).setContentSize(size, size);
      paint(flake, Color.WHITE, size / 2);
      flake.setPosition(-320 + Math.random() * 640, -600 + Math.random() * 1200);
      snowNode.addChild(flake);
    }
    snowNode.addComponent(SnowEffect);
  }
  snowNode.active = true;
}

/**
 * 把当前窗纸应用到背景节点。
 * - 优先加载窗纸自带贴图（decor.json 的 sprite 字段），加载成功不再叠色。
 * - 贴图缺失时回退到默认底图，并用 tintHex 做乘色，保证换纸一定有视觉变化。
 */
export function applyWallpaperTo(bgNode: Node | null): void {
  if (!bgNode || !bgNode.isValid) return;

  const paper = ConfigManager.decor.wallpapers.find(w => w.id === GameModel.instance.wallpaperId);
  const tint = paper && paper.tintHex ? hexColor(paper.tintHex) : Color.WHITE;
  const spritePath = paper && paper.sprite ? paper.sprite : FALLBACK_SPRITE;

  updateSnowLayer(bgNode);

  if (spritePath === FALLBACK_SPRITE) {
    applySprite(bgNode, FALLBACK_SPRITE, sp => {
      sp.color = tint;
    });
    return;
  }

  applySprite(
    bgNode,
    spritePath,
    sp => {
      sp.color = Color.WHITE;
    },
    () => {
      applySprite(bgNode, FALLBACK_SPRITE, sp => {
        sp.color = tint;
      });
    },
  );
}
