import { GameModel } from '../core/GameModel';
import { ConfigManager } from '../core/ConfigManager';

export class BlendSystem {
  /** 列出某香调在成功配方里可搭配的另一香调名称（去重，最多 4 个） */
  public static partnerHints(noteId: string): string[] {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const recipe of ConfigManager.getAllRecipes()) {
      if (recipe.result !== 'success' || !recipe.inputs || recipe.inputs.length !== 2) continue;
      const [a, b] = recipe.inputs;
      let other: string | null = null;
      if (a === noteId) other = b;
      else if (b === noteId) other = a;
      if (!other || seen.has(other)) continue;
      seen.add(other);
      const n = ConfigManager.getNote(other);
      names.push(n ? n.name : other);
      if (names.length >= 4) break;
    }
    return names;
  }

  /** 选料预览 / 失败说明 */
  public static describePair(noteA: string, noteB: string): { willSucceed: boolean; tip: string } {
    const na = ConfigManager.getNote(noteA);
    const nb = ConfigManager.getNote(noteB);
    const nameA = na ? na.name : noteA;
    const nameB = nb ? nb.name : noteB;
    const match = ConfigManager.matchRecipe([noteA, noteB]);

    if (match.result === 'success') {
      const bottle = ConfigManager.getBottle(match.bottleId);
      const bottleName = bottle ? bottle.name : match.bottleId;
      return {
        willSucceed: true,
        tip: `有机会调出「${bottleName}」，消耗 2 点行动点`,
      };
    }

    const same = noteA === noteB;
    let tip = same
      ? `「${nameA}」不能和自己合成正式香水，只会得到练习瓶（可在铺面回收）。`
      : `「${nameA}」+「${nameB}」没有对应配方，合不出正式香水，只会得到练习瓶（可在铺面回收）。`;

    const hints = new Set<string>();
    for (const id of [noteA, noteB]) {
      for (const h of this.partnerHints(id)) hints.add(h);
    }
    hints.delete(nameA);
    hints.delete(nameB);
    const hintList = [...hints].slice(0, 4);
    if (hintList.length > 0) {
      tip += same
        ? `「${nameA}」可试搭配：${hintList.join('、')}。`
        : `可试搭配：${hintList.join('、')}。`;
    } else {
      tip += '换两种不同香调再试。';
    }
    return { willSucceed: false, tip };
  }

  public static canBlend(noteA: string | null, noteB: string | null): { ok: boolean; reason?: string } {
    if (!noteA || !noteB) {
      return { ok: false, reason: '请放入两个香调' };
    }
    const model = GameModel.instance;
    const eco = ConfigManager.economy;
    if (!model.apManager.hasEnough(eco.blendCost)) {
      return { ok: false, reason: `行动点不足（需要 ${eco.blendCost} 点）` };
    }
    if (noteA === noteB) {
      if (model.getNoteCount(noteA) < 2) {
        return { ok: false, reason: `香调【${ConfigManager.getNote(noteA)?.name}】库存不足 2 份` };
      }
    } else {
      if (model.getNoteCount(noteA) < 1) {
        return { ok: false, reason: `香调【${ConfigManager.getNote(noteA)?.name}】库存不足` };
      }
      if (model.getNoteCount(noteB) < 1) {
        return { ok: false, reason: `香调【${ConfigManager.getNote(noteB)?.name}】库存不足` };
      }
    }
    if (model.activeCuring !== null) {
      return { ok: false, reason: '当前已有正在定香的瓶子' };
    }
    return { ok: true };
  }

  public static startBlend(noteA: string, noteB: string): {
    success: boolean;
    bottleId: string;
    result: 'success' | 'fail';
    refundNoteId?: string;
  } {
    const check = this.canBlend(noteA, noteB);
    if (!check.ok) {
      throw new Error(check.reason);
    }

    const model = GameModel.instance;
    const eco = ConfigManager.economy;

    model.consumeActionPoints(eco.blendCost);
    model.consumeNote(noteA, 1);
    model.consumeNote(noteB, 1);

    const match = ConfigManager.matchRecipe([noteA, noteB]);

    if (match.result === 'fail') {
      const refundCount = Math.max(0, eco.failRefundCount || 1);
      let refundNoteId: string | undefined;
      if (refundCount > 0) {
        refundNoteId = Math.random() < 0.5 ? noteA : noteB;
        model.addNote(refundNoteId, refundCount);
      }
      model.bottlesInventory.push(match.bottleId);
      model.emit('inventory_changed');
      model.save();
      model.emit('blend_failed', { bottleId: match.bottleId, refundNoteId });
      return { success: false, bottleId: match.bottleId, result: 'fail', refundNoteId };
    }

    model.activeCuring = {
      bottleId: match.bottleId,
      startTime: Date.now(),
      durationSeconds: eco.curingSeconds,
    };
    model.save();
    model.emit('curing_started', model.activeCuring);
    model.advanceTutorial('wait_cure');

    return {
      success: true,
      bottleId: match.bottleId,
      result: 'success',
    };
  }

  public static getRemainingCuringSeconds(): number {
    const curing = GameModel.instance.activeCuring;
    if (!curing) return 0;
    const now = Date.now();
    if (now < curing.startTime) {
      curing.startTime = now;
    }
    const elapsed = Math.floor((now - curing.startTime) / 1000);
    const remain = curing.durationSeconds - elapsed;
    return Math.max(0, remain);
  }

  public static isCuringComplete(): boolean {
    return this.getRemainingCuringSeconds() <= 0;
  }

  public static speedUpCuring(onDone?: () => void): boolean {
    const model = GameModel.instance;
    if (!model.activeCuring) return false;
    if (!model.consumeSpeedup()) return false;
    this.completeCuring();
    if (onDone) onDone();
    return true;
  }

  /** 直接结算当前定香（加速卡与短片共用，调用方负责扣自己的代价） */
  public static completeCuring(): void {
    const model = GameModel.instance;
    if (!model.activeCuring) return;
    model.activeCuring.startTime = Date.now() - model.activeCuring.durationSeconds * 1000 - 1000;
    model.save();
    model.emit('curing_completed', model.activeCuring.bottleId);
    if (BlendSystem.isCuringComplete()) {
      model.advanceTutorial('claim');
    }
  }

  public static claimBottle(): { bottleId: string; putOnShelf: boolean } | null {
    const model = GameModel.instance;
    if (!model.activeCuring || !this.isCuringComplete()) {
      return null;
    }
    const bottleId = model.activeCuring.bottleId;
    model.activeCuring = null;
    model.markBottleObtained(bottleId);

    const putOnShelf = model.putOnShelf(bottleId);
    if (!putOnShelf) {
      model.bottlesInventory.push(bottleId);
      model.emit('inventory_changed');
      model.save();
    }

    model.emit('bottle_claimed', bottleId);
    model.advanceTutorial('go_shop');
    return { bottleId, putOnShelf };
  }
}
