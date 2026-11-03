import { _decorator, Color, Component, Graphics, Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { DESIGN_H, DESIGN_W, ensureTransform, hexColor, makeNode, paint } from './UiKit';

const { ccclass } = _decorator;

/**
 * 窗光层：丁达尔光柱 + 浮尘/花粉漂移 + 换灯换纸的一秒淡入。
 * 主包 4MB 上限里塞不进新的序列帧，增量的“会动的氛围”只能由 Graphics + 引擎 tween 拼出来：
 * 全部动画交给引擎插值，脚本只在切换装饰时跑一次，没有每帧 JS。
 */

/** 定种子 LCG：无头校验与真机给出同一批尘埃位置，越界判定才可复现 */
function makeRng(seed: number): () => number {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SHAFT_BASE = new Color(255, 236, 190, 255);

function currentLightTint(): Color | null {
  const light = ConfigManager.decor.lights?.find(l => l.id === GameModel.instance.lightId);
  return light && light.tintHex ? hexColor(light.tintHex) : null;
}

function mix(base: Color, tint: Color | null): Color {
  if (!tint) return base;
  return new Color(
    Math.round((base.r * 3 + tint.r) / 4),
    Math.round((base.g * 3 + tint.g) / 4),
    Math.round((base.b * 3 + tint.b) / 4),
    255,
  );
}

function drawShaft(g: Graphics, topX: number, topHalf: number, bottomHalf: number, drift: number, color: Color): void {
  const top = DESIGN_H / 2;
  const bottom = -DESIGN_H / 2;
  g.fillColor = color;
  g.moveTo(topX - topHalf, top);
  g.lineTo(topX + topHalf, top);
  g.lineTo(topX + drift + bottomHalf, bottom);
  g.lineTo(topX + drift - bottomHalf, bottom);
  g.close();
  g.fill();
}

@ccclass('AmbientLight')
export class AmbientLight extends Component {
  private _shaftOp: UIOpacity | null = null;
  private _onDecor = () => this.paintShaft();

  start() {
    this.buildShaft();
    this.buildMotes('DustFX', 9, 3, 8, 11.5, new Color(255, 248, 238, 130), 300, 500, 1200);
    this.buildMotes('PollenFX', 4, 4.5, 3.2, 4, new Color(255, 224, 150, 170), 290, 470, 700);
    GameModel.instance.on('decor_changed', this._onDecor);
  }

  onDestroy() {
    GameModel.instance.off('decor_changed', this._onDecor);
  }

  private buildShaft(): void {
    // 禁用粗重黄色对角光柱，保持背景通透干净
  }

  private paintShaft(): void {
    const node = this.node.getChildByName('LightShaft');
    if (!node) return;
    const g = node.getComponent(Graphics);
    if (!g) return;
    g.clear();
  }

  /** 一颗颗小圆点各自沿固定方向来回漂，周期与相位都不同，才不会看成一排 */
  private buildMotes(
    name: string,
    count: number,
    radius: number,
    minSeconds: number,
    maxSeconds: number,
    color: Color,
    maxAbsX: number,
    maxAbsY: number,
    seed: number,
  ): void {
    const host = makeNode(this.node, name, DESIGN_W, DESIGN_H, 0, 0);
    host.setSiblingIndex(1);
    if (host.getChildByName('Mote_0')) return;
    const rng = makeRng(seed);
    for (let i = 0; i < count; i++) {
      const x = (rng() * 2 - 1) * maxAbsX;
      const y = (rng() * 2 - 1) * maxAbsY;
      const dot = makeNode(host, `Mote_${i}`, radius * 2 + 4, radius * 2 + 4, x, y);
      let g = dot.getComponent(Graphics);
      if (!g) g = dot.addComponent(Graphics);
      g.clear();
      g.fillColor = color;
      g.circle(0, 0, radius);
      g.fill();
      const dx = (rng() * 2 - 1) * 46;
      const dy = 30 + rng() * 54;
      const secs = minSeconds + rng() * (maxSeconds - minSeconds);
      const path = tween(dot)
        .by(secs, { position: new Vec3(dx, dy, 0) }, { easing: 'sineInOut' })
        .by(secs, { position: new Vec3(-dx, -dy, 0) }, { easing: 'sineInOut' });
      tween(dot).delay(rng() * secs).repeatForever(path).start();
    }
  }
}

/** 挂到画布上；重复调用只复用同一层，引导/刷新反复 buildUi 也不会叠尘 */
export function attachAmbientLight(canvas: Node): void {
  const host = makeNode(canvas, 'AmbientFX', DESIGN_W, DESIGN_H, 0, 0);
  host.setSiblingIndex(3);
  if (!host.getComponent(AmbientLight)) host.addComponent(AmbientLight);
}

/**
 * 灯光带 / 地毯这类整块叠色的换色过渡。
 * 直接 paint 是硬切，付了金币却只看见“闪一下”；先铺新色再从 0 淡到 255，一秒读完。
 */
export function fadeTintBand(node: Node, hex: string | null, seconds: number = 1): void {
  let op = node.getComponent(UIOpacity);
  const first = !op;
  if (!op) op = node.addComponent(UIOpacity);
  const target = hex ? 255 : 0;
  if (hex) paint(node, hexColor(hex), 0);
  node.active = true;
  if (first) op.opacity = 0;
  if (op.opacity === target) return;
  Tween.stopAllByTarget(op);
  tween(op).to(seconds, { opacity: target }).start();
}
