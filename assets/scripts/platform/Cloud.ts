/**
 * 云同步预留。当前存档只走本地 Storage。
 */
export class Cloud {
  public static syncEnabled(): boolean {
    return false;
  }

  public static pull(): void {}

  public static push(): void {}
}
