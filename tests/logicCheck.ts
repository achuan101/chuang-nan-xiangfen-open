// 无头逻辑校验：node 下直接跑 assets/scripts 的 core / blend / order 代码。
// 用法：npm run check   （等价 node tests/build-check.mjs）
// 'cc' 由 tests/build-check.mjs 通过 esbuild alias 换成 tests/cc-stub.ts。
declare const process: { exit(code?: number): never };

// node 没有 wx，Storage 走 localStorage 分支；这里注入内存实现。
// 必须在任何 initialize() 之前生效，模块自身不在 import 期读写存储，所以放在这里即可。
const _store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => (Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null),
  setItem: (k: string, v: string) => {
    _store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete _store[k];
  },
};

import { ActionPointManager } from '../assets/scripts/core/ActionPointManager';
import { BlendSystem } from '../assets/scripts/blend/BlendSystem';
import { ConfigManager } from '../assets/scripts/core/ConfigManager';
import { GameModel } from '../assets/scripts/core/GameModel';
import { OrderSystem } from '../assets/scripts/order/OrderSystem';

const SAVE_KEY = 'CHUANG_NAN_XIANGFEN_SAVE_V1';
const LEGACY_KEY = 'CHUANG_NAN_XIANGFEN_SAVE_LEGACY';

const fails: string[] = [];

function check(cond: boolean, msg: string): void {
  if (!cond) fails.push(msg);
}

function eq(actual: any, expected: any, msg: string): void {
  if (actual !== expected) fails.push(`${msg}：期望 ${String(expected)}，实际 ${String(actual)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 清档或写入种子存档后重建一个独立 GameModel 实例（不动单例） */
function fresh(seed?: any): GameModel {
  delete _store[SAVE_KEY];
  delete _store[LEGACY_KEY];
  if (typeof seed === 'string') _store[SAVE_KEY] = seed;
  else if (seed) _store[SAVE_KEY] = JSON.stringify({ version: 2, ...seed });
  const m = new GameModel();
  m.initialize();
  return m;
}

/** 标签兜底的独立实现：并集凑齐 + 不能被单香凑齐 + 唯一命中 */
function tagOracle(a: string, b: string): { bottleId: string; result: 'success' | 'fail' } {
  const tagsOf = (id: string) => (ConfigManager.getNote(id) ? ConfigManager.getNote(id)!.tags : []);
  const union = new Set([...tagsOf(a), ...tagsOf(b)]);
  const hits = ConfigManager.getAllRecipes().filter(r => {
    if (!r.match || !r.match.startsWith('tags:')) return false;
    const req = r.match.substring(5).split('+').map(t => t.trim()).filter(Boolean);
    if (req.length === 0 || !req.every(t => union.has(t))) return false;
    return !req.every(t => tagsOf(a).indexOf(t) >= 0) && !req.every(t => tagsOf(b).indexOf(t) >= 0);
  });
  if (hits.length === 1) return { bottleId: hits[0].bottleId, result: hits[0].result };
  return { bottleId: 'practice_bottle', result: 'fail' };
}

function pairOracle(a: string, b: string): { bottleId: string; result: 'success' | 'fail' } {
  const key = [a, b].sort().join('+');
  const exact = ConfigManager.getAllRecipes().find(r => r.inputs.length === 2 && [...r.inputs].sort().join('+') === key);
  if (exact) return { bottleId: exact.bottleId, result: exact.result };
  if (a === b) return { bottleId: 'practice_bottle', result: 'fail' };
  return tagOracle(a, b);
}

async function main(): Promise<void> {
  const eco = ConfigManager.economy;
  const noteIds = ConfigManager.getAllNotes().map(n => n.id);

  // ---------- 表结构（改表时先在这里报错） ----------
  eq(noteIds.length, 8, '香调数应为 8（完整表）');
  for (const n of ConfigManager.getAllNotes()) {
    check(n.tags.length === 2, `${n.id} 应有 2 个标签，实际 ${n.tags.length}`);
    check(!!n.colorHex && n.colorHex.startsWith('#'), `${n.id} 缺 colorHex`);
  }
  const bottleIds = new Set(ConfigManager.getAllBottles().map(b => b.id));
  check(bottleIds.has('practice_bottle'), 'bottles.json 必须含 practice_bottle');
  let exactSuccess = 0;
  for (const r of ConfigManager.getAllRecipes()) {
    check(bottleIds.has(r.bottleId), `配方 ${r.id} 指向不存在的瓶 ${r.bottleId}`);
    if (r.result === 'success') {
      exactSuccess += 1;
      eq(r.inputs.length, 2, `成功配方 ${r.id} 应是两香输入`);
    }
  }
  eq(exactSuccess, 12, '成功配方应为 12 条');
  for (const o of ConfigManager.getInitialOrders()) {
    check(!!ConfigManager.getGuest(o.guestId), `订单 ${o.id} 的客人 ${o.guestId} 不在 guests.json`);
    check(
      ConfigManager.getAllBottles().some(b => b.tags.indexOf(o.requiredTag) >= 0),
      `订单 ${o.id} 要求的标签『${o.requiredTag}』没有任何瓶可满足`,
    );
  }
  eq(
    eco.shelfSlotTiers.length,
    eco.shelfUpgradeCosts.length + 1,
    '货架档位与升级价格条数应相差 1（最高档无价格）',
  );
  eq(eco.apRecoverMinutes, 5, '行动点回复应是 5 分钟 1 点');
  eq(eco.curingSeconds, 90, '定香应为 90 秒');
  eq(eco.potGrowSeconds, 180, '花盆生长应为 180 秒');

  // ---------- 配方查表 ----------
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < noteIds.length; i++) {
    for (let j = i; j < noteIds.length; j++) pairs.push([noteIds[i], noteIds[j]]);
  }
  for (const [a, b] of pairs) {
    const want = pairOracle(a, b);
    const got = ConfigManager.matchRecipe([a, b]);
    eq(`${got.bottleId}/${got.result}`, `${want.bottleId}/${want.result}`, `配方矩阵 ${a}+${b}`);
    const rev = ConfigManager.matchRecipe([b, a]);
    eq(`${rev.bottleId}/${rev.result}`, `${got.bottleId}/${got.result}`, `输入顺序应无关 ${a}+${b}`);
  }
  // 单香自带整组标签时不得走兜底（茶汤=木+静、沉檀=暖+木、晚风=静+夜）
  eq(ConfigManager.matchRecipe(['D', 'A']).bottleId !== 'deep_wood', true, '茶汤自带木+静，不该白送深林檀木');
  eq(ConfigManager.matchRecipe(['H', 'F']).bottleId !== 'warm_sandalwood', true, '沉檀自带暖+木，不该白送暖檀');
  eq(ConfigManager.matchRecipe(['F', 'A']).bottleId, 'practice_bottle', '晚风+雨后应落练习瓶');
  // 并集兜底的正例：窗南(暖)+晚风(静) 凑齐『暖+静』，且两香各自都不齐全
  eq(ConfigManager.matchRecipe(['B', 'F']).bottleId, 'evening_lamp', '窗南+晚风应兜底出暮色窗纸');
  // 同香两份不走标签兜底
  eq(ConfigManager.matchRecipe(['H', 'H']).bottleId, 'practice_bottle', '同香组合应练习瓶');

  // ---------- 新档不变量（用单例，后续流程用例共用） ----------
  delete _store[SAVE_KEY];
  delete _store[LEGACY_KEY];
  const m = GameModel.instance;
  m.initialize();
  eq(m.coins, eco.initialCoins, '新档金币');
  eq(m.speedups, eco.initialSpeedups, '新档加速卡');
  eq(m.apManager.points, eco.initialActionPoints, '新档行动点');
  eq(m.shelfSlotCount, eco.shelfSlotTiers[0], '新档货架格数');
  eq(m.shelfBottles.length, m.shelfSlotCount, '货架数组长度应等于格数');
  eq(m.pots.length, 3, '新档应有 3 个盆');
  eq(m.tutorialStep, 'go_window', '新档引导起始步');
  eq(m.tutorialCompleted, false, '新档引导未完成');
  eq(m.isNoteUnlocked('A'), true, '雨后第 1 天应可用');
  eq(m.isNoteUnlocked('H'), false, '沉檀第 1 天不应可用');
  eq(m.currentOrder ? m.currentOrder.requiredTag : '', ConfigManager.getInitialOrders()[0].requiredTag, '首单标签');

  // ---------- 存档健壮性 / 迁移 ----------
  eq(fresh({ version: 99, coins: 9999 }).coins, eco.initialCoins, '未来版本存档应按新档处理');
  eq(fresh({ coins: '50' }).coins, 0, '金币写成字符串要回落 0，不能让 NaN 绕过扣费');
  eq(fresh({ coins: -5 }).coins, 0, '负金币要回落 0');
  eq(fresh({ reputation: null }).reputation, 0, 'reputation null 要回落');
  eq(fresh({ shelfTier: 99 }).shelfSlotCount, eco.shelfSlotTiers[eco.shelfSlotTiers.length - 1], 'shelfTier 越界要夹到最高档');
  // 损坏存档会被 Storage 记一条 warn，属预期，临时静音避免刷屏
  const warn = console.warn;
  console.warn = () => {};
  eq(fresh('{"broken":').coins, eco.initialCoins, 'JSON 损坏应退回新档而不是崩溃');
  console.warn = warn;
  const legacyOnly = (() => {
    delete _store[SAVE_KEY];
    delete _store[LEGACY_KEY];
    _store[LEGACY_KEY] = JSON.stringify({ version: 2, coins: 777 });
    const x = new GameModel();
    x.initialize();
    return x;
  })();
  eq(legacyOnly.coins, 777, '旧 key 存档应能读出');
  const adInherit = fresh({ adApDate: m.todayKey(), adApCount: 2 });
  eq(adInherit.adSpeedupCount, 2, '旧档只有 adApCount 时，加速卡位要继承一次');
  const shelfTrim = fresh({ shelfTier: 0, shelfBottles: ['spring_letter', 'sun_rain', 'tea_petal', 'deep_wood', 'quiet_night', 'morning_dew'] });
  eq(shelfTrim.shelfBottles.length, eco.shelfSlotTiers[0], '超出档位的货架格要裁掉');
  eq(shelfTrim.bottlesInventory.length, 2, '裁掉的瓶要回背包，不能凭空消失');
  const decorFallback = fresh({ wallpaperId: 'paper_mist', ownedWallpaperIds: [], rugId: 'rug_floral', ownedRugIds: ['rug_none'] });
  eq(decorFallback.wallpaperId, 'paper_warm', '穿未拥有窗纸要回落默认');
  eq(decorFallback.rugId, 'rug_none', '穿未拥有地毯要回落默认');

  // ---------- 行动点与经济 ----------
  m.apManager = new ActionPointManager(0, Date.now() - 11 * 60 * 1000);
  m.checkApRecovery();
  eq(m.apManager.points, 2, '离线 11 分钟应回 2 点');
  m.apManager = new ActionPointManager(eco.maxActionPoints + 9, Date.now());
  m.checkApRecovery();
  eq(m.apManager.points, eco.maxActionPoints, '超过上限的行动点要被夹回上限');
  m.apManager = new ActionPointManager(eco.maxActionPoints, Date.now());
  eq(m.consumeActionPoints(eco.blendCost), true, '满点时应能扣 2 点');
  eq(m.apManager.points, eco.maxActionPoints - eco.blendCost, '扣费后点数');
  eq(m.consumeActionPoints(9999), false, '点数不足时扣费必须失败');
  m.consumeCoins(10);
  eq(m.consumeCoins(999999), false, '金币不足时 consumeCoins 要失败');
  eq(m.coins >= 0, true, '金币不得为负');

  // ---------- 签到 ----------
  m.lastSigninDate = '';
  const coins0 = m.coins;
  const speedups0 = m.speedups;
  const signin = m.trySignin();
  eq(signin.ok, true, '当日首次签到应成功');
  eq(m.coins - coins0, eco.signinRewardCoins, '签到金币奖励');
  eq(m.speedups - speedups0, eco.signinRewardSpeedups, '签到加速卡奖励');
  eq(m.trySignin().ok, false, '同日重复签到应拒绝');
  m.lastSigninDate = '2000-01-01';
  eq(m.trySignin().ok, true, '跨日后应能再次签到');

  // ---------- 广告位每日上限 ----------
  m.apManager = new ActionPointManager(0, Date.now());
  const apLimit = eco.adApDailyLimit;
  m.adApDate = m.todayKey();
  m.adApCount = 0;
  m.adSpeedupDate = m.todayKey();
  m.adSpeedupCount = 0;
  (m as any)._lastSeenTs = 0;
  for (let i = 0; i < apLimit; i++) {
    const res = await new Promise<{ ok: boolean; msg: string }>(cb => m.tryWatchAdForActionPoints((ok, msg) => cb({ ok, msg })));
    eq(res.ok, true, `行动点广告第 ${i + 1} 次应放行`);
    await sleep(650);
  }
  eq(m.apManager.points, apLimit * eco.adApRestore, '每次补点应加 adApRestore');
  eq(m.adApCount, apLimit, '行动点广告计数');
  const over = await new Promise<{ ok: boolean; msg: string }>(cb => m.tryWatchAdForActionPoints((ok, msg) => cb({ ok, msg })));
  eq(over.ok, false, '超过每日上限应拒绝');
  check(over.msg.indexOf('次数已用完') >= 0, `超限提示应说明次数用完，实际「${over.msg}」`);
  // 两个广告位计数独立（历史 bug：共用一对导致补点满额后领卡也被拒）
  const speedBefore = m.adSpeedupCount;
  m.adSpeedupCount = 0;
  m.adSpeedupDate = m.todayKey();
  const cardRes = await new Promise<{ ok: boolean; msg: string }>(cb => m.tryWatchAdForSpeedupCard((ok, msg) => cb({ ok, msg })));
  await sleep(650);
  eq(cardRes.ok, true, '行动点广告用完不应影响领加速卡');
  eq(m.adSpeedupCount, 1, '加速卡广告独立计数');
  eq(m.adApCount, apLimit, '领卡不应改动行动点广告计数');
  void speedBefore;
  m.adSpeedupCount = ConfigManager.adSpeedupDailyLimit;
  const cardOver = await new Promise<{ ok: boolean; msg: string }>(cb => m.tryWatchAdForSpeedupCard((ok, msg) => cb({ ok, msg })));
  eq(cardOver.ok, false, '加速卡广告超日限应拒绝');
  // 跨日重置
  m.adApDate = '2000-01-01';
  m.adApCount = 99;
  m.apManager = new ActionPointManager(0, Date.now());
  const rollover = await new Promise<{ ok: boolean; msg: string }>(cb => m.tryWatchAdForActionPoints((ok, msg) => cb({ ok, msg })));
  await sleep(650);
  eq(rollover.ok, true, '跨日后行动点广告应重新可用');
  eq(m.adApCount, 1, '跨日重置后计数从 1 开始');
  // 本机时间倒退时暂停发放
  (m as any)._lastSeenTs = Date.now() + 10 * 60 * 1000;
  m.adApDate = m.todayKey();
  m.adApCount = 0;
  const badClock = await new Promise<{ ok: boolean; msg: string }>(cb => m.tryWatchAdForActionPoints((ok, msg) => cb({ ok, msg })));
  eq(badClock.ok, false, '时钟异常应暂停广告奖励');
  check(badClock.msg.indexOf('时间') >= 0, `时钟异常提示应提到时间，实际「${badClock.msg}」`);
  eq(m.trySignin().ok, false, '时钟异常应同时挡住签到');
  (m as any)._lastSeenTs = Date.now();

  // ---------- 客人更换 ----------
  m.skipTutorial();
  eq(m.tutorialCompleted, true, 'skipTutorial 应标记引导完成');
  eq(m.currentUnlockDay >= 2, true, '引导完成后应进入第 2 天解锁档');
  eq(m.isNoteUnlocked('C'), true, '青橘第 2 天应可用');
  eq(m.isNoteUnlocked('F'), false, '晚风需第 3 天（好评 3）');
  m.addReputation(eco.noteUnlockDay3Reputation);
  eq(m.isNoteUnlocked('F'), true, '好评达标后晚风应解锁');
  m.addReputation(-eco.noteUnlockDay3Reputation);
  m.dailyGuestRefreshDate = '';
  m.dailyGuestRefreshUsed = 0;
  m.coins = eco.refreshOrderCoinCost;
  const orderBefore = m.currentOrder ? m.currentOrder.id : '';
  const free1 = m.refreshGuestOrder();
  eq(free1.ok, true, '首次换客应免费');
  check((free1.msg || '').indexOf('免费') >= 0, `免费换客文案应含「免费」，实际「${free1.msg}」`);
  eq(m.currentOrder ? m.currentOrder.id !== orderBefore : false, true, '换客应真的换一单');
  eq(m.guestRefreshButtonLabel().indexOf('金币') >= 0, true, '免费次数用完后按钮应显示金币价');
  const paid = m.refreshGuestOrder();
  eq(paid.ok, true, '金币足够时应可付费换客');
  eq(m.coins, 0, '付费换客扣满余额');
  eq(m.refreshGuestOrder().ok, false, '金币不足应拒绝换客');
  m.coins = eco.initialCoins;

  // ---------- 调香 → 定香 → 出瓶 ----------
  m.activeCuring = null;
  m.addNote('A', 3);
  m.addNote('E', 3);
  const aBefore = m.getNoteCount('A');
  const eBefore = m.getNoteCount('E');
  const apBefore = m.apManager.points;
  const blend = BlendSystem.startBlend('A', 'E');
  eq(blend.bottleId, 'spring_letter', '雨后+绒花应产出春日纸信');
  eq(blend.result, 'success', '该组合应为成功配方');
  eq(m.apManager.points, apBefore - eco.blendCost, '调瓶消耗 2 点');
  eq(m.getNoteCount('A'), aBefore - 1, '成功后不再返料');
  eq(m.getNoteCount('E'), eBefore - 1, '成功后不再返料');
  check(!!m.activeCuring, '成功后应进入定香');
  eq(BlendSystem.isCuringComplete(), false, '刚入定香不应立刻完成');
  eq(m.consumeActionPoints(9999), false, '行动点不足时不得开第二瓶');
  m.apManager = new ActionPointManager(eco.maxActionPoints, Date.now());
  const sp = m.speedups;
  eq(BlendSystem.speedUpCuring(), true, '加速卡应能立刻定香');
  eq(m.speedups, sp - 1, '加速卡应被消耗 1 张');
  eq(BlendSystem.isCuringComplete(), true, '加速后定香完成');
  const claim = BlendSystem.claimBottle();
  eq(claim ? claim.bottleId : '', 'spring_letter', '出瓶 id');
  eq(m.activeCuring, null, '出瓶后清空定香槽');
  eq(m.hasObtained('spring_letter'), true, '出瓶应写入图鉴');
  eq(
    m.shelfBottles.indexOf('spring_letter') >= 0 || m.bottlesInventory.indexOf('spring_letter') >= 0,
    true,
    '出瓶后瓶子要在货架或背包之一',
  );

  // 冲突 / 无配方组合：练习瓶 + 返料
  m.apManager = new ActionPointManager(eco.maxActionPoints, Date.now());
  m.addNote('D', 2);
  const dBefore = m.getNoteCount('D');
  const aCountBefore = m.getNoteCount('A');
  const failBlend = BlendSystem.startBlend('D', 'A');
  eq(failBlend.result, 'fail', '茶汤+雨后（练习瓶）应为 fail');
  eq(failBlend.bottleId, 'practice_bottle', '冲突应落练习瓶');
  eq(m.getNoteCount('D') + m.getNoteCount('A'), dBefore + aCountBefore - 2 + eco.failRefundCount, '失败要扣两份、返料 failRefundCount 份');
  eq(m.bottlesInventory.indexOf('practice_bottle') >= 0, true, '练习瓶应进背包');
  const coinsBefore = m.coins;
  const sold = m.sellPracticeBottle();
  eq(sold.ok, true, '练习瓶应可回收');
  eq(m.coins - coinsBefore, sold.coin, '回收练习瓶按标价发金币');
  eq(sold.coin > 0, true, '回收金币应大于 0');
  // 按钮写的是「回收 ×N」，一次只删 1 个就是文案与行为不符
  m.bottlesInventory.push('practice_bottle', 'practice_bottle');
  const pending = m.practiceBottleCount;
  const coinsBeforeAll = m.coins;
  const soldAll = m.sellPracticeBottle();
  eq(soldAll.count, pending, '回收一次要清掉全部练习瓶');
  eq(m.practiceBottleCount, 0, '回收后背包不该还留练习瓶');
  eq(m.coins - coinsBeforeAll, soldAll.coin, '回收金币按只数累计');
  eq(soldAll.coin >= sold.coin * pending, true, '多只练习瓶给金币不能按一只算');
  const soldEmpty = m.sellPracticeBottle();
  eq(soldEmpty.ok, false, '没有练习瓶时回收应失败');
  eq((soldEmpty.reason || '').length > 0, true, '回收失败要给原因');

  // ---------- 交付 ----------
  m.skipTutorial();
  const order = m.currentOrder!;
  const wantTag = order.requiredTag;
  const target = ConfigManager.getAllBottles().find(b => b.id !== 'practice_bottle' && b.tags.indexOf(wantTag) >= 0)!;
  m.bottlesInventory = [target.id];
  m.shelfBottles = m.shelfBottles.map(() => null);
  m.normalizeShelfSlots();
  const match = OrderSystem.findMatchingBottle(wantTag);
  check(!!match, `背包里有带『${wantTag}』的 ${target.id} 时应能匹配到瓶`);
  eq(match ? match.source : '', 'inventory', '只在背包时应从背包取瓶');
  const coinBefore = m.coins;
  const repBefore = m.reputation;
  // 先把表里的好评分改成 3 再交单：硬编码 +1 在这里会露馅（改表不生效比数值写错更难发现）
  const guestCfg = ConfigManager.getGuest(order.guestId);
  const repDefault = guestCfg && typeof guestCfg.rewardReputation === 'number' ? guestCfg.rewardReputation : 1;
  if (guestCfg) guestCfg.rewardReputation = 3;
  const deliver = OrderSystem.deliver();
  if (guestCfg) guestCfg.rewardReputation = repDefault;
  eq(deliver.ok, true, '有匹配瓶时交付应成功');
  eq(m.coins - coinBefore, order.rewardCoin, '交付按订单发金币');
  eq(m.reputation - repBefore, 3, '交付好评要读 guests.json 的 rewardReputation');
  eq(deliver.rep, 3, 'deliver 返回的好页数与实发一致');
  check(typeof deliver.affinity === 'number' && deliver.affinity >= 1, '交付后常客好感度应提升');
  eq(m.getGuestAffinity(order.guestId), deliver.affinity, 'GameModel 应记录客人新好感度');
  eq(m.bottlesInventory.length, 0, '交付后瓶子要被拿走');
  eq(m.currentOrder ? m.currentOrder.id !== order.id : true, true, '交付后换下一位客人');
  const empty = OrderSystem.deliver();
  eq(empty.ok, false, '无匹配瓶时交付应失败并给出原因');
  check((empty.reason || '').length > 0, '失败原因不能为空');

  // ---------- 货架槽位（历史上用过期的背包下标） ----------
  m.bottlesInventory = ['sun_rain', 'tea_petal'];
  m.shelfBottles = m.shelfBottles.map(() => null);
  m.normalizeShelfSlots();
  eq(m.placeBottleOnShelf(99, 0), false, '越界背包下标应拒绝');
  eq(m.placeBottleOnShelf(0, 99), false, '越界货架下标应拒绝');
  eq(m.placeBottleOnShelf(0, 0), true, '合法下标应上架');
  eq(m.shelfBottles[0], 'sun_rain', '上架写入目标格');
  eq(m.bottlesInventory.indexOf('sun_rain'), -1, '上架后背包不能再有这瓶');
  eq(m.removeBottleFromShelf(99), false, '越界收起应拒绝');
  eq(m.removeBottleFromShelf(0), true, '合法收起应成功');
  for (let i = 0; i < m.shelfSlotCount; i++) m.putOnShelf('deep_wood');
  eq(m.putOnShelf('deep_wood'), false, '货架满时不能再上架');
  eq(m.shelfBottles.filter(Boolean).length, m.shelfSlotCount, '货架不应超出格数');

  // ---------- 货架升级 ----------
  m.shelfTier = 0;
  m.coins = eco.shelfUpgradeCosts[0] - 1;
  eq(m.upgradeShelf().ok, false, '金币不足时不得升级货架');
  eq(m.shelfTier, 0, '升级失败不应改档位');
  m.coins = eco.shelfUpgradeCosts[0];
  eq(m.upgradeShelf().ok, true, '金币刚好够时应能升级');
  eq(m.shelfTier, 1, '档位 +1');
  eq(m.shelfSlotCount, eco.shelfSlotTiers[1], '档位决定格数');
  eq(m.shelfBottles.length, eco.shelfSlotTiers[1], '升级后槽位数同步');
  m.shelfTier = eco.shelfSlotTiers.length - 1;
  eq(m.upgradeShelf().ok, false, '最高档不可再升');

  // ---------- 布置购买与穿戴 ----------
  const paper = ConfigManager.decor.wallpapers.find(p => p.cost > 0)!;
  m.ownedWallpaperIds = ['paper_warm'];
  m.wallpaperId = 'paper_warm';
  m.coins = paper.cost - 1;
  eq(m.setWallpaper(paper.id).ok, false, '金币差 1 时不得购买窗纸');
  eq(m.coins, paper.cost - 1, '购买失败不能扣钱');
  eq(m.wallpaperId, 'paper_warm', '购买失败不应换下原窗纸');
  m.coins = paper.cost;
  const buy = m.setWallpaper(paper.id);
  eq(buy.ok, true, '金币刚好时应能购买并穿上');
  eq(m.coins, 0, '购买应扣满价');
  eq(m.hasWallpaper(paper.id), true, '购买后应记为已拥有');
  eq(m.wallpaperId, paper.id, '购买后自动穿上');
  m.coins = 0;
  eq(m.setWallpaper('paper_warm').ok, true, '已拥有的窗纸切换不应再收钱');
  eq(m.coins, 0, '切换已拥有项不扣费');

  // ---------- 图鉴 ----------
  m.obtainedBottleIds = [];
  m.markBottleObtained('sun_rain');
  m.markBottleObtained('sun_rain');
  eq(m.obtainedBottleIds.filter(id => id === 'sun_rain').length, 1, '图鉴收集不应重复计数');
  const hidden = ConfigManager.getAllBottles().find(b => b.album === false);
  if (hidden) {
    m.markBottleObtained(hidden.id);
    eq(m.hasObtained(hidden.id), false, `album=false 的 ${hidden.id} 不进图鉴`);
  }
  eq(ConfigManager.getAlbumBottles().every(b => b.album !== false), true, '图鉴列表应过滤 album=false');

  // ---------- 花盆轮作 ----------
  eq(m.getNextRotatedNote(1, 'A'), 'B', '1 号盆轮作应按 potRotations 顺序');
  const rotatedAll = ['A', 'B', 'C', 'F'].map(n => m.getNextRotatedNote(1, n));
  eq(rotatedAll.every(id => ConfigManager.getNote(id) !== undefined), true, '轮作结果必须是合法香调');

  if (fails.length > 0) {
    console.error(`\nlogicCheck: ${fails.length} 项失败`);
    fails.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
    process.exit(1);
  }
  console.log(`logicCheck: 全部通过（${pairs.length} 组配方矩阵 + 存档/广告/经济/交付/货架用例）`);
}

main().catch(err => {
  console.error('[logicCheck] 运行异常：', err);
  process.exit(1);
});
