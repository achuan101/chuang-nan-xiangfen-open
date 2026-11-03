import { game } from 'cc';
import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { DESIGN_H, DESIGN_W } from '../ui/UiKit';

declare const wx: any;

/** 卡片比例 4:5；SPEC.md:378 要的是「截货架」，不是整屏缩略图 */
const CARD_RATIO = 5 / 4;
/** 裁剪中心取 ShelfArea 的节点 y，让今日货架正好落在卡片正中 */
const CARD_CENTER_DESIGN_Y = 90;

/**
 * 分享「今日出品」：微信内调起分享面板；预览环境给稳定 mock 提示。
 * 文案无充值 / ¥ / 立即购买语义。
 */
export class Share {
  private static _shareMenuInit = false;

  /**
   * 初始化微信右上角原生转发菜单与被动分享事件
   */
  public static initWeChatShareMenu(): void {
    if (this._shareMenuInit) return;
    this._shareMenuInit = true;
    if (typeof wx !== 'undefined') {
      try {
        if (typeof wx.showShareMenu === 'function') {
          wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline'],
          });
        }
        if (typeof wx.onShareAppMessage === 'function') {
          wx.onShareAppMessage(() => ({
            title: Share.buildTitle(),
          }));
        }
        if (typeof (wx as any).onShareTimeline === 'function') {
          (wx as any).onShareTimeline(() => ({
            title: '窗南香氛铺今日开门，欢迎来坐坐～',
          }));
        }
      } catch (err) {
        console.warn('[Share] init wx share menu error:', err);
      }
    }
  }

  public static shareShelf(): Promise<string> {
    const title = Share.buildTitle();
    return new Promise(resolve => {
      if (typeof wx !== 'undefined' && typeof wx.shareAppMessage === 'function') {
        const canvas: any = (game as any).canvas;
        if (canvas && typeof canvas.toTempFilePath === 'function') {
          const crop = Share.shelfCropRect(canvas.width, canvas.height);
          canvas.toTempFilePath({
            ...crop,
            destWidth: 720,
            destHeight: Math.round(720 * CARD_RATIO),
            success(res: any) {
              wx.shareAppMessage({ title, imageUrl: res.tempFilePath });
              resolve('已打开微信分享（含货架截图）');
            },
            fail() {
              wx.shareAppMessage({ title });
              resolve('截图未就绪，已用文字调起分享');
            },
          });
          return;
        }
        wx.shareAppMessage({ title });
        resolve('已打开微信分享');
        return;
      }
      console.log('[Share] mock share:', title);
      resolve(`【预览】模拟分享成功：${title}`);
    });
  }

  /**
   * 源矩形必须是画布像素：SHOW_ALL 下设计空间按 min 缩放贴到画布，原点在画布中心。
   * 之前直接把整屏塞进 500x400，720x1280 被横压成竖，分享出去是一张变形的瓶子。
   */
  private static shelfCropRect(canvasW: number, canvasH: number): { x: number; y: number; width: number; height: number } {
    const scale = Math.min(canvasW / DESIGN_W, canvasH / DESIGN_H);
    let height = Math.min(canvasH, DESIGN_W * scale * CARD_RATIO);
    let width = height / CARD_RATIO;
    if (width > canvasW) {
      width = canvasW;
      height = width * CARD_RATIO;
    }
    const centerY = canvasH / 2 - CARD_CENTER_DESIGN_Y * scale;
    let y = centerY - height / 2;
    y = Math.max(0, Math.min(canvasH - height, y));
    return { x: Math.round((canvasW - width) / 2), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
  }

  private static buildTitle(): string {
    const model = GameModel.instance;
    const names = (model.shelfBottles || [])
      .filter(Boolean)
      .map(id => {
        const b = ConfigManager.getBottle(id as string);
        return b ? b.name : null;
      })
      .filter(Boolean) as string[];
    if (names.length === 0) {
      return '窗南香氛铺今日开门，欢迎来坐坐～';
    }
    const shown = names.slice(0, 2).join('、');
    const more = names.length > 2 ? '等' : '';
    return `窗南今日出品：${shown}${more}，欢迎来看看～`;
  }
}
