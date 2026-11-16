import { HttpError } from './http-error.js';
import type { RawCountry } from './types.js';

export const REQUEST_TIMEOUT_MS = 8_000;

export async function searchCountries(
  query: string,
  signal: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<RawCountry[]> {
  const url = `https://countries.dev/name/${encodeURIComponent(query)}`;
  const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);

  const response = await fetch(url, {
    signal: combinedSignal,
    headers: { Accept: 'application/json' },
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new HttpError(response.status, response.statusText);
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Unexpected response shape from countries.dev');
  }

  return data as RawCountry[];
}
