declare const wx: any;

import { ADS_ENABLED } from './RewardedAd';

/** 总开关：默认关；上线填真 ID 后再开。微信仍有平台频控。 */
export const INTERSTITIAL_ENABLED = false;
/** 上线前替换为微信后台插屏广告位 ID */
export const INTERSTITIAL_AD_UNIT_ID = 'adunit-interstitial-mock';
/** 业务层最短间隔（毫秒），避免回场景连弹 */
export const INTERSTITIAL_MIN_INTERVAL_MS = 90_000;

export class InterstitialAd {
  private static _adInstance: any = null;
  private static _isLoaded: boolean = false;
  private static _lastShowAt = 0;
  private static _enabled = INTERSTITIAL_ENABLED;

  public static init(): void {
    if (!ADS_ENABLED || !this._enabled) return;

    if (typeof wx !== 'undefined' && typeof wx.createInterstitialAd === 'function') {
      try {
        this._adInstance = wx.createInterstitialAd({ adUnitId: INTERSTITIAL_AD_UNIT_ID });
        this._adInstance.onLoad(() => {
          this._isLoaded = true;
          console.log('[InterstitialAd] Ad loaded successfully');
        });
        this._adInstance.onError((err: any) => {
          this._isLoaded = false;
          console.warn('[InterstitialAd] Ad error:', err);
        });
        this._adInstance.onClose(() => {
          console.log('[InterstitialAd] Closed');
        });
      } catch (e) {
        console.warn('[InterstitialAd] Failed to create interstitial ad:', e);
      }
    }
  }

  /** 运行时关闭插屏（设置页或合规需要时可调） */
  public static setEnabled(enabled: boolean): void {
    this._enabled = !!enabled;
  }

  public static isEnabled(): boolean {
    return ADS_ENABLED && this._enabled;
  }

  /**
   * 尝试展示插屏。尊重总开关 + 业务最短间隔；微信平台另有频控。
   * 建议在回铺面等场景切换时调用。
   */
  public static show(): void {
    if (!ADS_ENABLED || !this._enabled) return;

    const now = Date.now();
    if (now - this._lastShowAt < INTERSTITIAL_MIN_INTERVAL_MS) {
      console.log('[InterstitialAd] skipped by cadence');
      return;
    }

    if (this._adInstance) {
      this._adInstance
        .show()
        .then(() => {
          this._lastShowAt = Date.now();
        })
        .catch((err: any) => {
          console.warn('[InterstitialAd] Show failed:', err);
        });
    } else {
      this._lastShowAt = now;
      console.log('[InterstitialAd] Mock show interstitial ad');
    }
  }
}
