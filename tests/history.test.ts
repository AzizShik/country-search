import { describe, expect, it } from 'vitest';

import { SearchHistory } from '../src/search/history.js';

interface MemoryStorage {
  data: Record<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function createStorage(initial: Record<string, string> = {}): MemoryStorage {
  return {
    data: { ...initial },
    getItem(key: string): string | null {
      return this.data[key] ?? null;
    },
    setItem(key: string, value: string): void {
      this.data[key] = value;
    },
  };
}

describe('SearchHistory', () => {
  it('should start empty when storage has no value', () => {
    const history = new SearchHistory(createStorage());

    expect(history.getAll()).toEqual([]);
  });

  it('should keep the latest query first and remove case-insensitive duplicates', () => {
    const history = new SearchHistory(createStorage());

    history.add('Spain');
    history.add('France');
    history.add('spain');

    expect(history.getAll()).toEqual(['spain', 'France']);
  });

  it('should keep only the configured number of entries', () => {
    const history = new SearchHistory(createStorage(), { limit: 3 });

    history.add('a');
    history.add('b');
    history.add('c');
    history.add('d');

    expect(history.getAll()).toEqual(['d', 'c', 'b']);
  });

  it('should persist entries between instances sharing the same storage', () => {
    const storage = createStorage();
    const first = new SearchHistory(storage);
    first.add('Spain');

    const second = new SearchHistory(storage);

    expect(second.getAll()).toEqual(['Spain']);
  });

  it('should ignore blank queries', () => {
    const history = new SearchHistory(createStorage());

    history.add('   ');
    history.add('');

    expect(history.getAll()).toEqual([]);
    expect(history.add('  Spain  ')).toEqual(['Spain']);
  });

  it('should recover from malformed storage data', () => {
    const history = new SearchHistory(createStorage({ 'country-search-history': '{not-json' }));
    expect(history.getAll()).toEqual([]);

    const nonArray = new SearchHistory(createStorage({ 'country-search-history': '{"a":1}' }));
    expect(nonArray.getAll()).toEqual([]);
  });

  it('should filter non-string and duplicate entries from storage', () => {
    const history = new SearchHistory(
      createStorage({
        'country-search-history': JSON.stringify(['Spain', 42, 'spain', 'France', '']),
      }),
    );

    expect(history.getAll()).toEqual(['Spain', 'France']);
  });
});
