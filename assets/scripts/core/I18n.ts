import i18nRaw from '../../tables/i18n.json';
import guestsRaw from '../../tables/guests.json';
import bottlesRaw from '../../tables/bottles.json';

export type Lang = 'zh';

interface I18nSchema {
  notes: Record<string, string>;
  tags: Record<string, string>;
  bottles: Record<string, { name: string; blurb: string }>;
  guests: Record<string, { name: string; dialog: string }>;
  decor: Record<string, string>;
  ui: Record<string, string>;
}

export class I18n {
  private static _data: I18nSchema = i18nRaw as unknown as I18nSchema;
  private static _guestFallbacks: Map<string, { name: string; dialog: string }> | null = null;
  private static _bottleFallbacks: Map<string, { name: string; blurb: string }> | null = null;

  public static get currentLang(): Lang {
    return 'zh';
  }

  public static t(key: string, params?: Record<string, string | number>): string {
    const entry = this._data.ui[key];
    let res = entry || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        res = res.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return res;
  }

  public static tNote(id: string): string {
    return this._data.notes[id] || id;
  }

  public static tTag(tag: string): string {
    return this._data.tags[tag] || tag;
  }

  public static tBottle(id: string): { name: string; blurb: string } {
    const entry = this._data.bottles[id];
    if (entry) return entry;

    if (!this._bottleFallbacks) {
      this._bottleFallbacks = new Map();
      const raw = bottlesRaw as Array<{ id: string; name?: string; desc?: string }>;
      if (Array.isArray(raw)) {
        raw.forEach(b => {
          if (b && b.id) {
            this._bottleFallbacks!.set(b.id, {
              name: b.name || b.id,
              blurb: b.desc || '',
            });
          }
        });
      }
    }

    const fallback = this._bottleFallbacks.get(id);
    return fallback || { name: id, blurb: '' };
  }

  public static tGuest(id: string): { name: string; dialog: string } {
    const entry = this._data.guests[id];
    if (entry) return entry;

    if (!this._guestFallbacks) {
      this._guestFallbacks = new Map();
      const raw = guestsRaw as Array<{ id: string; name?: string; dialog?: string }>;
      if (Array.isArray(raw)) {
        raw.forEach(g => {
          if (g && g.id) {
            this._guestFallbacks!.set(g.id, {
              name: g.name || g.id,
              dialog: g.dialog || '',
            });
          }
        });
      }
    }

    const fallback = this._guestFallbacks.get(id);
    return fallback || { name: id, dialog: '' };
  }

  public static tDecor(id: string): string {
    return this._data.decor[id] || id;
  }
}
