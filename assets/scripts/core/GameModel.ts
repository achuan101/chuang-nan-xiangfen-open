import { PlayerSaveData, PotState, CuringState, OrderState, TutorialStep, CraftableRecipeInfo, TutorialGuideInfo } from './Types';
import { Storage } from './Storage';
import { ConfigManager } from './ConfigManager';
import { I18n } from './I18n';
import { ActionPointManager } from './ActionPointManager';
import { adEntryVisible, RewardedAd } from '../ads/RewardedAd';
import { AudioKit } from '../audio/AudioKit';

type Listener = (...args: any[]) => void;

const SAVE_VERSION = 2;

/** 存档数值字段消毒：非有限数 / 负数一律回落，杜绝 NaN 绕过扣费判定 */
function safeNum(v: any, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;
}

const TUTORIAL_ORDER: TutorialStep[] = [
  'go_window',
  'harvest',
  'go_bench',
  'blend',
  'wait_cure',
  'claim',
  'go_shop',
  'deliver',
  'done',
];

export class GameModel {
  private static _instance: GameModel;

  public static get instance(): GameModel {
    if (!this._instance) {
      this._instance = new GameModel();
      this._instance.initialize();
    }
    return this._instance;
  }

  public coins: number = 50;
  public reputation: number = 0;
  public apManager!: ActionPointManager;
  public notesInventory: Record<string, number> = {};
  public bottlesInventory: string[] = [];
  public shelfBottles: (string | null)[] = [null, null, null, null];
  public pots: PotState[] = [];
  public activeCuring: CuringState | null = null;
  public currentOrder: OrderState | null = null;
  public tutorialCompleted: boolean = false;
  public tutorialStep: TutorialStep = 'go_window';
  public shelfTier: number = 0;
  public wallpaperId: string = 'paper_warm';
  public ownedWallpaperIds: string[] = ['paper_warm'];
  public obtainedBottleIds: string[] = [];
  /** 广告位 2「补行动点」当日计数 */
  public adApDate: string = '';
  public adApCount: number = 0;
  /** 「看短片领加速卡」当日计数（接口保留，当前版本铺面未挂入口） */
  public adSpeedupDate: string = '';
  public adSpeedupCount: number = 0;
  public speedups: number = 8;
  public muted: boolean = false;
  public guestAffinity: Record<string, number> = {};

  public rugId: string = 'rug_none';
  public ownedRugIds: string[] = ['rug_none'];

  public lightId: string = 'light_none';
  public ownedLightIds: string[] = ['light_none'];

  public lastSigninDate: string = '';
  public dailyGuestRefreshUsed: number = 0;
  public dailyGuestRefreshDate: string = '';
  public readNewsDays: number[] = [];
  public currentBusinessDay: number = 1;
  public prologueShown: boolean = false;
  public tutorialCelebrated: boolean = false;

  private _booted: boolean = false;
  private _listeners: Map<string, Set<Listener>> = new Map();
  /** 见过的最大时间戳，用于校验每日计数所依赖的本地日期是否可信 */
  private _lastSeenTs: number = 0;

  public on(event: string, fn: Listener): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(fn);
  }

  public off(event: string, fn: Listener): void {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(fn);
    }
  }

  public hasListeners(event: string): boolean {
    const set = this._listeners.get(event);
    return !!set && set.size > 0;
  }

  public emit(event: string, ...args: any[]): void {
    const set = this._listeners.get(event);
    if (set) {
      set.forEach(fn => fn(...args));
    }
  }

  public initialize(): void {
    ConfigManager.init();
    if (this._booted) return;
    this._booted = true;

    const save = Storage.load();
    const eco = ConfigManager.economy;

    // 未来版本的存档不做猜测性解析，直接按新档处理（防止字段语义变化后写出坏档）
    const usableSave = save && typeof save.version === 'number' && save.version <= SAVE_VERSION ? save : null;

    if (usableSave) {
      this.coins = safeNum(usableSave.coins, 0);
      this.reputation = safeNum(usableSave.reputation, 0);
      this.apManager = new ActionPointManager(
        safeNum(usableSave.actionPoints, eco.initialActionPoints),
        safeNum(usableSave.lastApTimestamp, Date.now()),
      );
      this.notesInventory = usableSave.notesInventory || {};
      this.bottlesInventory = usableSave.bottlesInventory || [];
      this.pots = usableSave.pots || [];
      this.activeCuring = usableSave.activeCuring || null;
      this.currentOrder = usableSave.currentOrder || null;
      this.tutorialCompleted = !!usableSave.tutorialCompleted;
      this.tutorialStep = this.tutorialCompleted ? 'done' : (usableSave.tutorialStep || 'go_window');
      this.shelfTier = Math.min(Math.floor(safeNum(usableSave.shelfTier, 0)), Math.max(0, eco.shelfSlotTiers.length - 1));
      this.wallpaperId = usableSave.wallpaperId || 'paper_warm';
      this.ownedWallpaperIds = Array.isArray(usableSave.ownedWallpaperIds) && usableSave.ownedWallpaperIds.length > 0
        ? [...usableSave.ownedWallpaperIds]
        : ['paper_warm'];
      this.rugId = usableSave.rugId || 'rug_none';
      this.ownedRugIds = Array.isArray(usableSave.ownedRugIds) && usableSave.ownedRugIds.length > 0
        ? [...usableSave.ownedRugIds]
        : ['rug_none'];
      this.lightId = usableSave.lightId || 'light_none';
      this.ownedLightIds = Array.isArray(usableSave.ownedLightIds) && usableSave.ownedLightIds.length > 0
        ? [...usableSave.ownedLightIds]
        : ['light_none'];
      // 旧档可能穿着当时未拥有的布置：回落默认，避免白拿一套
      if (!this.hasWallpaper(this.wallpaperId)) this.wallpaperId = 'paper_warm';
      if (!this.hasRug(this.rugId)) this.rugId = 'rug_none';
      if (!this.hasLight(this.lightId)) this.lightId = 'light_none';
      this.obtainedBottleIds = usableSave.obtainedBottleIds || [];
      this.adApDate = usableSave.adApDate || '';
      this.adApCount = safeNum(usableSave.adApCount, 0);
      // 旧档把两个广告位共用一对计数，迁移时按当日/非当日整体继承一次
      this.adSpeedupDate = usableSave.adSpeedupDate || usableSave.adApDate || '';
      this.adSpeedupCount = safeNum(usableSave.adSpeedupCount, safeNum(usableSave.adApCount, 0));
      this.speedups = safeNum(usableSave.speedups, eco.initialSpeedups);
      this.shelfBottles = usableSave.shelfBottles ? [...usableSave.shelfBottles] : [];
      this.lastSigninDate = usableSave.lastSigninDate || '';
      this.dailyGuestRefreshUsed = safeNum(usableSave.dailyGuestRefreshUsed, 0);
      this.dailyGuestRefreshDate = usableSave.dailyGuestRefreshDate || '';
      this.muted = !!usableSave.muted;
      this.guestAffinity = usableSave.guestAffinity ? { ...usableSave.guestAffinity } : {};
      this.readNewsDays = Array.isArray(usableSave.readNewsDays) ? [...usableSave.readNewsDays] : [];
      this.currentBusinessDay = safeNum(usableSave.currentBusinessDay, 1);
      this.prologueShown = (this.tutorialCompleted || this.tutorialStep !== 'go_window') ? !!usableSave.prologueShown : false;
      this.tutorialCelebrated = usableSave.tutorialCelebrated !== undefined
        ? !!usableSave.tutorialCelebrated
        : !!usableSave.tutorialCompleted;
      this._lastSeenTs = safeNum(usableSave.lastSeenTs, 0);
    } else {
      this.coins = eco.initialCoins;
      this.reputation = 0;
      this.apManager = new ActionPointManager(eco.initialActionPoints, Date.now());
      this.notesInventory = { A: 2, E: 2 };
      this.bottlesInventory = [];
      this.shelfBottles = [];
      this.pots = [
        { id: 1, plantNoteId: 'A', plantTime: Date.now() - 180000, growDuration: eco.potGrowSeconds },
        { id: 2, plantNoteId: 'B', plantTime: Date.now(), growDuration: eco.potGrowSeconds },
        { id: 3, plantNoteId: 'E', plantTime: Date.now(), growDuration: eco.potGrowSeconds },
      ];
      this.activeCuring = null;
      const initialOrders = ConfigManager.getInitialOrders();
      this.currentOrder = initialOrders.length > 0 ? { ...initialOrders[0] } : null;
      this.tutorialCompleted = false;
      this.tutorialStep = 'go_window';
      this.shelfTier = 0;
      this.wallpaperId = 'paper_warm';
      this.ownedWallpaperIds = ['paper_warm'];
      this.rugId = 'rug_none';
      this.ownedRugIds = ['rug_none'];
      this.lightId = 'light_none';
      this.ownedLightIds = ['light_none'];
      this.obtainedBottleIds = [];
      this.adApDate = '';
      this.adApCount = 0;
      this.adSpeedupDate = '';
      this.adSpeedupCount = 0;
      this.speedups = eco.initialSpeedups || 8;
      this.lastSigninDate = '';
      this.dailyGuestRefreshUsed = 0;
      this.dailyGuestRefreshDate = '';
      this.muted = false;
      this.guestAffinity = {};
      this.readNewsDays = [];
      this.currentBusinessDay = 1;
      this.prologueShown = false;
      this.tutorialCelebrated = false;
    }

    this.normalizeShelfSlots();
    AudioKit.setMuted(this.muted);
    this.save();
  }

  public get shelfSlotCount(): number {
    const tiers = ConfigManager.economy.shelfSlotTiers || [4, 8, 12];
    const idx = Math.max(0, Math.min(this.shelfTier, tiers.length - 1));
    return tiers[idx];
  }

  public normalizeShelfSlots(): void {
    const count = this.shelfSlotCount;
    if (!this.shelfBottles) this.shelfBottles = [];
    while (this.shelfBottles.length < count) this.shelfBottles.push(null);
    if (this.shelfBottles.length > count) {
      const extra = this.shelfBottles.slice(count).filter(Boolean) as string[];
      this.shelfBottles = this.shelfBottles.slice(0, count);
      extra.forEach(id => this.bottlesInventory.push(id));
    }
  }

  public save(): void {
    const now = Date.now();
    if (now > this._lastSeenTs) {
      this._lastSeenTs = now;
    }
    const data: PlayerSaveData = {
      version: SAVE_VERSION,
      coins: this.coins,
      reputation: this.reputation,
      actionPoints: this.apManager.points,
      lastApTimestamp: this.apManager.lastTimestamp,
      notesInventory: { ...this.notesInventory },
      bottlesInventory: [...this.bottlesInventory],
      shelfBottles: [...this.shelfBottles],
      pots: this.pots.map(p => ({ ...p })),
      activeCuring: this.activeCuring ? { ...this.activeCuring } : null,
      currentOrder: this.currentOrder ? { ...this.currentOrder } : null,
      tutorialCompleted: this.tutorialCompleted,
      tutorialStep: this.tutorialStep,
      shelfTier: this.shelfTier,
      wallpaperId: this.wallpaperId,
      ownedWallpaperIds: [...this.ownedWallpaperIds],
      rugId: this.rugId,
      ownedRugIds: [...this.ownedRugIds],
      lightId: this.lightId,
      ownedLightIds: [...this.ownedLightIds],
      obtainedBottleIds: [...this.obtainedBottleIds],
      adApDate: this.adApDate,
      adApCount: this.adApCount,
      adSpeedupDate: this.adSpeedupDate,
      adSpeedupCount: this.adSpeedupCount,
      speedups: this.speedups,
      lastSigninDate: this.lastSigninDate,
      dailyGuestRefreshUsed: this.dailyGuestRefreshUsed,
      dailyGuestRefreshDate: this.dailyGuestRefreshDate,
      lastSeenTs: this._lastSeenTs,
      muted: this.muted,
      guestAffinity: { ...this.guestAffinity },
      readNewsDays: [...this.readNewsDays],
      currentBusinessDay: this.currentBusinessDay,
      prologueShown: this.prologueShown,
      tutorialCelebrated: this.tutorialCelebrated,
    };
    Storage.save(data);
  }

  /** 本机时间早于存档里记录过的时间戳时，当日计数不可信，暂停每日发放 */
  private dateUnreliable(): boolean {
    return this._lastSeenTs > 0 && Date.now() < this._lastSeenTs - 60000;
  }

  public trySignin(): { ok: boolean; msg: string } {
    if (this.dateUnreliable()) {
      return { ok: false, msg: '本机时间异常，请联网校准后再签到' };
    }
    const today = this.todayKey();
    if (this.lastSigninDate === today) {
      return { ok: false, msg: '今日已签到过啦' };
    }
    const eco = ConfigManager.economy;
    let rewardMsg = '';
    if (eco.signinRewardSpeedups) {
      this.grantSpeedup(eco.signinRewardSpeedups);
      rewardMsg += `加速卡 ×${eco.signinRewardSpeedups} `;
    }
    if (eco.signinRewardCoins) {
      this.addCoins(eco.signinRewardCoins);
      rewardMsg += `金币 ×${eco.signinRewardCoins}`;
    }
    this.lastSigninDate = today;
    this.save();
    return { ok: true, msg: `签到成功！获得：${rewardMsg}` };
  }

  public setMuted(muted: boolean): void {
    this.muted = !!muted;
    AudioKit.setMuted(this.muted);
    this.emit('muted_changed', this.muted);
    this.save();
  }

  public toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public addCoins(amount: number): void {
    if (!Number.isFinite(amount)) return;
    this.coins += amount;
    this.emit('coins_changed', this.coins);
    this.save();
  }

  public addReputation(amount: number): void {
    this.reputation += amount;
    this.emit('reputation_changed', this.reputation);
    this.save();
  }

  public consumeCoins(amount: number): boolean {
    if (!Number.isFinite(this.coins) || this.coins < amount) return false;
    this.coins -= amount;
    this.emit('coins_changed', this.coins);
    this.save();
    return true;
  }

  public consumeActionPoints(amount: number): boolean {
    const ok = this.apManager.consume(amount);
    if (ok) {
      this.emit('ap_changed');
      this.save();
    }
    return ok;
  }

  public addActionPoints(amount: number): void {
    this.apManager.add(amount);
    this.emit('ap_changed');
    this.save();
  }

  public checkApRecovery(): void {
    if (this.apManager.refresh()) {
      this.emit('ap_changed');
      this.save();
    }
  }

  public addNote(noteId: string, count: number = 1): void {
    this.notesInventory[noteId] = (this.notesInventory[noteId] || 0) + count;
    this.emit('inventory_changed');
    this.save();
  }

  public consumeNote(noteId: string, count: number = 1): boolean {
    const current = this.notesInventory[noteId] || 0;
    if (current < count) return false;
    this.notesInventory[noteId] = current - count;
    this.emit('inventory_changed');
    this.save();
    return true;
  }

  public getNoteCount(noteId: string): number {
    return this.notesInventory[noteId] || 0;
  }

  public putOnShelf(bottleId: string): boolean {
    this.normalizeShelfSlots();
    const emptyIndex = this.shelfBottles.findIndex(slot => slot === null);
    if (emptyIndex === -1) return false;
    this.shelfBottles[emptyIndex] = bottleId;
    this.emit('shelf_changed', this.shelfBottles);
    this.save();
    return true;
  }

  public takeFromShelf(index: number): string | null {
    if (index < 0 || index >= this.shelfBottles.length) return null;
    const item = this.shelfBottles[index];
    this.shelfBottles[index] = null;
    this.emit('shelf_changed', this.shelfBottles);
    this.save();
    return item;
  }

  public placeBottleOnShelf(inventoryIndex: number, slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.shelfSlotCount) return false;
    if (this.shelfBottles[slotIndex]) return false;
    if (inventoryIndex < 0 || inventoryIndex >= this.bottlesInventory.length) return false;
    const bottleId = this.bottlesInventory[inventoryIndex];
    if (bottleId === 'practice_bottle') return false;
    this.bottlesInventory.splice(inventoryIndex, 1);
    this.shelfBottles[slotIndex] = bottleId;
    this.emit('shelf_changed', this.shelfBottles);
    this.emit('inventory_changed');
    this.save();
    return true;
  }

  public removeBottleFromShelf(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= this.shelfSlotCount) return false;
    const bottleId = this.shelfBottles[slotIndex];
    if (!bottleId) return false;
    this.shelfBottles[slotIndex] = null;
    this.bottlesInventory.push(bottleId);
    this.emit('shelf_changed', this.shelfBottles);
    this.emit('inventory_changed');
    this.save();
    return true;
  }

  public takeInventoryBottle(index: number): string | null {
    if (index < 0 || index >= this.bottlesInventory.length) return null;
    const item = this.bottlesInventory.splice(index, 1)[0];
    this.emit('inventory_changed');
    this.save();
    return item;
  }

  public get practiceBottleCount(): number {
    return this.bottlesInventory.filter(id => id === 'practice_bottle').length;
  }

  /**
   * 回收全部练习瓶。按钮写的是「回收 ×N」，一次只删 1 个会让玩家连点 N 次、
   * 而每次金币提示都说「回收练习瓶」，读起来像坏了。
   */
  public sellPracticeBottle(): { ok: boolean; coin: number; count: number; reason?: string } {
    const count = this.practiceBottleCount;
    if (count === 0) {
      return { ok: false, coin: 0, count: 0, reason: '没有练习瓶可回收' };
    }
    const bottle = ConfigManager.getBottle('practice_bottle');
    const price = bottle && typeof bottle.price === 'number' ? bottle.price : 8;
    this.bottlesInventory = this.bottlesInventory.filter(id => id !== 'practice_bottle');
    const coin = price * count;
    this.addCoins(coin);
    this.emit('inventory_changed');
    this.save();
    return { ok: true, coin, count };
  }

  public markBottleObtained(bottleId: string): void {
    if (this.obtainedBottleIds.indexOf(bottleId) >= 0) return;
    const bottle = ConfigManager.getBottle(bottleId);
    if (!bottle || bottle.album === false) return;
    this.obtainedBottleIds.push(bottleId);
    this.emit('album_changed');
    this.save();
  }

  public hasObtained(bottleId: string): boolean {
    return this.obtainedBottleIds.indexOf(bottleId) >= 0;
  }

  public upgradeShelf(): { ok: boolean; reason?: string } {
    const eco = ConfigManager.economy;
    const next = this.shelfTier + 1;
    if (next >= eco.shelfSlotTiers.length) {
      return { ok: false, reason: '货架已经是最高一档' };
    }
    const cost = eco.shelfUpgradeCosts[this.shelfTier];
    if (typeof cost !== 'number' || !Number.isFinite(cost)) {
      return { ok: false, reason: '该档升级价未配置，暂时无法升级' };
    }
    if (!this.consumeCoins(cost)) {
      return { ok: false, reason: `金币不足（需要 ${cost}）` };
    }
    this.shelfTier = next;
    this.normalizeShelfSlots();
    this.emit('shelf_changed', this.shelfBottles);
    this.save();
    return { ok: true };
  }

  public hasWallpaper(id: string): boolean {
    return id === 'paper_warm' || this.ownedWallpaperIds.indexOf(id) >= 0;
  }

  public setWallpaper(id: string): { ok: boolean; reason?: string } {
    if (this.wallpaperId === id) return { ok: true };
    const paper = ConfigManager.decor.wallpapers.find(w => w.id === id);
    if (!paper) return { ok: false, reason: '没有这套窗纸' };

    if (!this.hasWallpaper(id)) {
      if (paper.cost > 0 && !this.consumeCoins(paper.cost)) {
        return { ok: false, reason: `金币不足（需要 ${paper.cost}）` };
      }
      this.ownedWallpaperIds.push(id);
    }

    this.wallpaperId = id;
    this.emit('decor_changed', id);
    this.save();
    return { ok: true };
  }

  public hasRug(id: string): boolean {
    return id === 'rug_none' || this.ownedRugIds.indexOf(id) >= 0;
  }

  public setRug(id: string): { ok: boolean; reason?: string } {
    if (this.rugId === id) return { ok: true };
    const rug = ConfigManager.decor.rugs?.find(r => r.id === id);
    if (!rug) return { ok: false, reason: '没有这套地毯' };

    if (!this.hasRug(id)) {
      if (rug.cost > 0 && !this.consumeCoins(rug.cost)) {
        return { ok: false, reason: `金币不足（需要 ${rug.cost}）` };
      }
      this.ownedRugIds.push(id);
    }

    this.rugId = id;
    this.emit('decor_changed', id);
    this.save();
    return { ok: true };
  }

  public hasLight(id: string): boolean {
    return id === 'light_none' || this.ownedLightIds.indexOf(id) >= 0;
  }

  public setLight(id: string): { ok: boolean; reason?: string } {
    if (this.lightId === id) return { ok: true };
    const light = ConfigManager.decor.lights?.find(l => l.id === id);
    if (!light) return { ok: false, reason: '没有这盏灯' };

    if (!this.hasLight(id)) {
      if (light.cost > 0 && !this.consumeCoins(light.cost)) {
        return { ok: false, reason: `金币不足（需要 ${light.cost}）` };
      }
      this.ownedLightIds.push(id);
    }

    this.lightId = id;
    this.emit('decor_changed', id);
    this.save();
    return { ok: true };
  }

  public todayKey(): string {
    const d = new Date();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  public consumeSpeedup(): boolean {
    if (this.speedups <= 0) return false;
    this.speedups -= 1;
    this.emit('speedup_changed', this.speedups);
    this.save();
    return true;
  }

  public grantSpeedup(amount: number = 1): void {
    this.speedups += Math.max(0, amount);
    this.emit('speedup_changed', this.speedups);
    this.save();
  }

  public tryWatchAdForSpeedupCard(onDone: (ok: boolean, msg: string) => void): void {
    if (this.dateUnreliable()) {
      onDone(false, '本机时间异常，短片奖励暂停');
      return;
    }
    const today = this.todayKey();
    if (this.adSpeedupDate !== today) {
      this.adSpeedupDate = today;
      this.adSpeedupCount = 0;
      this.save();
    }
    if (this.adSpeedupCount >= ConfigManager.adSpeedupDailyLimit) {
      onDone(false, '今日领取次数已用完');
      return;
    }
    RewardedAd.show(
      () => {
        this.adSpeedupCount += 1;
        this.grantSpeedup(1);
        onDone(true, '获得 1 张加速卡');
      },
      () => {
        onDone(false, '短片未完整观看或暂未开放');
      }
    );
  }

  /** SPEC 广告位 2：看短片补行动点，每日 eco.adApDailyLimit 次 */
  public tryWatchAdForActionPoints(onDone: (ok: boolean, msg: string) => void): void {
    const eco = ConfigManager.economy;
    if (this.dateUnreliable()) {
      onDone(false, '本机时间异常，短片奖励暂停');
      return;
    }
    if (this.apManager.points >= eco.maxActionPoints) {
      onDone(false, `行动点已满 ${eco.maxActionPoints}/${eco.maxActionPoints}`);
      return;
    }
    const today = this.todayKey();
    if (this.adApDate !== today) {
      this.adApDate = today;
      this.adApCount = 0;
      this.save();
    }
    if (this.adApCount >= eco.adApDailyLimit) {
      onDone(false, '今日补充次数已用完');
      return;
    }
    RewardedAd.show(
      () => {
        this.adApCount += 1;
        this.addActionPoints(eco.adApRestore);
        onDone(true, `行动点 +${eco.adApRestore}`);
      },
      () => {
        onDone(false, '短片未完整观看或暂未开放');
      }
    );
  }

  public advanceTutorial(to: TutorialStep): void {
    if (this.tutorialCompleted) return;
    const fromIdx = TUTORIAL_ORDER.indexOf(this.tutorialStep);
    const toIdx = TUTORIAL_ORDER.indexOf(to);
    if (toIdx < 0 || toIdx <= fromIdx) return;
    this.tutorialStep = to;
    if (to === 'done') {
      this.tutorialCompleted = true;
    }
    this.emit('tutorial_changed', to);
    this.save();
  }

  /** 引导横幅「跳过」：直接标记完成，后续按复访态提示 */
  public skipTutorial(): void {
    if (this.tutorialCompleted) return;
    this.tutorialStep = 'done';
    this.tutorialCompleted = true;
    this.tutorialCelebrated = true;
    this.emit('tutorial_changed', 'done');
    this.save();
  }

  public resetTutorial(): void {
    this.tutorialCompleted = false;
    this.tutorialStep = 'go_window';
    this.prologueShown = false;
    this.tutorialCelebrated = false;
    this.save();
    this.emit('tutorial_changed', this.tutorialStep);
  }

  public markTutorialCelebrated(): void {
    this.tutorialCelebrated = true;
    this.save();
  }

  public markPrologueShown(): void {
    this.prologueShown = true;
    this.save();
    this.emit('prologue_finished');
    this.emit('tutorial_changed', this.tutorialStep);
  }

  public tutorialInfo(screen: 'shop' | 'window' | 'bench'): TutorialGuideInfo | null {
    if (this.tutorialCompleted) return null;

    switch (this.tutorialStep) {
      case 'go_window':
      case 'harvest': {
        const phase = 1;
        const totalPhases = 4;
        const phaseName = I18n.t('tut_phase_1');
        const title = I18n.t('tut_title_1');
        const story = I18n.t('tut_story_1');
        if (screen === 'window') {
          return {
            phase,
            totalPhases,
            phaseName,
            title,
            story,
            tip: I18n.t('tut_tip_harvest'),
            actionText: I18n.t('tut_action_harvest'),
            actionAct: 'harvest',
          };
        }
        return {
          phase,
          totalPhases,
          phaseName,
          title,
          story,
          tip: I18n.t('tut_tip_go_window'),
          actionText: I18n.t('tut_action_window'),
          actionAct: 'goto-window',
        };
      }

      case 'go_bench':
      case 'blend': {
        const phase = 2;
        const totalPhases = 4;
        const phaseName = I18n.t('tut_phase_2');
        const title = I18n.t('tut_title_2');
        const story = I18n.t('tut_story_2');
        if (screen === 'bench') {
          return {
            phase,
            totalPhases,
            phaseName,
            title,
            story,
            tip: I18n.t('tut_tip_blend'),
            actionText: I18n.t('tut_action_blend'),
            actionAct: 'blend',
          };
        }
        return {
          phase,
          totalPhases,
          phaseName,
          title,
          story,
          tip: I18n.t('tut_tip_go_bench'),
          actionText: I18n.t('tut_action_bench'),
          actionAct: 'goto-bench',
        };
      }

      case 'wait_cure':
      case 'claim': {
        const phase = 3;
        const totalPhases = 4;
        const phaseName = I18n.t('tut_phase_3');
        const isComplete = this.tutorialStep === 'claim' || (this.activeCuring && Date.now() >= this.activeCuring.startTime + this.activeCuring.durationSeconds * 1000);
        if (isComplete) {
          const title = I18n.t('tut_title_3_done');
          const story = I18n.t('tut_story_3_done');
          return {
            phase,
            totalPhases,
            phaseName,
            title,
            story,
            tip: I18n.t('tut_tip_claim'),
            actionText: screen === 'bench' ? I18n.t('tut_action_claim') : I18n.t('tut_action_bench'),
            actionAct: screen === 'bench' ? 'claim' : 'goto-bench',
          };
        }
        const title = I18n.t('tut_title_3_cure');
        const story = I18n.t('tut_story_3_cure');
        return {
          phase,
          totalPhases,
          phaseName,
          title,
          story,
          tip: I18n.t('tut_tip_speedup'),
          actionText: screen === 'bench' ? I18n.t('tut_action_speedup') : I18n.t('tut_action_bench'),
          actionAct: screen === 'bench' ? 'speedup' : 'goto-bench',
        };
      }

      case 'go_shop':
      case 'deliver': {
        const phase = 4;
        const totalPhases = 4;
        const phaseName = I18n.t('tut_phase_4');
        const title = I18n.t('tut_title_4');
        const story = I18n.t('tut_story_4');
        if (screen === 'shop') {
          return {
            phase,
            totalPhases,
            phaseName,
            title,
            story,
            tip: I18n.t('tut_tip_deliver'),
            actionText: I18n.t('tut_action_deliver'),
            actionAct: 'deliver',
          };
        }
        return {
          phase,
          totalPhases,
          phaseName,
          title,
          story,
          tip: I18n.t('tut_tip_go_shop'),
          actionText: I18n.t('tut_action_shop'),
          actionAct: 'goto-shop',
        };
      }

      default:
        return null;
    }
  }

  public tutorialTip(): string {
    if (this.tutorialCompleted) return '';
    const stepKey = `tut_step_${this.tutorialStep}`;
    const t = I18n.t(stepKey);
    if (t !== stepKey) return t;
    return '';
  }

  public cycleNextOrder(): void {
    const all = ConfigManager.getInitialOrders();
    if (all.length === 0) {
      this.currentOrder = null;
      return;
    }
    const currentId = this.currentOrder ? this.currentOrder.id : '';
    const idx = all.findIndex(o => o.id === currentId);
    const next = all[(idx + 1) % all.length];
    this.currentOrder = { ...next };
    this.save();
    this.emit('order_changed');
  }

  public refreshGuestOrder(): { ok: boolean; msg?: string } {
    if (!this.tutorialCompleted) {
      return { ok: false, msg: '引导中不可更换客人' };
    }
    const today = this.todayKey();
    if (this.dailyGuestRefreshDate !== today) {
      this.dailyGuestRefreshDate = today;
      this.dailyGuestRefreshUsed = 0;
    }
    const freeDaily = ConfigManager.economy.refreshOrderFreeDaily ?? 1;
    const freeLeft = Math.max(0, freeDaily - this.dailyGuestRefreshUsed);
    if (freeLeft > 0) {
      this.dailyGuestRefreshUsed += 1;
      this.cycleNextOrder();
      this.save();
      return { ok: true, msg: `已免费换客（今日剩 ${freeDaily - this.dailyGuestRefreshUsed} 次免费）` };
    }
    const cost = ConfigManager.economy.refreshOrderCoinCost || 5;
    if (this.coins < cost) {
      return { ok: false, msg: `今日免费次数已用完，换客需要 ${cost} 金币` };
    }
    this.consumeCoins(cost);
    this.cycleNextOrder();
    return { ok: true, msg: `已换一位客人（-${cost} 金币）` };
  }

  public guestRefreshButtonLabel(): string {
    const today = this.todayKey();
    const used = this.dailyGuestRefreshDate === today ? this.dailyGuestRefreshUsed : 0;
    const freeDaily = ConfigManager.economy.refreshOrderFreeDaily ?? 1;
    const freeLeft = Math.max(0, freeDaily - used);
    if (freeLeft > 0) {
      return `换一位客人（免费 ×${freeLeft}）`;
    }
    const cost = ConfigManager.economy.refreshOrderCoinCost || 5;
    return `换一位客人（${cost}金币）`;
  }

  public get currentUnlockDay(): number {
    const day3Rep = ConfigManager.economy.noteUnlockDay3Reputation || 3;
    if (this.reputation >= day3Rep) return 3;
    if (this.tutorialCompleted || this.reputation >= 1) return 2;
    return 1;
  }

  public isNoteUnlocked(noteId: string): boolean {
    const note = ConfigManager.getNote(noteId);
    if (!note) return false;
    return (note.unlockDay || 1) <= this.currentUnlockDay;
  }

  public getNextRotatedNote(potId: number, currentNoteId: string): string {
    const rotations = ConfigManager.economy.potRotations || {
      '1': ['A', 'B', 'C', 'F'],
      '2': ['B', 'D', 'E', 'G'],
      '3': ['E', 'C', 'A', 'H'],
    };
    const list = rotations[String(potId)] || ['A', 'B', 'E'];
    const idx = list.indexOf(currentNoteId);
    for (let step = 1; step <= list.length; step++) {
      const nextId = list[(idx + step) % list.length];
      if (this.isNoteUnlocked(nextId)) {
        return nextId;
      }
    }
    return currentNoteId;
  }

  public setGuestAffinity(guestId: string, rating: number): void {
    const val = Math.max(0, Math.min(5, Math.floor(rating)));
    this.guestAffinity[guestId] = val;
    this.emit('affinity_changed', guestId, val);
    this.save();
  }

  public getGuestAffinity(guestId: string): number {
    return typeof this.guestAffinity[guestId] === 'number' ? this.guestAffinity[guestId] : 0;
  }

  public getAffinityTitle(rating: number): string {
    if (rating >= 5) return '生平知己';
    if (rating >= 4) return '莫逆之交';
    if (rating >= 3) return '知心常客';
    if (rating >= 2) return '意气相投';
    if (rating >= 1) return '一面之缘';
    return '淡如轻风';
  }

  public switchPotSeed(potIndex: number, noteId: string): boolean {
    const pot = this.pots[potIndex];
    if (!pot) return false;
    pot.plantNoteId = noteId;
    pot.targetNoteId = noteId;
    pot.plantTime = Date.now();
    this.emit('pot_seed_changed', potIndex, noteId);
    this.save();
    return true;
  }

  public hasReadNews(day: number): boolean {
    return this.readNewsDays.indexOf(day) >= 0;
  }

  public markNewsRead(day: number): void {
    if (!this.hasReadNews(day)) {
      this.readNewsDays.push(day);
      this.save();
    }
  }

  public advanceBusinessDay(): void {
    this.currentBusinessDay += 1;
    this.save();
  }

  public getCraftableRecipes(): CraftableRecipeInfo[] {
    const recipes = ConfigManager.getAllRecipes();
    const res: CraftableRecipeInfo[] = [];
    for (const r of recipes) {
      if (r.result !== 'success' || !r.inputs || r.inputs.length !== 2) continue;
      const a = r.inputs[0];
      const b = r.inputs[1];
      const needA = a === b ? 2 : 1;
      const needB = a === b ? 2 : 1;
      if (this.getNoteCount(a) >= needA && this.getNoteCount(b) >= needB) {
        const bottle = ConfigManager.getBottle(r.bottleId);
        const na = ConfigManager.getNote(a);
        const nb = ConfigManager.getNote(b);
        res.push({
          id: r.id,
          bottleId: r.bottleId,
          bottleName: bottle ? bottle.name : r.bottleId,
          noteA: a,
          noteB: b,
          noteAName: na ? na.name : a,
          noteBName: nb ? nb.name : b,
        });
      }
    }
    return res;
  }

  /**
   * 点「研制」时槽位没摆满，替玩家智能凑两味香调。
   * 只凑料不研制：让玩家看清确认后再点第二次才扣行动点。
   */
  public autoFillBlendSlots(
    noteA: string | null,
    noteB: string | null,
  ): { kind: 'filled'; noteA: string; noteB: string }
    | { kind: 'no_stock' }
    | { kind: 'no_partner' } {
    if (noteA && noteB) return { kind: 'no_partner' };

    if (!noteA && !noteB) {
      const hit = this.getCraftableRecipes()[0];
      if (hit) return { kind: 'filled', noteA: hit.noteA, noteB: hit.noteB };
      const stocked = ConfigManager.getAllNotes().filter(n => this.getNoteCount(n.id) > 0);
      if (stocked.length >= 2) return { kind: 'filled', noteA: stocked[0].id, noteB: stocked[1].id };
      if (stocked.length === 1 && this.getNoteCount(stocked[0].id) >= 2) {
        return { kind: 'filled', noteA: stocked[0].id, noteB: stocked[0].id };
      }
      return { kind: 'no_stock' };
    }

    const fixed = noteA || noteB;
    const partner = this.findPartnerNote(fixed);
    return partner ? { kind: 'filled', noteA: fixed, noteB: partner } : { kind: 'no_partner' };
  }

  /** 给已定下的那味找搭档：先凑成配方，凑不成再退到库存里任意一味 */
  private findPartnerNote(fixed: string): string | null {
    for (const r of ConfigManager.getAllRecipes()) {
      if (r.result !== 'success' || !r.inputs || r.inputs.length !== 2) continue;
      const [x, y] = r.inputs;
      if (x === fixed && this.getNoteCount(y) >= (y === fixed ? 2 : 1)) return y;
      if (y === fixed && this.getNoteCount(x) >= (x === fixed ? 2 : 1)) return x;
    }
    const other = ConfigManager.getAllNotes().find(n => this.getNoteCount(n.id) >= (n.id === fixed ? 2 : 1));
    return other ? other.id : null;
  }
}

