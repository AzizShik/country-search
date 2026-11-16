import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchController } from '../src/search/search-controller';

const spain = {
  name: 'Spain',
  nativeName: 'España',
  flag: '🇪🇸',
  flags: { svg: 'https://flagcdn.com/es.svg' },
  capital: 'Madrid',
  region: 'Europe',
  subregion: 'Southern Europe',
  population: 47351567,
  area: 505992,
  borders: ['PRT'],
  languages: [{ name: 'Spanish' }],
  currencies: [{ code: 'EUR', name: 'Euro' }],
  alpha2Code: 'ES',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function pendingFetch(): ReturnType<typeof vi.fn> {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => {
          reject(
            init.signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError'),
          );
        },
        { once: true },
      );
    });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('SearchController', () => {
  it('should start in the idle state', () => {
    const controller = new SearchController();

    expect(controller.getState()).toEqual({
      status: 'idle',
      query: '',
      results: [],
      error: null,
    });
  });

  it('should not fetch for an empty query and should clear the list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new SearchController({ debounceMs: 350 });

    controller.setQuery('   ');
    await vi.advanceTimersByTimeAsync(1000);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(controller.getState().status).toBe('idle');
    expect(controller.getState().results).toEqual([]);
  });

  it('should show loading during debounce and then success with mapped results', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([spain]));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new SearchController({ debounceMs: 350 });

    controller.setQuery('spain');

    expect(controller.getState().status).toBe('loading');
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(350);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(controller.getState().status).toBe('success');
    expect(controller.getState().query).toBe('spain');
    expect(controller.getState().results[0]).toMatchObject({
      name: 'Spain',
      capital: 'Madrid',
      languages: ['Spanish'],
    });
  });

  it('should debounce rapid input and request only the latest query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([spain]));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new SearchController({ debounceMs: 350 });

    controller.setQuery('sp');
    await vi.advanceTimersByTimeAsync(200);
    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(349);

    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/name/spain');
  });

  it('should show not-found for an empty result set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const controller = new SearchController({ debounceMs: 350 });

    controller.setQuery('zzzzzz');
    await vi.advanceTimersByTimeAsync(350);

    expect(controller.getState().status).toBe('not-found');
    expect(controller.getState().results).toEqual([]);
    expect(controller.getState().error).toBeNull();
  });

  it('should show an http error with the status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const controller = new SearchController({ debounceMs: 350 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(350);

    expect(controller.getState().status).toBe('error');
    expect(controller.getState().error).toMatchObject({
      kind: 'http',
      status: 500,
    });
  });

  it('should search immediately without waiting for debounce', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([spain]));
    vi.stubGlobal('fetch', fetchMock);
    const onSearch = vi.fn();
    const controller = new SearchController({ debounceMs: 350, onSearch });

    controller.searchImmediately('spain');

    expect(controller.getState().status).toBe('loading');
    expect(onSearch).toHaveBeenCalledWith('spain');

    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(controller.getState().status).toBe('success');
  });

  it('should retry the last query', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(jsonResponse([spain]));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new SearchController({ debounceMs: 350 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(350);
    expect(controller.getState().status).toBe('error');

    controller.retry();
    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(controller.getState().status).toBe('success');
    expect(controller.getState().results[0]?.name).toBe('Spain');
  });

  it('should not show an error when the input is cleared', async () => {
    const fetchMock = pendingFetch();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new SearchController({ debounceMs: 350 });

    controller.setQuery('spain');
    await vi.advanceTimersByTimeAsync(350);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const signal = init.signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    controller.setQuery('');
    await vi.advanceTimersByTimeAsync(0);

    expect(signal.aborted).toBe(true);
    expect(controller.getState().status).toBe('idle');
    expect(controller.getState().error).toBeNull();
  });
});
