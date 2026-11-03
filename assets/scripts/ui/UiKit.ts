import {
  Node,
  Label,
  Button,
  UITransform,
  Color,
  Graphics,
  SpriteFrame,
  Sprite,
  assetManager,
  Widget,
  Canvas,
  Camera,
  view,
  ResolutionPolicy,
  BlockInputEvents,
  UIOpacity,
  Tween,
  tween,
  Vec3,
} from 'cc';

export const Palette = {
  cream: new Color(246, 232, 215, 255),
  paper: new Color(255, 248, 238, 255),
  ink: new Color(92, 64, 51, 255),
  inkSoft: new Color(140, 110, 90, 255),
  wood: new Color(201, 154, 112, 255),
  woodDark: new Color(139, 105, 74, 255),
  mint: new Color(126, 200, 200, 255),
  rose: new Color(244, 182, 194, 255),
  gold: new Color(232, 196, 104, 255),
  panel: new Color(255, 250, 242, 230),
  mistOk: new Color(126, 200, 200, 150),
  mistFail: new Color(150, 150, 150, 170),
  /** 叠在深色木梁上的浅标题色 */
  inkOnDark: new Color(255, 248, 238, 255),
  titleChip: new Color(40, 32, 28, 150),
  slotEmptyFill: new Color(255, 248, 238, 120),
  slotEmptyStroke: new Color(180, 150, 120, 200),
  invEmpty: new Color(232, 220, 205, 220),
  /** 禁用态按钮底色（金币不足等） */
  disabled: new Color(206, 198, 188, 255),
  disabledText: new Color(122, 112, 102, 255),
};

/**
 * 全站字阶（720×1280 竖屏设计空间）。取自现有用量的聚类，低于 badge 的字号在手机上读不动。
 * makeLabel 用 Overflow.SHRINK：盒高不足 lineHeight 时字号会被静默缩回去，所以配套给了 labelHeightFor。
 */
export const Type = {
  /** 场景标题芯片 */
  scene: 32,
  /** 面板大标题 / makeLabel 默认 */
  head: 24,
  /** 卡片与面板标题、按钮文字（按钮 22 起，18 在手机上按起来发虚） */
  card: 22,
  /** 主文案、顶栏数值 */
  body: 20,
  /** 次级说明 */
  sub: 18,
  /** 可读下限 */
  badge: 15,
};

/** makeLabel 里 lineHeight = floor(fontSize * 1.35)，行数乘一下就是标签盒高的下限 */
export const LINE_RATIO = 1.35;

export function labelHeightFor(fontSize: number, lines: number = 1): number {
  return Math.floor(fontSize * LINE_RATIO) * Math.max(1, lines);
}

/**
 * 外壳纵向槽位（设计空间 y，向上为正）。各屏内容只往 CONTENT_TOP ~ CONTENT_BOTTOM 里排，
 * 不再各自猜顶栏在哪。数值来自实测盒界：标题 534~586 / 引导 440~528 / 顶栏 364~436 / 导航 -592~-528。
 */
export const TITLE_Y = 560;
export const TUTORIAL_Y = 484;      // 原 500 会与标题芯片重叠 10px
export const HUD_Y = 400;
export const NAV_Y = -560;
export const CONTENT_TOP = 340;
export const CONTENT_BOTTOM = -500;

/** 统一倒计时：分:秒，如 1:05 */
export function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export const DESIGN_W = 720;
export const DESIGN_H = 1280;

export function findByName(root: Node, name: string): Node | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findByName(child, name);
    if (found) return found;
  }
  return null;
}

export function ensureTransform(node: Node, w: number, h: number): UITransform {
  let t = node.getComponent(UITransform);
  if (!t) t = node.addComponent(UITransform);
  t.setContentSize(w, h);
  t.setAnchorPoint(0.5, 0.5);
  return t;
}

export function paint(node: Node, color: Color, radius = 12): Graphics {
  const t = node.getComponent(UITransform)!;
  let g = node.getComponent(Graphics);
  if (!g) g = node.addComponent(Graphics);
  g.clear();
  g.fillColor = color;
  const w = t.width;
  const h = t.height;
  g.roundRect(-w / 2, -h / 2, w, h, radius);
  g.fill();
  return g;
}

/** 圆角描边框（空槽虚线感用细描边近似） */
export function paintStroke(node: Node, fill: Color, stroke: Color, radius = 12, lineWidth = 3): Graphics {
  const t = node.getComponent(UITransform)!;
  let g = node.getComponent(Graphics);
  if (!g) g = node.addComponent(Graphics);
  g.clear();
  const w = t.width;
  const h = t.height;
  g.fillColor = fill;
  g.roundRect(-w / 2, -h / 2, w, h, radius);
  g.fill();
  g.lineWidth = lineWidth;
  g.strokeColor = stroke;
  g.roundRect(-w / 2, -h / 2, w, h, radius);
  g.stroke();
  return g;
}

/** 场景顶栏标题：浅色字 + 半透明深色芯片，叠木梁可读 */
export function makeSceneTitle(parent: Node, name: string, text: string, y = TITLE_Y): Label {
  const chip = makeNode(parent, `${name}Chip`, Math.min(420, 48 + text.length * 28), 52, 0, y);
  paint(chip, Palette.titleChip, 16);
  return makeLabel(chip, name, text, chip.getComponent(UITransform)!.width - 16, labelHeightFor(Type.scene), 0, 0, Type.scene, Palette.inkOnDark);
}

/** 子场景氛围底：优先 shop/bg_blurred，失败回退米色 */
export function applyAmbientBg(parent: Node, name = 'AmbientBG'): Node {
  let bg = parent.getChildByName(name);
  if (!bg) bg = makeNode(parent, name, DESIGN_W, DESIGN_H, 0, 0);
  bg.setSiblingIndex(0);
  applySprite(
    bg,
    'shop/bg_blurred',
    sp => {
      sp.color = new Color(255, 255, 255, 255);
    },
    () => {
      paint(bg!, Palette.cream, 0);
    },
  );
  // 轻遮罩抬可读性
  let veil = parent.getChildByName(`${name}Veil`);
  if (!veil) veil = makeNode(parent, `${name}Veil`, DESIGN_W, DESIGN_H, 0, 0);
  veil.setSiblingIndex(1);
  paint(veil, new Color(255, 248, 238, 90), 0);
  return bg;
}

export function makeNode(parent: Node, name: string, w: number, h: number, x: number, y: number): Node {
  let n = parent.getChildByName(name);
  if (!n) {
    n = new Node(name);
    parent.addChild(n);
  }
  n.layer = parent.layer;
  n.setPosition(x, y, 0);
  ensureTransform(n, w, h);
  n.active = true;
  return n;
}

export function makeLabel(
  parent: Node,
  name: string,
  text: string,
  w: number,
  h: number,
  x: number,
  y: number,
  fontSize = 24,
  color: Color = Palette.ink,
  noWrap = false,
): Label {
  const n = makeNode(parent, name, w, h, x, y);
  let lab = n.getComponent(Label);
  if (!lab) lab = n.addComponent(Label);
  lab.color = color;
  lab.overflow = Label.Overflow.SHRINK;
  lab.horizontalAlign = Label.HorizontalAlign.CENTER;
  lab.verticalAlign = Label.VerticalAlign.CENTER;
  lab.enableWrapText = !noWrap;
  lab.isBold = false;
  // 盒高不够会让 SHRINK 静默缩字号（标题 40<43、加号 64<70 都中过），统一交给 setLabel 处理
  setLabel(lab, text, fontSize);
  return lab;
}

/** 全角码位（中日韩文字、全角标点、假名），排版宽度按 1 em 计 */
function isFullWidth(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe6f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6)
  );
}

/** 单行文本宽度（以 em 计）：全角记 1，泰米尔结合符 .05，大写 .68，空格 .3，其余 .55 */
function textUnits(line: string): number {
  let units = 0;
  for (let i = 0; i < line.length; i++) {
    const cp = line.charCodeAt(i);
    if (cp === 0x20) units += 0.3;
    else if (isFullWidth(cp)) units += 1;
    else if ((cp >= 0x0b82 && cp <= 0x0b83) || (cp >= 0x0bbe && cp <= 0x0bcd) || cp === 0x0bd7) units += 0.05;
    else if (cp >= 0x0b80 && cp <= 0x0bff) units += 0.72;
    else if (cp >= 0x41 && cp <= 0x5a) units += 0.68;
    else units += 0.55;
  }
  return units;
}

/**
 * 运行时换文案：字号、行高、盒高一起改。
 * 直接赋 label.string 会让引擎 SHRINK 静默缩放（货架 15→12 就是这么来的），
 * 因为创建时看不到运行时的行数与长度。
 * - 显式 \n 行数：按行数把盒高补够，保住声明字号
 * - 单行超宽 / 自动折行：降字号塞进原盒，不撑破布局
 */
const _declaredSize = new WeakMap<Label, number>();

export function setLabel(lab: Label, text: string, fontSize?: number): void {
  // 不传字号时以「首次声明的字号」为基准。读 lab.fontSize 会被上一次缩小的结果接着缩，
  // 同一个标签反复换文案就一路跌到下限。
  if (fontSize && fontSize > 0) _declaredSize.set(lab, fontSize);
  const base = _declaredSize.get(lab) ?? (fontSize && fontSize > 0 ? fontSize : lab.fontSize);
  const str = String(text);
  const lines = str.split('\n');
  const tr = lab.node.getComponent(UITransform);
  const boxW = tr ? tr.width : 0;
  const boxH = tr ? tr.height : 0;

  let widest = 0;
  let units = 0;
  for (const line of lines) {
    const u = textUnits(line);
    units += u;
    widest = Math.max(widest, u);
  }

  let fit = base;
  const usableW = boxW > 0 ? boxW - 2 : 0;
  if (!lab.enableWrapText || lines.length > 1) {
    if (widest > 0 && usableW > 0) fit = Math.min(fit, Math.floor(usableW / widest));
  }
  const emPerLine = usableW > 0 ? usableW / fit : Infinity;
  const didWrap = lines.length === 1 && boxH > 0 && lab.enableWrapText && units > emPerLine;
  if (didWrap) {
    const estLines = Math.max(1, Math.ceil(units / emPerLine));
    const needH = estLines * Math.floor(fit * LINE_RATIO);
    if (needH > boxH) {
      fit = Math.min(fit, Math.floor(boxH / (LINE_RATIO * estLines)));
    }
  }
  fit = Math.max(Type.badge, Math.min(base, fit));

  lab.string = str;
  lab.fontSize = fit;
  lab.lineHeight = Math.floor(fit * LINE_RATIO);
  // 折行塞原盒时不撑高；其余按行数补足盒高，保住声明字号不被 SHRINK 吃掉
  if (tr && !didWrap) {
    const need = labelHeightFor(fit, lines.length);
    if (tr.height < need) tr.setContentSize(tr.width, need);
  }
}

export function makeButton(
  parent: Node,
  name: string,
  text: string,
  w: number,
  h: number,
  x: number,
  y: number,
  bg: Color = Palette.wood,
  noWrap = false,
): { node: Node; button: Button; label: Label } {
  const n = makeNode(parent, name, w, h, x, y);
  paint(n, bg, 12);
  let btn = n.getComponent(Button);
  if (!btn) btn = n.addComponent(Button);
  // 引擎的 SCALE 过渡是瞬变（无缓动），换成下面带出/入曲线的按压
  btn.transition = Button.Transition.NONE;
  bindPressFeedback(n, btn);
  const lab = makeLabel(n, 'Label', text, w - 10, h - 6, 0, 0, Type.card, Palette.paper, noWrap);
  return { node: n, button: btn, label: lab };
}

const PRESS_SCALE = 0.94;
const _pressBound = new WeakSet<Node>();

/** 按下 0.08s 收到 94%，松开 0.14s backOut 弹回，手感比引擎的瞬时缩放软一档 */
export function bindPressFeedback(node: Node, btn: Button): void {
  if (_pressBound.has(node)) return;
  _pressBound.add(node);
  const press = () => {
    if (!btn.interactable) return;
    Tween.stopAllByTarget(node);
    tween(node)
      .to(0.08, { scale: new Vec3(PRESS_SCALE, PRESS_SCALE, 1) }, { easing: 'quadOut' })
      .start();
  };
  const release = () => {
    Tween.stopAllByTarget(node);
    tween(node)
      .to(0.14, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
  };
  node.on(Node.EventType.TOUCH_START, press);
  node.on(Node.EventType.TOUCH_END, release);
  node.on(Node.EventType.TOUCH_CANCEL, release);
}

export function bindClick(node: Node, handler: () => void, target: object): void {
  let btn = node.getComponent(Button);
  if (!btn) {
    btn = node.addComponent(Button);
    btn.transition = Button.Transition.NONE;
  }
  node.off(Button.EventType.CLICK);
  node.on(Button.EventType.CLICK, handler, target);
}

export function hexColor(hex: string, alpha = 255): Color {
  const raw = hex.replace('#', '');
  const r = parseInt(raw.substring(0, 2), 16);
  const g = parseInt(raw.substring(2, 4), 16);
  const b = parseInt(raw.substring(4, 6), 16);
  return new Color(r, g, b, alpha);
}

export function ensureCanvas(canvas: Node): void {
  ensureTransform(canvas, DESIGN_W, DESIGN_H);
  let widget = canvas.getComponent(Widget);
  if (!widget) widget = canvas.addComponent(Widget);
  widget.isAlignTop = true;
  widget.isAlignBottom = true;
  widget.isAlignLeft = true;
  widget.isAlignRight = true;
  widget.top = 0;
  widget.bottom = 0;
  widget.left = 0;
  widget.right = 0;
  widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
  canvas.setPosition(DESIGN_W / 2, DESIGN_H / 2, 0);
  widget.updateAlignment();

  if (!canvas.getComponent(Canvas)) {
    canvas.addComponent(Canvas);
  }

  let camNode = canvas.getChildByName('Camera');
  if (!camNode) {
    camNode = new Node('Camera');
    canvas.addChild(camNode);
    camNode.layer = canvas.layer;
    const cam = camNode.addComponent(Camera);
    cam.projection = Camera.ProjectionType.ORTHO;
    cam.priority = 0;
    cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    cam.clearColor = Palette.cream;
    cam.visibility = canvas.layer;
    const canvasComp = canvas.getComponent(Canvas);
    if (canvasComp) canvasComp.cameraComponent = cam;
  } else {
    // 确保已有相机的背景色也是暖色（修复场景默认黑色背景）
    const existingCam = camNode.getComponent(Camera);
    if (existingCam) {
      existingCam.clearColor = Palette.cream;
    }
  }

  view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.SHOW_ALL);
}

/** 并发 loadBundle('art') 共用一次加载，避免冷启动多处同时拉 bundle 丢回调 */
let _artBundleWaiters: Array<(b: ReturnType<typeof assetManager.getBundle>) => void> | null = null;

export function ensureArtBundle(cb: (ok: boolean) => void): void {
  const existing = assetManager.getBundle('art');
  if (existing) {
    cb(true);
    return;
  }
  if (_artBundleWaiters) {
    _artBundleWaiters.push(b => cb(!!b));
    return;
  }
  _artBundleWaiters = [b => cb(!!b)];
  assetManager.loadBundle('art', (err, b) => {
    const waiters = _artBundleWaiters || [];
    _artBundleWaiters = null;
    const bundle = err || !b ? null : b;
    for (const w of waiters) w(bundle);
  });
}

export function loadArtSprite(relPath: string, cb: (sf: SpriteFrame | null) => void): void {
  const url = `${relPath}/spriteFrame`;
  const loadFrom = (bundle: NonNullable<ReturnType<typeof assetManager.getBundle>>) => {
    // get 只读内存缓存，命中就是同步返回。切屏时 bundle 早已加载完，走 load 仍要排一次异步，
    // 于是背景必然空一帧——先试 get 才能把「闪一下黑底」消掉。
    const cached = bundle.get(url, SpriteFrame);
    if (cached) {
      cb(cached);
      return;
    }
    bundle.load(url, SpriteFrame, (e, sf) => {
      if (e) {
        console.warn(`[UiKit] loadArtSprite failed for "${url}":`, e);
      }
      cb(e ? null : sf);
    });
  };
  const existing = assetManager.getBundle('art');
  if (existing) {
    loadFrom(existing);
    return;
  }
  ensureArtBundle(ok => {
    const b = assetManager.getBundle('art');
    if (!ok || !b) {
      cb(null);
      return;
    }
    loadFrom(b);
  });
}

const _spriteRequests: WeakMap<Node, { path: string; gen: number }> = new WeakMap();

export function applySprite(node: Node, relPath: string, onLoaded?: (sp: Sprite) => void, onError?: () => void): void {
  // 防御：若节点已经带有 Graphics（如画底色的占位），先清理并移除 Graphics 组件，
  // 避免 Cocos Creator 3.x 因单个节点不能挂载多个 UIRenderable 组件而导致 Sprite 添加失败
  const g = node.getComponent(Graphics);
  if (g) {
    g.clear();
    node.removeComponent(g);
  }
  let sprite = node.getComponent(Sprite);
  if (!sprite) sprite = node.addComponent(Sprite);
  let req = _spriteRequests.get(node);
  if (!req) {
    req = { path: relPath, gen: 0 };
    _spriteRequests.set(node, req);
  } else if (req.path !== relPath) {
    req.path = relPath;
    req.gen++;
  }
  const current = req;
  const gen = current.gen;
  loadArtSprite(relPath, sf => {
    // 同一个节点会跨刷新贴不同的图，先发不一定后到。回调落地前对一下世代号，
    // 否则过期贴图会把 applySpriteFit 的节点尺寸按错的宽高比定住。
    if (!node || !node.isValid || current.path !== relPath || current.gen !== gen) return;
    if (!sf) {
      if (onError) onError();
      return;
    }
    // 再次清理以防在异步加载期间被误加上 Graphics
    const lateG = node.getComponent(Graphics);
    if (lateG) {
      lateG.clear();
      node.removeComponent(lateG);
    }
    if (!sprite || !sprite.isValid) {
      sprite = node.getComponent(Sprite) || node.addComponent(Sprite);
    }
    if (sprite) {
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = sf;
      sprite.type = Sprite.Type.SIMPLE;
      if (onLoaded) onLoaded(sprite);
    }
  });
}

const _fitBoxes: WeakMap<Node, { w: number; h: number }> = new WeakMap();

/**
 * 等比把插图收进节点首次量到的原始包围盒，多余的边留给底衬。
 * 瓶用图统一 192x256 竖幅，而货架格是 64x64 方格，直接贴会把瓶子压扁。
 * 原始尺寸必须在改 setContentSize 之前记下：同一 Icon 节点会跨刷新复用。
 */
export function applySpriteFit(
  node: Node,
  relPath: string,
  onLoaded?: (sp: Sprite) => void,
  onError?: () => void,
): void {
  let box = _fitBoxes.get(node);
  if (!box) {
    const tr = node.getComponent(UITransform);
    box = { w: tr ? tr.width : 0, h: tr ? tr.height : 0 };
    _fitBoxes.set(node, box);
  }
  if (box.w <= 0 || box.h <= 0) {
    applySprite(node, relPath, onLoaded, onError);
    return;
  }
  applySprite(node, relPath, sp => {
    const sf = sp.spriteFrame;
    if (sf) {
      // trimType:auto 会削掉透明边，rect 只是留存块，按比例要读 originalSize
      const src = sf.originalSize && sf.originalSize.width > 0 ? sf.originalSize : sf.rect;
      if (src && src.height > 0) {
        const aspect = src.width / src.height;
        let w = box.w;
        let h = w / aspect;
        if (h > box.h) {
          h = box.h;
          w = h * aspect;
        }
        const tr = node.getComponent(UITransform);
        if (tr) tr.setContentSize(w, h);
      }
    }
    if (onLoaded) onLoaded(sp);
  }, onError);
}

/** 主路径失败时尝试 fallbackPath，再失败则 paint 色块，避免空白 */
export function applySpriteOrFallback(
  node: Node,
  relPath: string,
  fallbackPath: string | null,
  paintColor: Color = Palette.panel,
  fit: boolean = false,
): void {
  const put = fit ? applySpriteFit : applySprite;
  put(node, relPath, undefined, () => {
    if (fallbackPath && fallbackPath !== relPath) {
      put(node, fallbackPath, undefined, () => {
        paint(node, paintColor, 8);
      });
    } else {
      paint(node, paintColor, 8);
    }
  });
}

export function makeDim(parent: Node, name: string, color: Color): Node {
  const n = makeNode(parent, name, DESIGN_W, DESIGN_H, 0, 0);
  paint(n, color, 0);
  if (!n.getComponent(BlockInputEvents)) n.addComponent(BlockInputEvents);
  if (!n.getComponent(UIOpacity)) n.addComponent(UIOpacity);
  return n;
}
