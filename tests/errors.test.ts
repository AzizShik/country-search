import { afterEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '../src/api/http-error.js';
import { searchCountries } from '../src/api/search-countries.js';
import { classifyError, isAbortError, isTimeoutError } from '../src/lib/errors.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('classifyError', () => {
  it('should treat AbortError as a silent cancellation', () => {
    const error = new DOMException('The operation was aborted.', 'AbortError');

    expect(isAbortError(error)).toBe(true);
    expect(isTimeoutError(error)).toBe(false);
    expect(classifyError(error)).toEqual({ kind: 'cancelled' });
  });

  it('should classify TimeoutError separately from AbortError', () => {
    const error = new DOMException('The operation timed out.', 'TimeoutError');

    expect(isTimeoutError(error)).toBe(true);
    expect(isAbortError(error)).toBe(false);
    expect(classifyError(error)).toMatchObject({ kind: 'timeout' });
  });

  it('should classify HttpError and keep its status', () => {
    const error = new HttpError(503, 'Service Unavailable');

    expect(classifyError(error)).toMatchObject({
      kind: 'http',
      status: 503,
    });
  });

  it('should classify unknown failures as network errors', () => {
    expect(classifyError(new TypeError('Failed to fetch'))).toMatchObject({
      kind: 'network',
    });
    expect(classifyError('boom')).toMatchObject({ kind: 'network' });
  });

  it('should not treat a regular Error as a cancellation', () => {
    expect(isAbortError(new Error('boom'))).toBe(false);
    expect(classifyError(new Error('boom'))).toMatchObject({ kind: 'network' });
  });
});

describe('404 handling', () => {
  it('should turn 404 into an empty list instead of an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const results = await searchCountries('zzzzzz', new AbortController().signal);

    expect(results).toEqual([]);
  });
});
