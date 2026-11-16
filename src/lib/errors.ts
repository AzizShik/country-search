import { HttpError } from '../api/http-error.js';

export type ErrorKind = 'cancelled' | 'timeout' | 'http' | 'network';

export type ClassifiedError =
  | { kind: 'cancelled' }
  | { kind: 'timeout'; message: string }
  | { kind: 'http'; status: number; message: string }
  | { kind: 'network'; message: string };

function hasName(error: unknown, expectedName: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === expectedName
  );
}

export function isAbortError(error: unknown): boolean {
  return hasName(error, 'AbortError');
}

export function isTimeoutError(error: unknown): boolean {
  return hasName(error, 'TimeoutError');
}

export function classifyError(error: unknown): ClassifiedError {
  if (isAbortError(error)) {
    return { kind: 'cancelled' };
  }

  if (isTimeoutError(error)) {
    return {
      kind: 'timeout',
      message: 'The request took too long. Please try again.',
    };
  }

  if (error instanceof HttpError) {
    return {
      kind: 'http',
      status: error.status,
      message: `The server responded with HTTP ${error.status}.`,
    };
  }

  return {
    kind: 'network',
    message: 'Could not reach the server. Check your connection and try again.',
  };
}
