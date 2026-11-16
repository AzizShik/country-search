import { describe, expect, it, vi } from 'vitest';

import type { RawCountry } from '../src/api/types.js';
import { createCachedSearch } from '../src/search/cache.js';

const spain: RawCountry[] = [{ name: 'Spain' }];
const france: RawCountry[] = [{ name: 'France' }];
const germany: RawCountry[] = [{ name: 'Germany' }];

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createCachedSearch', () => {
  it('should serve a repeated query from the cache without another request', async () => {
    const search = vi.fn().mockResolvedValue(spain);
    const cachedSearch = createCachedSearch(search);
    const signal = new AbortController().signal;

    await expect(cachedSearch('spain', signal)).resolves.toEqual(spain);
    await expect(cachedSearch(' Spain ', signal)).resolves.toEqual(spain);

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('should keep different queries separate', async () => {
    const search = vi.fn().mockResolvedValueOnce(spain).mockResolvedValueOnce(france);
    const cachedSearch = createCachedSearch(search);
    const signal = new AbortController().signal;

    await cachedSearch('spain', signal);
    await cachedSearch('france', signal);

    expect(search).toHaveBeenCalledTimes(2);
  });

  it('should not cache failed requests', async () => {
    const error = new Error('network down');
    const search = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(spain);
    const cachedSearch = createCachedSearch(search);
    const signal = new AbortController().signal;

    await expect(cachedSearch('spain', signal)).rejects.toThrow('network down');
    await expect(cachedSearch('spain', signal)).resolves.toEqual(spain);

    expect(search).toHaveBeenCalledTimes(2);
  });

  it('should deduplicate concurrent identical requests', async () => {
    const pending = deferred<RawCountry[]>();
    const search = vi.fn().mockReturnValue(pending.promise);
    const cachedSearch = createCachedSearch(search);
    const signal = new AbortController().signal;

    const first = cachedSearch('spain', signal);
    const second = cachedSearch('spain', signal);

    expect(search).toHaveBeenCalledTimes(1);

    pending.resolve(spain);

    await expect(first).resolves.toEqual(spain);
    await expect(second).resolves.toEqual(spain);
  });

  it('should not abort a shared request when one of its consumers aborts', async () => {
    const pending = deferred<RawCountry[]>();
    let requestSignal: AbortSignal | undefined;
    const search = vi.fn((_query: string, signal: AbortSignal) => {
      requestSignal = signal;
      return pending.promise;
    });
    const cachedSearch = createCachedSearch(search);
    const firstController = new AbortController();
    const secondController = new AbortController();

    const first = cachedSearch('spain', firstController.signal);
    const second = cachedSearch('spain', secondController.signal);

    firstController.abort();

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(requestSignal?.aborted).toBe(false);

    pending.resolve(spain);

    await expect(second).resolves.toEqual(spain);
  });

  it('should abort the shared request when its last consumer aborts', async () => {
    const pending = deferred<RawCountry[]>();
    let requestSignal: AbortSignal | undefined;
    const search = vi.fn((_query: string, signal: AbortSignal) => {
      requestSignal = signal;
      return pending.promise;
    });
    const cachedSearch = createCachedSearch(search);
    const controller = new AbortController();

    const result = cachedSearch('spain', controller.signal);
    controller.abort();

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(requestSignal?.aborted).toBe(true);
  });

  it('should evict the least recently used entry when the cache is full', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce(spain)
      .mockResolvedValueOnce(france)
      .mockResolvedValueOnce(germany)
      .mockResolvedValueOnce(france);
    const cachedSearch = createCachedSearch(search, { maxEntries: 2 });
    const signal = new AbortController().signal;

    await cachedSearch('spain', signal);
    await cachedSearch('france', signal);
    await cachedSearch('spain', signal);
    await cachedSearch('germany', signal);
    await cachedSearch('france', signal);

    expect(search).toHaveBeenCalledTimes(4);
  });
});
