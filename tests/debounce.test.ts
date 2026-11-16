import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { debounce } from '../src/lib/debounce.js';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not call the function before the delay elapses', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('spain');
    vi.advanceTimersByTime(299);

    expect(fn).not.toHaveBeenCalled();
  });

  it('should call the function once with the latest arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('spain');
    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('spain');
  });

  it('should restart the timer when called again', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('sp');
    vi.advanceTimersByTime(200);
    debounced('spain');
    vi.advanceTimersByTime(299);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('spain');
  });

  it('should schedule a new call after the previous one fired', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('spain');
    vi.advanceTimersByTime(100);
    debounced('france');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenNthCalledWith(1, 'spain');
    expect(fn).toHaveBeenNthCalledWith(2, 'france');
  });

  it('should prevent the pending call when cancelled', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('spain');
    debounced.cancel();
    vi.advanceTimersByTime(300);

    expect(fn).not.toHaveBeenCalled();
  });
});
