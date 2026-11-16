import type { RawCountry } from '../api/types.js';

export interface CachedSearchOptions {
  maxEntries?: number;
}

type SearchFn = (query: string, signal: AbortSignal) => Promise<RawCountry[]>;

interface InFlightEntry {
  controller: AbortController;
  promise: Promise<RawCountry[]>;
  consumers: number;
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

function subscribe(
  entry: InFlightEntry,
  signal: AbortSignal,
  onEmpty: () => void,
): Promise<RawCountry[]> {
  return new Promise<RawCountry[]>((resolve, reject) => {
    let settled = false;

    const onAbort = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      entry.consumers -= 1;

      if (entry.consumers <= 0) {
        entry.controller.abort();
        onEmpty();
      }

      reject(abortReason(signal));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener('abort', onAbort, { once: true });

    entry.promise.then(
      (value) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(value);
      },
      (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      },
    );
  });
}

/**
 * Adds an LRU response cache and in-flight deduplication on top of a search
 * function. Every caller keeps its own abort signal: aborting one consumer
 * never rejects the shared request for the others.
 */
export function createCachedSearch(search: SearchFn, options: CachedSearchOptions = {}): SearchFn {
  const maxEntries = Math.max(1, options.maxEntries ?? 50);
  const cache = new Map<string, RawCountry[]>();
  const inFlight = new Map<string, InFlightEntry>();

  const keyFor = (query: string): string => query.trim().toLowerCase();

  const readCache = (key: string): RawCountry[] | undefined => {
    const value = cache.get(key);

    if (value === undefined) {
      return undefined;
    }

    cache.delete(key);
    cache.set(key, value);

    return value;
  };

  const writeCache = (key: string, value: RawCountry[]): void => {
    cache.delete(key);
    cache.set(key, value);

    if (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;

      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
  };

  return (query: string, signal: AbortSignal): Promise<RawCountry[]> => {
    if (signal.aborted) {
      return Promise.reject(abortReason(signal));
    }

    const key = keyFor(query);
    const cached = readCache(key);

    if (cached !== undefined) {
      return Promise.resolve(cached);
    }

    const existing = inFlight.get(key);

    if (existing) {
      existing.consumers += 1;
      return subscribe(existing, signal, () => {
        if (inFlight.get(key) === existing) {
          inFlight.delete(key);
        }
      });
    }

    const controller = new AbortController();
    const entry: InFlightEntry = {
      controller,
      consumers: 1,
      promise: Promise.resolve([]),
    };

    entry.promise = search(query, controller.signal)
      .then((result) => {
        writeCache(key, result);
        return result;
      })
      .finally(() => {
        if (inFlight.get(key) === entry) {
          inFlight.delete(key);
        }
      });

    inFlight.set(key, entry);

    return subscribe(entry, signal, () => {
      if (inFlight.get(key) === entry) {
        inFlight.delete(key);
      }
    });
  };
}
