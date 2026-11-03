import { PlayerSaveData } from './Types';

declare const wx: any;

const SAVE_KEY = 'CHUANG_NAN_XIANGFEN_SAVE_V1';
const LEGACY_KEY = 'CHUANG_NAN_XIANGFEN_SAVE_LEGACY';

export class Storage {
  private static isWx(): boolean {
    return typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function';
  }

  /** 读取原始字符串，优先新 key，回退旧 key */
  private static readRaw(): string | null {
    let raw: string | null = null;
    if (this.isWx()) {
      raw = wx.getStorageSync(SAVE_KEY);
      if (!raw) {
        const legacy = wx.getStorageSync(LEGACY_KEY);
        if (legacy) { raw = legacy; }
      }
    } else if (typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) { raw = legacy; }
      }
    }
    return raw;
  }

  public static load(): PlayerSaveData | null {
    try {
      const raw = this.readRaw();
      if (!raw) {
        return null;
      }

      if (typeof raw === 'object') {
        return raw as PlayerSaveData;
      }

      return JSON.parse(raw) as PlayerSaveData;
    } catch (err) {
      console.warn('[Storage] Load save data error:', err);
      return null;
    }
  }

  public static save(data: PlayerSaveData): boolean {
    try {
      const serialized = JSON.stringify(data);
      if (this.isWx()) {
        wx.setStorageSync(SAVE_KEY, serialized);
        // 迁移后清除旧 key
        try { wx.removeStorageSync(LEGACY_KEY); } catch (_) { /* ignore */ }
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SAVE_KEY, serialized);
        try { localStorage.removeItem(LEGACY_KEY); } catch (_) { /* ignore */ }
      }
      return true;
    } catch (err) {
      console.error('[Storage] Write save data error:', err);
      return false;
    }
  }

  public static clear(): void {
    try {
      if (this.isWx()) {
        wx.removeStorageSync(SAVE_KEY);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SAVE_KEY);
      }
    } catch (err) {
      console.warn('[Storage] Clear save error:', err);
    }
  }
}
