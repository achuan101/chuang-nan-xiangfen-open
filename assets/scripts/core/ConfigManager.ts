import {
  NoteItem,
  RecipeItem,
  BottleItem,
  GuestItem,
  EconomyConfig,
  OrderState,
  DecorConfig,
  NewsItem,
  ComicPanel,
} from './Types';

import economyRaw from '../../tables/economy.json';
import notesRaw from '../../tables/notes.json';
import recipesRaw from '../../tables/recipes.json';
import bottlesRaw from '../../tables/bottles.json';
import guestsRaw from '../../tables/guests.json';
import ordersRaw from '../../tables/orders.json';
import decorRaw from '../../tables/decor.json';
import corpusRaw from '../../tables/corpus.json';
import newsRaw from '../../tables/news.json';
import prologueRaw from '../../tables/prologue.json';

const ECONOMY_DEFAULTS: EconomyConfig = {
  maxActionPoints: 10000,
  apRecoverMinutes: 5,
  gatherCost: 1,
  blendCost: 2,
  curingSeconds: 90,
  potGrowSeconds: 180,
  initialCoins: 10000,
  initialActionPoints: 10000,
  initialSpeedups: 10000,
  adApRestore: 5,
  adApDailyLimit: 3,
  adSpeedupDailyLimit: 3,
  failRefundCount: 1,
  refreshOrderCoinCost: 5,
  shelfSlotTiers: [4, 8, 12],
  shelfUpgradeCosts: [200, 600],
  potRotations: {
    '1': ['A', 'B', 'C', 'F'],
    '2': ['B', 'D', 'E', 'G'],
    '3': ['E', 'C', 'A', 'H'],
  },
  noteUnlockDay3Reputation: 3,
};

export class ConfigManager {
  private static _economy: EconomyConfig = { ...ECONOMY_DEFAULTS, ...(economyRaw as Partial<EconomyConfig>) };
  private static _notes: Map<string, NoteItem> = new Map();
  private static _recipes: RecipeItem[] = recipesRaw as RecipeItem[];
  private static _bottles: Map<string, BottleItem> = new Map();
  private static _guests: Map<string, GuestItem> = new Map();
  private static _orders: OrderState[] = ordersRaw as OrderState[];
  private static _decor: DecorConfig = decorRaw as DecorConfig;
  private static _initialized: boolean = false;

  public static init(): void {
    if (this._initialized) return;

    (notesRaw as NoteItem[]).forEach(n => this._notes.set(n.id, n));
    (bottlesRaw as BottleItem[]).forEach(b => {
      if (!b.tags) b.tags = [];
      this._bottles.set(b.id, b);
    });
    (guestsRaw as GuestItem[]).forEach(g => this._guests.set(g.id, g));

    this._initialized = true;
    console.log('[ConfigManager] Tables initialized successfully');
  }

  public static get economy(): EconomyConfig {
    this.init();
    const e = this._economy;
    if (typeof e.adSpeedupDailyLimit !== 'number') {
      e.adSpeedupDailyLimit = e.adApDailyLimit;
    }
    return e;
  }

  /** 每日领加速卡上限（优先新字段） */
  public static get adSpeedupDailyLimit(): number {
    const e = this.economy;
    return typeof e.adSpeedupDailyLimit === 'number' ? e.adSpeedupDailyLimit : e.adApDailyLimit;
  }

  public static get decor(): DecorConfig {
    this.init();
    return this._decor;
  }

  public static getNote(id: string): NoteItem | undefined {
    this.init();
    return this._notes.get(id);
  }

  public static getAllNotes(): NoteItem[] {
    this.init();
    return Array.from(this._notes.values());
  }

  public static getBottle(id: string): BottleItem | undefined {
    this.init();
    return this._bottles.get(id);
  }

  public static getAllRecipes(): RecipeItem[] {
    this.init();
    return this._recipes;
  }

  public static getAllBottles(): BottleItem[] {
    this.init();
    return Array.from(this._bottles.values());
  }

  public static getAlbumBottles(): BottleItem[] {
    return this.getAllBottles().filter(b => b.album !== false && b.id !== 'practice_bottle');
  }

  public static getGuest(id: string): GuestItem | undefined {
    this.init();
    return this._guests.get(id);
  }

  public static getAllGuests(): GuestItem[] {
    this.init();
    return Array.from(this._guests.values());
  }

  public static getInitialOrders(): OrderState[] {
    this.init();
    return this._orders.map(o => ({ ...o }));
  }

  public static bottleHasTag(bottleId: string, tag: string): boolean {
    const bottle = this.getBottle(bottleId);
    if (!bottle || !bottle.tags) return false;
    return bottle.tags.indexOf(tag) >= 0;
  }

  /**
   * 查表精确匹配两香调，顺序无关。
   * 未命中再走「两香标签组合」兜底：两香并集要凑齐配方标签，
   * 且不能由其中一香单独凑齐（避免茶汤自带木+静就配出深林檀木）。
   * 同一香调两份不走标签兜底，落练习瓶。
   */
  public static matchRecipe(noteIds: string[]): { bottleId: string; result: 'success' | 'fail' } {
    this.init();
    const sortedInput = [...noteIds].sort();

    for (const recipe of this._recipes) {
      if (recipe.inputs.length === sortedInput.length && recipe.inputs.length > 0) {
        const sortedRecipeInputs = [...recipe.inputs].sort();
        const isMatch = sortedRecipeInputs.every((val, idx) => val === sortedInput[idx]);
        if (isMatch) {
          return { bottleId: recipe.bottleId, result: recipe.result };
        }
      }
    }

    const uniqueIds = new Set(noteIds);
    if (uniqueIds.size < 2) {
      return this.practiceFallback();
    }

    const tagSets = noteIds.map(id => {
      const note = this.getNote(id);
      return new Set<string>(note && note.tags ? note.tags : []);
    });
    const union = new Set<string>();
    tagSets.forEach(s => s.forEach(t => union.add(t)));

    const tagMatches: RecipeItem[] = [];

    for (const recipe of this._recipes) {
      if (!recipe.match || !recipe.match.startsWith('tags:')) continue;
      const reqTags = recipe.match.substring(5).split('+').map(t => t.trim()).filter(Boolean);
      if (reqTags.length === 0) continue;
      if (!reqTags.every(rt => union.has(rt))) continue;
      const oneNoteAlreadyHasAll = tagSets.some(s => reqTags.every(rt => s.has(rt)));
      if (oneNoteAlreadyHasAll) continue;
      tagMatches.push(recipe);
    }

    // 多条标签规则同时命中时结果取决于表内行序，视为歧义 → 练习瓶（改表顺序不会改结果）
    if (tagMatches.length === 1) {
      return { bottleId: tagMatches[0].bottleId, result: tagMatches[0].result };
    }

    return this.practiceFallback();
  }

  private static practiceFallback(): { bottleId: string; result: 'success' | 'fail' } {
    const fallback = this._recipes.find(r => r.id === 'fallback_practice');
    return {
      bottleId: fallback ? fallback.bottleId : 'practice_bottle',
      result: 'fail',
    };
  }

  private static _lastGuestDialogue: Map<string, string> = new Map();
  private static _lastGuestFeedback: Map<string, string> = new Map();

  private static getRawCorpus(): any {
    const raw = corpusRaw as any;
    return raw?.default ?? raw;
  }

  public static getGuestCorpus(guestId: string): { dialogues?: string[]; deliveredFeedback?: string[] } | null {
    const raw = this.getRawCorpus();
    const g = raw?.guests?.[guestId];
    return g || null;
  }

  public static getRandomGuestDialogue(guestId: string, fallback: string): string {
    const c = this.getGuestCorpus(guestId);
    if (c && c.dialogues && c.dialogues.length > 0) {
      const list = c.dialogues;
      if (list.length === 1) return list[0];
      const prev = this._lastGuestDialogue.get(guestId);
      const candidates = list.filter(d => d !== prev);
      const chosen = candidates[Math.floor(Math.random() * candidates.length)] || list[0];
      this._lastGuestDialogue.set(guestId, chosen);
      return chosen;
    }
    return fallback;
  }

  public static getRandomGuestFeedback(guestId: string, fallback: string): string {
    const c = this.getGuestCorpus(guestId);
    if (c && c.deliveredFeedback && c.deliveredFeedback.length > 0) {
      const list = c.deliveredFeedback;
      if (list.length === 1) return list[0];
      const prev = this._lastGuestFeedback.get(guestId);
      const candidates = list.filter(f => f !== prev);
      const chosen = candidates[Math.floor(Math.random() * candidates.length)] || list[0];
      this._lastGuestFeedback.set(guestId, chosen);
      return chosen;
    }
    return fallback;
  }

  public static getRandomGuestShortReview(guestId: string, fallback?: string): string {
    const raw = this.getRawCorpus();
    const reviews: string[] | undefined = raw?.guestShortReviews?.[guestId];
    if (reviews && reviews.length > 0) {
      const idx = Math.floor(Math.random() * reviews.length);
      const clean = reviews[idx].replace(/^.+留评：/, '');
      return clean;
    }
    return fallback || '‘满室余香，窗暖风轻，引人流连。’';
  }

  private static _news: NewsItem[] = newsRaw as NewsItem[];

  public static getAllNews(): NewsItem[] {
    return this._news;
  }

  public static getNewsByDay(day: number): NewsItem | undefined {
    return this._news.find(n => n.day === day);
  }

  public static getProloguePanels(): ComicPanel[] {
    return (prologueRaw as ComicPanel[]) || [];
  }
}

