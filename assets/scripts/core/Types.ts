export interface NoteItem {
  id: string;
  name: string;
  colorHex: string;
  tags: string[];
  icon: string;
  unlockDay: number;
}

export interface RecipeItem {
  id: string;
  inputs: string[];
  match: string;
  bottleId: string;
  result: 'success' | 'fail';
}

export interface BottleItem {
  id: string;
  name: string;
  shape: 'spray' | 'frost_square' | 'round' | 'small_round';
  colorDots: string[];
  tags: string[];
  blurb: string;
  price: number;
  sprite: string;
  album: boolean;
  lore?: string;
}

export interface GuestItem {
  id: string;
  name: string;
  avatar: string;
  dialog: string;
  requiredTag: string;
  baseRewardCoin: number;
  rewardReputation: number;
}

export interface EconomyConfig {
  maxActionPoints: number;
  apRecoverMinutes: number;
  gatherCost: number;
  blendCost: number;
  curingSeconds: number;
  potGrowSeconds: number;
  initialCoins: number;
  initialActionPoints: number;
  initialSpeedups: number;
  adApRestore: number;
  /** 广告位 2「补行动点」每日上限 */
  adApDailyLimit: number;
  /** 「看短片领加速卡」每日上限；缺省时回退 adApDailyLimit */
  adSpeedupDailyLimit?: number;
  failRefundCount: number;
  refreshOrderCoinCost?: number;
  /** 每日免费换客次数，用尽后再扣金币 */
  refreshOrderFreeDaily?: number;
  shelfSlotTiers: number[];
  shelfUpgradeCosts: number[];
  potRotations?: Record<string, string[]>;
  signinRewardSpeedups?: number;
  signinRewardCoins?: number;
  /** 口碑达到该值后解锁 unlockDay=3 的香调 */
  noteUnlockDay3Reputation?: number;
}

export interface ShelfTierItem {
  id: string;
  name: string;
  slots: number;
  cost: number;
}

export interface DecorItem {
  id: string;
  name: string;
  cost: number;
  sprite?: string;
  tintHex?: string;
}

export interface DecorConfig {
  shelfTiers: ShelfTierItem[];
  wallpapers: DecorItem[];
  rugs?: DecorItem[];
  lights?: DecorItem[];
}

export interface PotState {
  id: number;
  plantNoteId: string;
  plantTime: number;
  growDuration: number;
  targetNoteId?: string;
}

export interface CuringState {
  bottleId: string;
  startTime: number;
  durationSeconds: number;
}

export interface OrderState {
  id: string;
  guestId: string;
  requiredTag: string;
  rewardCoin: number;
}

export type TutorialStep =
  | 'go_window'
  | 'harvest'
  | 'go_bench'
  | 'blend'
  | 'wait_cure'
  | 'claim'
  | 'go_shop'
  | 'deliver'
  | 'done';

export interface CraftableRecipeInfo {
  id: string;
  bottleId: string;
  bottleName: string;
  noteA: string;
  noteB: string;
  noteAName: string;
  noteBName: string;
}

export interface NewsItem {
  day: number;
  chapter?: string;
  headline: string;
  headline_en?: string;
  headline_ta?: string;
  summary: string;
  summary_en?: string;
  summary_ta?: string;
  illustration: string;
  marketEffect: string;
  marketEffect_en?: string;
  marketEffect_ta?: string;
}

export interface ComicPanel {
  panelIndex: number;
  speaker?: string;
  text_cn: string;
  text_en?: string;
  text_ta?: string;
  sfx?: string;
  sfx_en?: string;
  sfx_ta?: string;
  mood?: string;
  image?: string;
}

export interface TutorialGuideInfo {
  phase: number;
  totalPhases: number;
  phaseName: string;
  title: string;
  story: string;
  tip: string;
  actionText: string;
  actionAct: string;
  targetSelector?: string;
}

export interface PlayerSaveData {
  version: number;
  coins: number;
  reputation: number;
  actionPoints: number;
  lastApTimestamp: number;
  notesInventory: Record<string, number>;
  bottlesInventory: string[];
  shelfBottles: (string | null)[];
  pots: PotState[];
  activeCuring: CuringState | null;
  currentOrder: OrderState | null;
  tutorialCompleted: boolean;
  tutorialStep: TutorialStep;
  shelfTier: number;
  wallpaperId: string;
  obtainedBottleIds: string[];
  /** 广告位 2「补行动点」当日 key / 次数 */
  adApDate: string;
  adApCount: number;
  /** 「看短片领加速卡」当日 key / 次数（接口保留，当前铺面未挂入口） */
  adSpeedupDate?: string;
  adSpeedupCount?: number;
  speedups: number;
  ownedWallpaperIds?: string[];
  rugId?: string;
  ownedRugIds?: string[];
  lightId?: string;
  ownedLightIds?: string[];
  lastSigninDate?: string;
  dailyGuestRefreshUsed?: number;
  dailyGuestRefreshDate?: string;
  /** 存档最近一次写入时的时间戳，用于校验每日计数所依赖的本地日期是否可信 */
  lastSeenTs?: number;
  /** 音效静音（持久化） */
  muted?: boolean;
  /** 顾客好感度评分（0-5心级） */
  guestAffinity?: Record<string, number>;
  /** 已阅读晨报的营业日 */
  readNewsDays?: number[];
  /** 当前营业日 */
  currentBusinessDay?: number;
  /** 开场故事漫画是否已播放 */
  prologueShown?: boolean;
  /** 新人指引完成庆祝卡片是否已展示 */
  tutorialCelebrated?: boolean;
}

