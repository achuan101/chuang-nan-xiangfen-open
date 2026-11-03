// 仅 tests/layoutCheck 用：替代 Cocos 引擎模块，让 5 个 View 能在 node 下真挂载。
// 与 tests/cc-stub.ts 的区别是这里维护完整节点树，并且 Label 自带一套
// 「引擎会怎么缩字号」的排版模型 —— 文案变长导致的静默缩小只有挂载后才暴露。
// 生产代码不引用本文件；tests/build-check.mjs 用 esbuild alias 把 'cc' 指到这里。
import * as fs from 'node:fs';
import * as path from 'node:path';

export class Color {
  public r: number;
  public g: number;
  public b: number;
  public a: number;
  constructor(r = 255, g = 255, b = 255, a = 255) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
  public clone(): Color {
    return new Color(this.r, this.g, this.b, this.a);
  }
}

// ---------------------------------------------------------------- PNG 尺寸

function readPngSize(file: string): { width: number; height: number } | null {
  try {
    const buf = fs.readFileSync(file);
    if (buf.length >= 24 && buf.readUInt32BE(12) === 0x49484452) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let offset = 2;
      while (offset < buf.length - 8) {
        if (buf[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buf[offset + 1];
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buf.readUInt16BE(offset + 5);
          const width = buf.readUInt16BE(offset + 7);
          return { width, height };
        }
        const len = buf.readUInt16BE(offset + 2);
        offset += 2 + len;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function artRoot(): string | null {
  for (const cand of [
    path.resolve(process.cwd(), 'assets', 'art'),
    path.resolve(__dirname, '..', '..', 'assets', 'art'),
  ]) {
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

const ART_ROOT = artRoot();

export class SpriteFrame {
  public originalSize = { width: 0, height: 0 };
  public rect = { width: 0, height: 0 };
  static fromTexture() {
    return new SpriteFrame();
  }
}

export class AudioClip {}

export class AudioSource {
  // isValid 恒为 false：AudioKit 的 play / applyBgmState 都先查它，音频路径自然短路。
  public isValid = false;
  public playing = false;
  public playOnAwake = false;
  public loop = false;
  public volume = 0;
  public clip: AudioClip | null = null;
  public play(): void {}
  public stop(): void {}
  public playOneShot(_clip: AudioClip, _gain?: number): void {}
}

// ---------------------------------------------------------------- 节点树

export class Node {
  static EventType = {
    TOUCH_START: 'touch-start',
    TOUCH_MOVE: 'touch-move',
    TOUCH_END: 'touch-end',
    TOUCH_CANCEL: 'touch-cancel',
    MOUSE_DOWN: 'mouse-down',
    MOUSE_UP: 'mouse-up',
    SIZE_CHANGED: 'size-changed',
    CHILD_ADDED: 'child-added',
    CHILD_REMOVED: 'child-removed',
  };

  public name: string;
  public parent: Node | null = null;
  public children: Node[] = [];
  public active = true;
  public layer = 1 << 30;
  public isValid = true;
  public x = 0;
  public y = 0;
  public z = 0;
  public angle = 0;
  public scaleXY = 1;
  private _comps: Map<Function, any> = new Map();
  private _handlers: Map<string, Array<{ cb: (...a: any[]) => void; target: any }>> = new Map();

  constructor(name = '') {
    this.name = name;
  }

  public setPosition(x: number, y?: number, z?: number): void {
    this.x = x;
    this.y = y === undefined ? this.y : y;
    this.z = z === undefined ? this.z : z;
  }

  public getPosition(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y, z: this.z };
  }

  public setScale(x: number, y?: number): void {
    this.scaleXY = x;
  }

  public getScale(): { x: number; y: number; z: number } {
    return { x: this.scaleXY, y: this.scaleXY, z: 1 };
  }

  public addChild(child: Node): void {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.push(child);
  }

  public removeChild(child: Node): void {
    const i = this.children.indexOf(child);
    if (i >= 0) {
      this.children.splice(i, 1);
      child.parent = null;
    }
  }

  public removeFromParent(): void {
    if (this.parent) this.parent.removeChild(this);
  }

  public removeAllChildren(): void {
    for (const c of this.children) c.parent = null;
    this.children.length = 0;
  }

  public destroy(): void {
    this.isValid = false;
    this.removeFromParent();
    for (const c of this.children) c.destroy();
    this._comps.forEach(comp => {
      if (typeof comp.onDestroy === 'function') comp.onDestroy();
    });
    this._comps.clear();
    this._handlers.clear();
  }

  public getChildByName(name: string): Node | null {
    for (const c of this.children) {
      if (c.name === name) return c;
    }
    return null;
  }

  public getComponent<T>(cls: new (...args: any[]) => T): T | null {
    return (this._comps.get(cls) as T) ?? null;
  }

  /** layoutCheck 用它遍历节点上的组件来泵 update */
  public allComponents(): any[] {
    return Array.from(this._comps.values());
  }

  public addComponent<T>(cls: new (...args: any[]) => T): T {
    const existing = this._comps.get(cls);
    if (existing) return existing;
    const comp: any = new cls();
    comp.node = this;
    this._comps.set(cls, comp);
    // 引擎在下一帧调 start()，这里同步调，好让 Shelf / Pot 这类
    // 「addComponent 之后才建 UI」的组件在无头环境里也走完流程。
    if (typeof comp.start === 'function') comp.start();
    return comp;
  }

  public removeComponent(comp: any): void {
    for (const [cls, c] of this._comps) {
      if (c === comp) {
        this._comps.delete(cls);
        if (typeof comp.onDestroy === 'function') comp.onDestroy();
        return;
      }
    }
  }

  public setSiblingIndex(index: number): void {
    if (!this.parent) return;
    const list = this.parent.children;
    const i = list.indexOf(this);
    if (i < 0) return;
    list.splice(i, 1);
    list.splice(Math.max(0, Math.min(index, list.length)), 0, this);
  }

  public on(evt: string, cb: (...a: any[]) => void, target?: any): void {
    const list = this._handlers.get(evt) || [];
    list.push({ cb, target: target ?? null });
    this._handlers.set(evt, list);
  }

  public off(evt: string, cb?: (...a: any[]) => void): void {
    if (!cb) {
      this._handlers.delete(evt);
      return;
    }
    const list = this._handlers.get(evt);
    if (!list) return;
    const kept = list.filter(h => h.cb !== cb);
    if (kept.length) this._handlers.set(evt, kept);
    else this._handlers.delete(evt);
  }

  public emit(evt: string, ...args: any[]): void {
    const list = this._handlers.get(evt);
    if (!list) return;
    for (const h of [...list]) h.cb.apply(h.target, args);
  }

  /** 相对画布中心的坐标（引擎的世界坐标，设计空间 y 向上为正） */
  public centerPos(): { x: number; y: number } {
    let n: Node | null = this;
    let x = 0;
    let y = 0;
    while (n) {
      x += n.x;
      y += n.y;
      n = n.parent;
    }
    // ensureCanvas 把画布摆到 (360, 640)，减掉即得设计空间中心坐标
    return { x: x - DESIGN_W / 2, y: y - DESIGN_H / 2 };
  }
}

export const DESIGN_W = 720;
export const DESIGN_H = 1280;

// ---------------------------------------------------------------- tween

export class Vec3 {
  public x: number;
  public y: number;
  public z: number;
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

function applyProps(target: any, props: any, additive: boolean): void {
  if (!target || !props) return;
  for (const key of Object.keys(props)) {
    const v = props[key];
    if (key === 'position' && v instanceof Vec3 && typeof target.setPosition === 'function') {
      if (additive) target.setPosition(target.x + v.x, target.y + v.y, target.z + v.z);
      else target.setPosition(v.x, v.y, v.z);
    } else if (key === 'scale' && v instanceof Vec3 && typeof target.setScale === 'function') {
      if (additive) target.setScale(target.scaleXY + v.x, target.scaleXY + v.y);
      else target.setScale(v.x, v.y);
    } else if (typeof v === 'number') {
      target[key] = additive ? (target[key] || 0) + v : v;
    } else {
      target[key] = v;
    }
  }
}

/**
 * 无头 tween：一条链在编写时就把「动画结束态」写进目标。
 * 布局校验关心的是停下来的样子（面板别停在 opacity 0、别停在偏移位置），
 * 所以 to/by 立即落位，delay/sequence/easing 只是结构占位，repeatForever 不落位（循环动效没有终点）。
 */
class StubTween {
  constructor(private target: any) {}

  public to(_dur: number, props: any, opts?: any): StubTween {
    applyProps(this.target, props, false);
    if (opts && typeof opts.onUpdate === 'function') opts.onUpdate(this.target, 1, true);
    if (opts && typeof opts.onComplete === 'function') opts.onComplete();
    return this;
  }

  public by(_dur: number, props: any, opts?: any): StubTween {
    applyProps(this.target, props, true);
    if (opts && typeof opts.onUpdate === 'function') opts.onUpdate(this.target, 1, true);
    if (opts && typeof opts.onComplete === 'function') opts.onComplete();
    return this;
  }

  public delay(_dur: number): StubTween {
    return this;
  }

  public call(fn: () => void): StubTween {
    fn();
    return this;
  }

  public sequence(...steps: any[]): StubTween {
    void steps;
    return this;
  }

  public union(_t: any): StubTween {
    return this;
  }

  public repeatForever(step?: any): StubTween {
    void step;
    return this;
  }

  public repeat(_times: number, step?: any): StubTween {
    void step;
    return this;
  }

  public start(): StubTween {
    return this;
  }

  public stop(): StubTween {
    return this;
  }
}

export function tween(target: any): StubTween {
  return new StubTween(target);
}

export class Tween {
  static stopAllByTarget(_target: any): void {}
  static stopAll(): void {}
}

// ---------------------------------------------------------------- 组件

export class Component {
  public node: Node = null as any;
  public enabled = true;
  /** scheduleOnce 的回调记在这里但不执行：布局校验看的是文案落位后的盒况 */
  public static pendingTimers: Array<{ fn: () => void; delay: number }> = [];

  get isValid(): boolean {
    return !!this.node && this.node.isValid;
  }

  public getComponent<T>(cls: new (...args: any[]) => T): T | null {
    return this.node ? this.node.getComponent(cls) : null;
  }

  public addComponent<T>(cls: new (...args: any[]) => T): T {
    return this.node.addComponent(cls);
  }

  public schedule(_fn: () => void, _interval?: number): void {}

  public unschedule(fn: () => void): void {
    Component.pendingTimers = Component.pendingTimers.filter(t => t.fn !== fn);
  }

  public scheduleOnce(fn: () => void, delay?: number): void {
    Component.pendingTimers.push({ fn, delay: delay || 0 });
  }

  public start?(): void;
  public update?(dt: number): void;
  public onDestroy?(): void;
}

export class UITransform extends Component {
  public width = 0;
  public height = 0;
  public anchorX = 0.5;
  public anchorY = 0.5;
  public setContentSize(w: number, h: number): void {
    this.width = w;
    this.height = h;
  }
  public setAnchorPoint(x: number, y: number): void {
    this.anchorX = x;
    this.anchorY = y;
  }
}

/**
 * 排版模型：独立于 UiKit 的估算，系数刻意比 UiKit 宽松（大写 .72 / 其它 .58 / 空格 .34），
 * 这样「在 stub 里不缩」比「在真机里不缩」更难达到，通过即有余量。
 */
function charUnits(cp: number): number {
  const full =
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6);
  if (full) return 1.0;
  if (cp === 0x20) return 0.34;
  if ((cp >= 0x0b82 && cp <= 0x0b83) || (cp >= 0x0bbe && cp <= 0x0bcd) || cp === 0x0bd7) return 0.05;
  if (cp >= 0x0b80 && cp <= 0x0bff) return 0.72;
  if (cp >= 0x41 && cp <= 0x5a) return 0.72;
  return 0.58;
}

function lineUnits(s: string): number {
  let u = 0;
  for (let i = 0; i < s.length; i++) u += charUnits(s.charCodeAt(i));
  return u;
}

export class Label extends Component {
  static Overflow = { NONE: 0, CLAMP: 1, SHRINK: 2, RESIZE_HEIGHT: 3 };
  static HorizontalAlign = { LEFT: 0, CENTER: 1, RIGHT: 2 };
  static VerticalAlign = { TOP: 0, CENTER: 1, BOTTOM: 2, BASELINE: 3 };

  private _fontSize = 50;
  private _lineHeight = 50;
  private _userLineHeight = false;
  private _string = '';

  public color = new Color();
  public overflow = Label.Overflow.NONE;
  public horizontalAlign = Label.HorizontalAlign.LEFT;
  public verticalAlign = Label.VerticalAlign.TOP;
  public enableWrapText = true;
  public isBold = false;

  get string(): string {
    return this._string;
  }
  set string(v: string) {
    this._string = v === null || v === undefined ? '' : String(v);
  }

  get fontSize(): number {
    return this._fontSize;
  }
  set fontSize(v: number) {
    this._fontSize = v;
    if (!this._userLineHeight) this._lineHeight = v;
  }

  get lineHeight(): number {
    return this._lineHeight;
  }
  set lineHeight(v: number) {
    this._lineHeight = v;
    this._userLineHeight = true;
  }

  /** 显式换行数 */
  private segments(): string[] {
    return this._string.length === 0 ? [''] : this._string.split('\n');
  }

  /** 折行后的行数（按字符粒度近似，与引擎的逐字换行同量级） */
  public wrappedLines(boxW: number, fs: number): number {
    const perLine = boxW / fs;
    let lines = 0;
    for (const seg of this.segments()) {
      const u = lineUnits(seg);
      lines += Math.max(1, Math.ceil(u / perLine));
    }
    return lines;
  }

  /** 不折行时最长段需要的像素宽 */
  public contentWidth(fs: number): number {
    let worst = 0;
    for (const seg of this.segments()) worst = Math.max(worst, lineUnits(seg));
    return worst * fs;
  }

  /**
   * 引擎 Overflow.SHRINK 的结果字号：盒子塞不下就逐号退让。
   * 真机用 _actualFontSize 读同一件事，这里让 layoutCheck 能离线复算。
   */
  public get _actualFontSize(): number {
    const tr = this.node ? this.node.getComponent(UITransform) : null;
    if (this.overflow !== Label.Overflow.SHRINK || !tr || tr.width <= 0 || tr.height <= 0) {
      return this._fontSize;
    }
    let fs = this._fontSize;
    while (fs > 1) {
      const widthOk = !this.enableWrapText ? this.contentWidth(fs) <= tr.width : true;
      const lines = this.enableWrapText ? this.wrappedLines(tr.width, fs) : this.segments().length;
      const heightOk = lines * this._lineHeight <= tr.height;
      if (widthOk && heightOk) break;
      fs -= 1;
    }
    return fs;
  }
}

export class Sprite extends Component {
  static SizeMode = { CUSTOM: 0, TRIMMED: 1, RAW: 2 };
  static Type = { SIMPLE: 0, SLICED: 1, FILLED: 2 };
  public sizeMode = Sprite.SizeMode.TRIMMED;
  public type = Sprite.Type.SIMPLE;
  public spriteFrame: SpriteFrame | null = null;
  public color = new Color();
  public trim = true;
}

export class Graphics extends Component {
  public fillColor = new Color();
  public strokeColor = new Color();
  public lineWidth = 1;
  public ops: string[] = [];
  public clear(): void {
    this.ops = [];
  }
  public roundRect(_x: number, _y: number, w: number, h: number, _r: number): void {
    this.ops.push(`rect:${w}x${h}`);
  }
  public rect(_x: number, _y: number, w: number, h: number): void {
    this.ops.push(`rect:${w}x${h}`);
  }
  public moveTo(_x: number, _y: number): void {}
  public lineTo(_x: number, _y: number): void {}
  public circle(_x: number, _y: number, r: number): void {
    this.ops.push(`circle:${r}`);
  }
  public close(): void {}
  public fill(): void {}
  public stroke(): void {}
}

export class Button extends Component {
  static Transition = { NONE: 0, COLOR: 1, SPRITE: 2, SCALE: 3 };
  static EventType = {
    CLICK: 'click',
    TOGGLE_STARTED: 'toggle-started',
    TOGGLE_ENDED: 'toggle-ended',
    TOGGLED: 'toggled',
    PRESSING_CHANGED: 'pressing-changed',
    HOVER_STARTED: 'hover-started',
    HOVER_ENDED: 'hover-ended',
    cancelInnerEvents: 'cancelInnerEvents',
  };
  public transition = Button.Transition.NONE;
  public zoomScale = 1;
  public interactable = true;
  public enabled = true;
}

export class UIOpacity extends Component {
  private _opacity = 255;
  get opacity(): number {
    return this._opacity;
  }
  set opacity(v: number) {
    this._opacity = v;
  }
}

export class BlockInputEvents extends Component {}

export class Widget extends Component {
  static AlignMode = { ONCE: 0, ON_WINDOW_RESIZE: 1, ALWAYS: 2 };
  public isAlignTop = false;
  public isAlignBottom = false;
  public isAlignLeft = false;
  public isAlignRight = false;
  public top = 0;
  public bottom = 0;
  public left = 0;
  public right = 0;
  public alignMode = Widget.AlignMode.ONCE;
  public updateAlignment(): void {}
}

export class Canvas extends Component {
  public cameraComponent: Camera | null = null;
}

export class Camera extends Component {
  static ProjectionType = { ORTHO: 0, PERSPECTIVE: 1 };
  static ClearFlag = { NONE: 0, COLOR: 1, DEPTH: 2, SOLID_COLOR: 7, ONLY_BG: 7 };
  public projection = Camera.ProjectionType.PERSPECTIVE;
  public priority = 0;
  public clearFlags = Camera.ClearFlag.SOLID_COLOR;
  public clearColor = new Color();
  public visibility = 0;
}

export class Mask extends Component {
  static Type = { RECT: 0, ELLIPSE: 1, GRAPHICS_RECT: 2, GRAPHICS_ELLIPSE: 3, GRAPHICS_STENCIL: 4 };
  public type = Mask.Type.RECT;
}

export class ScrollView extends Component {
  public horizontal = true;
  public vertical = true;
  public inertia = true;
  public brake = 0.5;
  public elastic = true;
  public cancelInnerEvents = true;
  public content: Node | null = null;
  public scrollToTop(): void {}
}

// ---------------------------------------------------------------- 全局单例

export const view = {
  setDesignResolutionSize(_w: number, _h: number, _policy?: number): void {},
  getVisibleSize(): { width: number; height: number } {
    return { width: DESIGN_W, height: DESIGN_H };
  },
};

export const ResolutionPolicy = { EXACT_FIT: 0, NO_BORDER: 1, SHOW_ALL: 2, FIXED_HEIGHT: 3, FIXED_WIDTH: 4 };

export const game = {
  canvas: { width: DESIGN_W, height: DESIGN_H },
  frameRate: 60,
};

class FakeBundle {
  constructor(private name: string) {}
  /** UiKit 现在先试同步缓存命中；无头侧永远没有缓存，返回 null 让它落到 load，走原有按真实 PNG 尺寸断言的路径 */
  public get(_req: string, _type: any): any {
    return null;
  }
  public load(req: string, type: any, cb: (e: Error | null, asset: any) => void): void {
    if (this.name !== 'art' || type !== SpriteFrame) {
      cb(new Error(`[cc-ui-stub] no asset: ${this.name}/${req}`), null);
      return;
    }
    const rel = String(req).replace(/\/spriteFrame$/, '');
    const file = ART_ROOT ? path.join(ART_ROOT, `${rel}.png`) : '';
    const size = file ? readPngSize(file) : null;
    if (!size) {
      cb(new Error(`[cc-ui-stub] missing art: ${rel}`), null);
      return;
    }
    const sf = new SpriteFrame();
    sf.originalSize = { ...size };
    // 真图导入时 trimType:auto 会削透明边，rect 可能小于 originalSize；
    // 无头侧不模拟削边，UiKit 读的是 originalSize，不影响比例。
    sf.rect = { ...size };
    cb(null, sf);
  }
}

const _bundles: Map<string, FakeBundle> = new Map();

export const assetManager = {
  loadBundle(name: string, cb: (err: Error | null, bundle?: any) => void): void {
    if (name === 'art') {
      cb(null, this.getBundle(name));
      return;
    }
    cb(new Error(`[cc-ui-stub] bundle ${name} unavailable`), undefined);
  },
  getBundle(name: string): any {
    if (name !== 'art') return null;
    let b = _bundles.get(name);
    if (!b) {
      b = new FakeBundle(name);
      _bundles.set(name, b);
    }
    return b;
  },
};

export const director = {
  getScene(): Node | null {
    return null;
  },
  loadScene(_name: string): void {},
  addPersistRootNode(_node: Node): void {},
};

// 装饰器退化。@ccclass('X') 只有带括号一种写法，@property 则既有 @property(Label) 也有裸 @property，
// 按实参个数区分：>=2 说明这次就是装饰器调用（target, key, desc），返回 undefined 让原值活着；
// 只给 1 个参数说明是工厂调用，返回装饰器本身。
const ignore = (..._args: any[]): undefined => undefined;
const dual = (...args: any[]): any => (args.length >= 2 ? undefined : ignore);
export const _decorator = {
  ccclass: (..._args: any[]) => ignore,
  property: dual,
  executeInEditMode: dual,
  menu: dual,
  requireComponent: dual,
};

const _memStore: Record<string, string> = {};
const _inMemory = {
  getItem(k: string): string | null {
    return Object.prototype.hasOwnProperty.call(_memStore, k) ? _memStore[k] : null;
  },
  setItem(k: string, v: string): void {
    _memStore[k] = String(v);
  },
  removeItem(k: string): void {
    delete _memStore[k];
  },
};

export const sys = {
  platform: 0,
  isMobile: false,
  get localStorage() {
    const injected = (globalThis as any).localStorage;
    return injected && typeof injected.getItem === 'function' ? injected : _inMemory;
  },
};
