import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchController } from '../src/search/search-controller.js';

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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface ControlledCall {
  url: string;
  signal: AbortSignal;
  promise: Promise<Response>;
  resolve: (body: unknown) => void;
}

function controlledFetch(): {
  fetchMock: ReturnType<typeof vi.fn>;
  calls: ControlledCall[];
} {
  const calls: ControlledCall[] = [];

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const signal = init?.signal;

    if (!signal) {
      throw new Error('fetch must receive an AbortSignal');
    }

    let resolveResponse!: (response: Response) => void;
    let rejectResponse!: (error: unknown) => void;

    const promise = new Promise<Response>((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });

    const call: ControlledCall = {
      url: String(input),
      signal,
      promise,
      resolve: (body) => {
        resolveResponse(jsonResponse(body));
      },
    };

    calls.push(call);

    if (signal.aborted) {
      rejectResponse(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
      return promise;
    }

    signal.addEventListener(
      'abort',
      () => {
        rejectResponse(
          signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'),
        );
      },
      { once: true },
    );

    return promise;
  });

  return { fetchMock, calls };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('stale response race', () => {
  it('should abort the earlier request when the query changes and keep the latest result', async () => {
    const { fetchMock, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new SearchController({ debounceMs: 350 });

    controller.setQuery('sp');
    await vi.advanceTimersByTimeAsync(350);

    expect(calls).toHaveLength(1);
    const staleCall = calls[0];
    expect(staleCall.signal.aborted).toBe(false);

    controller.setQuery('spain');

    expect(staleCall.signal.aborted).toBe(true);
    await expect(staleCall.promise).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(controller.getState()).toMatchObject({
      status: 'loading',
      query: 'spain',
    });

    await vi.advanceTimersByTimeAsync(350);

    expect(calls).toHaveLength(2);
    const freshCall = calls[1];
    freshCall.resolve([spain]);

    await vi.advanceTimersByTimeAsync(0);

    expect(controller.getState().status).toBe('success');
    expect(controller.getState().query).toBe('spain');
    expect(controller.getState().results.map((country) => country.name)).toEqual(['Spain']);

    staleCall.resolve([{ name: 'Stale Spain' }]);

    await vi.advanceTimersByTimeAsync(0);

    expect(controller.getState().query).toBe('spain');
    expect(controller.getState().results.map((country) => country.name)).toEqual(['Spain']);
  });
});
