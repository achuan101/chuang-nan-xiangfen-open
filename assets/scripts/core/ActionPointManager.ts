import { ConfigManager } from './ConfigManager';

export class ActionPointManager {
  private _points: number = 20;
  private _lastTimestamp: number = Date.now();

  constructor(points?: number, lastTimestamp?: number) {
    const eco = ConfigManager.economy;
    this._points = typeof points === 'number' ? points : eco.initialActionPoints;
    this._lastTimestamp = typeof lastTimestamp === 'number' ? lastTimestamp : Date.now();
    this.refresh();
  }

  public get points(): number {
    // 不在 getter 里偷偷 refresh：自然回复统一走 GameModel.checkApRecovery → ap_changed
    return this._points;
  }

  public get lastTimestamp(): number {
    return this._lastTimestamp;
  }

  public refresh(): boolean {
    const eco = ConfigManager.economy;
    const max = eco.maxActionPoints;
    // 超上限（改档 / 旧版测试按钮遗留）先压回上限并重置计时，避免上限失效
    if (this._points > max) {
      this._points = max;
      this._lastTimestamp = Date.now();
      return true;
    }
    if (this._points >= max) {
      return false;
    }

    const now = Date.now();
    // 时间倒流防护：若本机校时或时区回退，单向钳位上次时间戳，防止长期无法恢复 AP
    if (now < this._lastTimestamp) {
      this._lastTimestamp = now;
    }
    const recoverIntervalMs = eco.apRecoverMinutes * 60 * 1000;
    const elapsed = now - this._lastTimestamp;

    if (elapsed >= recoverIntervalMs) {
      const recovered = Math.floor(elapsed / recoverIntervalMs);
      if (recovered > 0) {
        this._points = Math.min(eco.maxActionPoints, this._points + recovered);
        this._lastTimestamp += recovered * recoverIntervalMs;
        if (this._points >= eco.maxActionPoints) {
          this._lastTimestamp = now;
        }
        return true;
      }
    }
    return false;
  }

  public getSecondsToNextPoint(): number {
    this.refresh();
    const eco = ConfigManager.economy;
    if (this._points >= eco.maxActionPoints) {
      return 0;
    }
    const recoverIntervalMs = eco.apRecoverMinutes * 60 * 1000;
    const elapsed = Date.now() - this._lastTimestamp;
    const remainingMs = Math.max(0, recoverIntervalMs - elapsed);
    return Math.ceil(remainingMs / 1000);
  }

  public hasEnough(amount: number): boolean {
    this.refresh();
    return this._points >= amount;
  }

  public consume(amount: number): boolean {
    this.refresh();
    if (this._points < amount) {
      return false;
    }
    const eco = ConfigManager.economy;
    const wasMax = this._points >= eco.maxActionPoints;
    this._points -= amount;
    if (wasMax) {
      this._lastTimestamp = Date.now();
    }
    return true;
  }

  public add(amount: number): void {
    const eco = ConfigManager.economy;
    this.refresh();
    this._points = Math.min(eco.maxActionPoints, this._points + Math.max(0, amount));
    if (this._points >= eco.maxActionPoints) {
      this._lastTimestamp = Date.now();
    }
  }
}
