import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '../src/api/http-error.js';
import { searchCountries } from '../src/api/search-countries.js';

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchCountries', () => {
  it('should return the parsed array from a successful response', async () => {
    const payload = [{ name: 'Spain', capital: 'Madrid' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(payload)));

    await expect(searchCountries('spain', new AbortController().signal)).resolves.toEqual(payload);
  });

  it('should request the encoded query and pass a signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await searchCountries('côte d’ivoire', controller.signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://countries.dev/name/${encodeURIComponent('côte d’ivoire')}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('should treat 404 as an empty result instead of an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(searchCountries('zzzzzz', new AbortController().signal)).resolves.toEqual([]);
  });

  it('should throw HttpError with the status for other unsuccessful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    const request = searchCountries('spain', new AbortController().signal);

    await expect(request).rejects.toBeInstanceOf(HttpError);
    await expect(request).rejects.toMatchObject({ status: 500 });
  });

  it('should propagate AbortError when the caller aborts', async () => {
    vi.stubGlobal('fetch', pendingFetch());
    const controller = new AbortController();

    const request = searchCountries('spain', controller.signal);
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('should reject with TimeoutError when the server is too slow', async () => {
    vi.stubGlobal('fetch', pendingFetch());

    const request = searchCountries('spain', new AbortController().signal, 20);

    await expect(request).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
