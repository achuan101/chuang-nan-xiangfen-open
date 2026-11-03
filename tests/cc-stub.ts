// 仅 tests/logicCheck 用：替代 Cocos 引擎模块，让 core/ 逻辑能在 node 下裸跑。
// tests/build-check.mjs 通过 esbuild alias 把 'cc' 指到这里，生产代码不引用本文件。

export class AudioClip {}

export class AudioSource {
  // isValid 恒为 false：AudioKit 的 play / setMuted 都先查它，
  // 于是无引擎环境下整条音频路径自然短路，不需要再 mock 播放行为。
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

export class Node {
  public name: string;
  constructor(name = '') {
    this.name = name;
  }
  public getChildByName(_name: string): Node | null {
    return null;
  }
  public addChild(_child: Node): void {}
  public getComponent<T>(_cls: new () => T): T | null {
    return null;
  }
  public addComponent<T>(cls: new () => T): T {
    return new cls();
  }
}

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
}

export const assetManager = {
  loadBundle(_name: string, cb: (err: Error | null, bundle?: unknown) => void): void {
    cb(new Error('[cc-stub] no asset bundle in logicCheck'));
  },
  getBundle(_name: string): null {
    return null;
  },
};

export const director = {
  getScene(): null {
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

export class Component {
  public node: Node = new Node('stub');
  public enabled = true;
  public getComponent<T>(_cls: new () => T): T | null {
    return null;
  }
  public addComponent<T>(cls: new () => T): T {
    return new cls();
  }
  public schedule(_fn: () => void, _interval?: number): void {}
  public unschedule(_fn: () => void): void {}
  public scheduleOnce(fn: () => void, _delay?: number): void {
    fn();
  }
}

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
  // 测试若自行往 globalThis.localStorage 注入了替身就沿用它，否则退回这份内存版。
  get localStorage() {
    const injected = (globalThis as any).localStorage;
    return injected && typeof injected.getItem === 'function' ? injected : _inMemory;
  },
};
