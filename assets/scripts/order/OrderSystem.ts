import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';
import { BottleItem } from '../core/Types';

export interface MatchResult {
  bottle: BottleItem;
  source: 'shelf' | 'inventory';
  index: number;
}

export class OrderSystem {
  public static findMatchingBottle(requiredTag: string): MatchResult | null {
    const model = GameModel.instance;

    for (let i = 0; i < model.shelfBottles.length; i++) {
      const bId = model.shelfBottles[i];
      if (!bId) continue;
      if (!ConfigManager.bottleHasTag(bId, requiredTag)) continue;
      const bottle = ConfigManager.getBottle(bId);
      if (bottle) return { bottle, source: 'shelf', index: i };
    }

    for (let i = 0; i < model.bottlesInventory.length; i++) {
      const bId = model.bottlesInventory[i];
      if (!ConfigManager.bottleHasTag(bId, requiredTag)) continue;
      const bottle = ConfigManager.getBottle(bId);
      if (bottle) return { bottle, source: 'inventory', index: i };
    }

    return null;
  }

  /**
   * 交付香水：移除瓶子、加好评、提升熟客好感、立刻发基础金币并换下一位客人。
   * 额外「观看短片再领一份」由 GuestPresenter 可选处理，不影响本笔已结算。
   */
  public static deliver(): {
    ok: boolean;
    coin: number;
    bottleName: string;
    rep: number;
    affinity?: number;
    reason?: string;
  } {
    const model = GameModel.instance;
    const order = model.currentOrder;
    if (!order) {
      return { ok: false, coin: 0, bottleName: '', rep: 0, reason: '暂无客人' };
    }

    const match = this.findMatchingBottle(order.requiredTag);
    if (!match) {
      return {
        ok: false,
        coin: 0,
        bottleName: '',
        rep: 0,
        reason: `这位客人想要带『${order.requiredTag}』感觉的瓶子，请先调和或上架对应香水`,
      };
    }

    const coin = order.rewardCoin;
    const bottleName = match.bottle.name;
    const guest = ConfigManager.getGuest(order.guestId);
    const rep = guest && typeof guest.rewardReputation === 'number' ? guest.rewardReputation : 1;

    if (match.source === 'shelf') {
      model.takeFromShelf(match.index);
    } else {
      model.takeInventoryBottle(match.index);
    }

    // 累加客人好感（最高 5 心）
    let currentAffinity = 0;
    if (order.guestId) {
      const curAff = model.getGuestAffinity(order.guestId);
      currentAffinity = Math.min(5, curAff + 1);
      model.setGuestAffinity(order.guestId, currentAffinity);
    }

    model.addReputation(rep);
    model.advanceTutorial('done');
    model.addCoins(coin);
    model.cycleNextOrder();

    return { ok: true, coin, bottleName, rep, affinity: currentAffinity };
  }
}
