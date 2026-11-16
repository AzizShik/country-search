export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SearchHistoryOptions {
  key?: string;
  limit?: number;
}

const DEFAULT_KEY = 'country-search-history';
const DEFAULT_LIMIT = 6;

export class SearchHistory {
  private readonly key: string;
  private readonly limit: number;

  constructor(
    private readonly storage: StorageLike,
    options: SearchHistoryOptions = {},
  ) {
    this.key = options.key ?? DEFAULT_KEY;
    this.limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  }

  getAll(): string[] {
    let parsed: unknown;

    try {
      const raw = this.storage.getItem(this.key);

      if (!raw) {
        return [];
      }

      parsed = JSON.parse(raw);
    } catch {
      return [];
    }

    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen = new Set<string>();
    const result: string[] = [];

    for (const item of parsed) {
      if (typeof item !== 'string') {
        continue;
      }

      const value = item.trim();

      if (!value) {
        continue;
      }

      const normalized = value.toLowerCase();

      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(value);

      if (result.length === this.limit) {
        break;
      }
    }

    return result;
  }

  add(query: string): string[] {
    const value = query.trim();

    if (!value) {
      return this.getAll();
    }

    const normalized = value.toLowerCase();
    const items = this.getAll().filter((item) => item.toLowerCase() !== normalized);
    const next = [value, ...items].slice(0, this.limit);

    this.storage.setItem(this.key, JSON.stringify(next));

    return next;
  }
}
