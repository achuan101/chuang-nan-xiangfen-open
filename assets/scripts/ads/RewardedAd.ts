declare const wx: any;

/** 上线前换成公众平台真实激励广告位 ID */
export const AD_UNIT_ID = 'adunit-mock';

/** 还没上线，激励通道先关掉。以后改 true 即恢复按钮。 */
export const ADS_ENABLED = false;

/** 是否运行在微信环境（真机 / 微信开发者工具） */
export function isWeChatRuntime(): boolean {
  return typeof wx !== 'undefined';
}

/**
 * 「观看短片」入口是否该出现：
 * 真机要等 ADS_ENABLED 打开，否则点了只会得到「暂未开放」；本地预览保留 mock 通道便于自测。
 */
export function adEntryVisible(): boolean {
  return ADS_ENABLED || !isWeChatRuntime();
}

export class RewardedAd {
  private static _adInstance: any = null;
  private static _onSuccessCallback: (() => void) | null = null;
  private static _onCancelCallback: (() => void) | null = null;
  private static _isLoaded: boolean = false;

  public static enabled(): boolean {
    return ADS_ENABLED;
  }

  public static init(adUnitId: string = AD_UNIT_ID): void {
    if (!ADS_ENABLED) return;
    if (typeof wx !== 'undefined' && typeof wx.createRewardedVideoAd === 'function') {
      try {
        this._adInstance = wx.createRewardedVideoAd({ adUnitId });
        this._adInstance.onLoad(() => {
          this._isLoaded = true;
          console.log('[RewardedAd] Ad loaded successfully');
        });
        this._adInstance.onError((err: any) => {
          this._isLoaded = false;
          console.warn('[RewardedAd] Ad error:', err);
        });
        this._adInstance.onClose((res: any) => {
          if (res && res.isEnded) {
            console.log('[RewardedAd] Reward granted');
            if (this._onSuccessCallback) this._onSuccessCallback();
          } else {
            console.log('[RewardedAd] Closed early without reward');
            if (this._onCancelCallback) this._onCancelCallback();
          }
          this._onSuccessCallback = null;
          this._onCancelCallback = null;
        });
      } catch (e) {
        console.warn('[RewardedAd] Failed to create video ad:', e);
      }
    }
  }

  /**
   * 播放激励视频
   * @param onSuccess 完整观看奖励回调
   * @param onCancel 中途退出回调
   */
  public static show(onSuccess: () => void, onCancel?: () => void): void {
    this._onSuccessCallback = onSuccess;
    this._onCancelCallback = onCancel || null;

    // 广告开关策略：
    // 微信真机环境（有 wx）：若 ADS_ENABLED 为 false，判定广告暂未开放，不发奖直接触发 onCancel；
    // 浏览器 / Cocos 模拟器开发环境（无 wx）：允许 mock 发放加速卡，保证开发预览可测。
    if (!ADS_ENABLED && typeof wx !== 'undefined') {
      console.log('[RewardedAd] 微信环境下广告未开放 (ADS_ENABLED=false)');
      if (this._onCancelCallback) {
        this._onCancelCallback();
        this._onCancelCallback = null;
      }
      this._onSuccessCallback = null;
      return;
    }

    if (this._adInstance) {
      this._adInstance.show().catch(() => {
        this._adInstance.load().then(() => this._adInstance.show()).catch((err: any) => {
          // 真机无填充是常态：不能当成「已看完」发奖，否则白送奖励
          console.warn('[RewardedAd] Show failed, no reward granted:', err);
          this._onSuccessCallback = null;
          if (this._onCancelCallback) {
            const cb = this._onCancelCallback;
            this._onCancelCallback = null;
            cb();
          }
        });
      });
    } else if (typeof wx === 'undefined') {
      // 浏览器预览 / Cocos 模拟器环境（无 wx）直接模拟成功，保证开发可测
      console.log('[RewardedAd] Mock environment detected. Simulating ad watch completed (500ms delay)...');
      setTimeout(() => {
        this.mockSuccess();
      }, 500);
    } else {
      // 真机但广告实例创建失败（ADS_ENABLED 打开却 init 失败）：不发奖
      console.warn('[RewardedAd] No ad instance on device, no reward granted');
      this._onSuccessCallback = null;
      if (this._onCancelCallback) {
        const cb = this._onCancelCallback;
        this._onCancelCallback = null;
        cb();
      }
    }
  }

  private static mockSuccess(): void {
    if (this._onSuccessCallback) {
      this._onSuccessCallback();
      this._onSuccessCallback = null;
    }
    this._onCancelCallback = null;
  }
}
