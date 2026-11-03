import { AudioClip, AudioSource, Node, assetManager, director } from 'cc';

declare const wx: any;

export type SfxName =
  | 'ui_tap'
  | 'harvest'
  | 'blend_start'
  | 'blend_ok'
  | 'blend_fail'
  | 'cure_ready'
  | 'shelf'
  | 'deliver'
  | 'coin';

const ALL: SfxName[] = [
  'ui_tap',
  'harvest',
  'blend_start',
  'blend_ok',
  'blend_fail',
  'cure_ready',
  'shelf',
  'deliver',
  'coin',
];

const BGM_NAME = 'bgm_soft';

/**
 * 轻量音效 + 极轻循环 BGM。
 * 从 audio bundle 加载；资源缺失时静默跳过。
 * 静音时 SFX/BGM 均不发声（与 S1 存档开关兼容）。
 */
export class AudioKit {
  private static _ready = false;
  private static _loading = false;
  private static _source: AudioSource | null = null;
  private static _bgmSource: AudioSource | null = null;
  private static _clips = new Map<string, AudioClip>();
  private static _bgmClip: AudioClip | null = null;
  private static _queue: SfxName[] = [];
  private static _volume = 0.7;
  private static _bgmVolume = 0.22;
  private static _muted = false;
  private static _bgmWanted = true;
  private static _lifecycleHooked = false;

  public static init(): void {
    this.hookWeChatLifecycle();
    if (this._ready || this._loading) return;
    this._loading = true;
    this.ensureSource();
    assetManager.loadBundle('audio', (err, bundle) => {
      if (err || !bundle) {
        this._loading = false;
        console.warn('[AudioKit] load audio bundle failed', err);
        return;
      }
      let pending = ALL.length + 1;
      const done = () => {
        pending -= 1;
        if (pending > 0) return;
        this._ready = true;
        this._loading = false;
        const queued = this._queue.splice(0);
        queued.forEach(id => this.play(id));
        this.applyBgmState();
      };
      ALL.forEach(name => {
        bundle.load(name, AudioClip, (e, clip) => {
          if (!e && clip) this._clips.set(name, clip);
          done();
        });
      });
      bundle.load(BGM_NAME, AudioClip, (e, clip) => {
        if (!e && clip) this._bgmClip = clip;
        done();
      });
    });
  }

  public static isMuted(): boolean {
    return this._muted;
  }

  public static setMuted(muted: boolean): void {
    this._muted = !!muted;
    this.applyBgmState();
  }

  /** 是否希望播放 BGM（静音时仍为 true，解禁后恢复） */
  public static setBgmWanted(wanted: boolean): void {
    this._bgmWanted = !!wanted;
    this.applyBgmState();
  }

  public static play(name: SfxName): void {
    if (this._muted) return;
    if (!this._ready) {
      this._queue.push(name);
      this.init();
      return;
    }
    const clip = this._clips.get(name);
    if (!clip || !this._source || !this._source.isValid) return;
    try {
      this._source.playOneShot(clip, this._volume);
    } catch (e) {
      console.warn('[AudioKit] play failed', name, e);
    }
  }

  private static applyBgmState(): void {
    this.ensureSource();
    if (!this._bgmSource || !this._bgmSource.isValid) return;
    const should = this._bgmWanted && !this._muted && !!this._bgmClip;
    if (!should) {
      if (this._bgmSource.playing) this._bgmSource.stop();
      return;
    }
    if (this._bgmSource.clip !== this._bgmClip) {
      this._bgmSource.clip = this._bgmClip;
      this._bgmSource.loop = true;
      this._bgmSource.volume = this._bgmVolume;
    }
    if (!this._bgmSource.playing) {
      try {
        this._bgmSource.play();
      } catch (e) {
        console.warn('[AudioKit] bgm play failed', e);
      }
    }
  }

  private static ensureSource(): void {
    let root = director.getScene()?.getChildByName('AudioKitRoot') || null;
    if (!root) {

      root = new Node('AudioKitRoot');
      director.addPersistRootNode(root);
    }
    let src = root.getComponent(AudioSource);
    if (!src) src = root.addComponent(AudioSource);
    src.playOnAwake = false;
    this._source = src;

    let bgmNode = root.getChildByName('Bgm');
    if (!bgmNode) {
      bgmNode = new Node('Bgm');
      root.addChild(bgmNode);
    }
    let bgm = bgmNode.getComponent(AudioSource);
    if (!bgm) bgm = bgmNode.addComponent(AudioSource);
    bgm.playOnAwake = false;
    bgm.loop = true;
    bgm.volume = this._bgmVolume;
    this._bgmSource = bgm;
  }

  private static hookWeChatLifecycle(): void {
    if (this._lifecycleHooked) return;
    this._lifecycleHooked = true;
    if (typeof wx !== 'undefined') {
      try {
        if (typeof wx.setInnerAudioOption === 'function') {
          wx.setInnerAudioOption({
            obeyMuteSwitch: false,
            mixWithOther: true,
          });
        }
        if (typeof wx.onHide === 'function') {
          wx.onHide(() => {
            if (this._bgmSource && this._bgmSource.isValid && this._bgmSource.playing) {
              this._bgmSource.pause();
            }
          });
        }
        if (typeof wx.onShow === 'function') {
          wx.onShow(() => {
            if (this._bgmSource && this._bgmSource.isValid && this._bgmWanted && !this._muted) {
              this.applyBgmState();
            }
          });
        }
      } catch (err) {
        console.warn('[AudioKit] hook wx lifecycle error:', err);
      }
    }
  }
}
