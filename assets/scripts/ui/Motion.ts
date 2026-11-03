import { Label, Node, UIOpacity, Vec3, Tween, tween } from 'cc';
import { labelHeightFor, makeLabel, Palette } from './UiKit';

/**
 * 动效层：只有代码，不带任何新资源 —— 微信小游戏主包 4MB 上限下，这是最划算的视觉增量。
 * 全部走引擎 tween，不在节点上另起计时器。
 */

/** 面板出现：淡入 + 从下方 dy 弹到位。只在「从无到有」时调一次，别跟着每秒刷新反复播 */
export function popIn(node: Node, dy: number = 18): void {
  let op = node.getComponent(UIOpacity);
  if (!op) op = node.addComponent(UIOpacity);
  const p = node.getPosition();
  op.opacity = 0;
  node.setPosition(p.x, p.y - dy, p.z);
  tween(op).to(0.16, { opacity: 255 }, { easing: 'quadOut' }).start();
  tween(node)
    .to(0.22, { position: new Vec3(p.x, p.y, p.z) }, { easing: 'backOut' })
    .start();
}

let _floatSeq = 0;

/** 飘字：+金币 / +香调 这类短反馈，上升 64px 后淡出并自毁 */
export function floatUp(
  parent: Node,
  text: string,
  x: number,
  y: number,
  color = Palette.gold,
  fontSize = 24,
): void {
  _floatSeq += 1;
  const lab = makeLabel(parent, `Float_${_floatSeq}`, text, 280, labelHeightFor(fontSize), x, y, fontSize, color, true);
  const node = lab.node;
  const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
  op.opacity = 255;
  tween(node)
    .by(0.9, { position: new Vec3(0, 64, 0) }, { easing: 'quadOut' })
    .call(() => {
      if (node.isValid) node.destroy();
    })
    .start();
  tween(op).delay(0.45).to(0.45, { opacity: 0 }).start();
}

interface RollState {
  proxy: { progress: number };
  shown: number;
}

const _rolls = new WeakMap<Label, RollState>();

/** 数字滚动：金币 / 行动点变化时从当前显示值滑到新值，差值不到 2 就直接落位 */
export function rollNumber(lab: Label, to: number, render: (v: number) => void, seconds: number = 0.3): void {
  const prev = _rolls.get(lab);
  const from = prev ? prev.shown : to;
  if (prev) Tween.stopAllByTarget(prev.proxy);
  if (from === to) {
    render(to);
    _rolls.set(lab, { proxy: prev ? prev.proxy : { progress: 1 }, shown: to });
    return;
  }
  const state: RollState = { proxy: { progress: 0 }, shown: from };
  _rolls.set(lab, state);
  tween(state.proxy)
    .to(seconds, { progress: 1 }, {
      onUpdate: () => {
        state.shown = Math.round(from + (to - from) * state.proxy.progress);
        render(state.shown);
      },
      onComplete: () => {
        state.shown = to;
        render(to);
      },
    })
    .start();
}

/** 采摘手感：压扁 → 弹长 → 归位，约 0.5s */
export function squash(node: Node): void {
  Tween.stopAllByTarget(node);
  node.setScale(1, 1, 1);
  tween(node)
    .to(0.12, { scale: new Vec3(1.18, 0.82, 1) }, { easing: 'quadIn' })
    .to(0.18, { scale: new Vec3(0.9, 1.12, 1) }, { easing: 'quadOut' })
    .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
    .start();
}

/** 横向抖动：交付失败、金币不足这类否定反馈 */
export function shakeX(node: Node, amp: number = 10): void {
  const p = node.getPosition();
  Tween.stopAllByTarget(node);
  tween(node)
    .to(0.06, { position: new Vec3(p.x - amp, p.y, p.z) })
    .to(0.08, { position: new Vec3(p.x + amp, p.y, p.z) })
    .to(0.08, { position: new Vec3(p.x - amp / 2, p.y, p.z) })
    .to(0.06, { position: new Vec3(p.x, p.y, p.z) })
    .start();
}
