import { mapCountryResponse } from '../api/map-country.js';
import { searchCountries } from '../api/search-countries.js';
import type { RawCountry, Country } from '../api/types.js';
import { debounce } from '../lib/debounce.js';
import type { DebouncedFunction } from '../lib/debounce.js';
import { classifyError } from '../lib/errors.js';
import type { ClassifiedError } from '../lib/errors.js';

export const DEFAULT_DEBOUNCE_MS = 350;

export type SearchStatus = 'idle' | 'loading' | 'success' | 'not-found' | 'error';

export interface SearchState {
  status: SearchStatus;
  query: string;
  results: Country[];
  error: ClassifiedError | null;
}

export type SearchFn = (query: string, signal: AbortSignal) => Promise<RawCountry[]>;

export interface SearchControllerOptions {
  debounceMs?: number;
  search?: SearchFn;
}

type Listener = (state: SearchState) => void;

function createInitialState(): SearchState {
  return {
    status: 'idle',
    query: '',
    results: [],
    error: null,
  };
}

export class SearchController {
  private state: SearchState = createInitialState();
  private readonly listeners = new Set<Listener>();
  private readonly search: SearchFn;
  private readonly debouncedSearch: DebouncedFunction<[string]>;
  private activeController: AbortController | null = null;
  private currentQuery = '';

  constructor(options: SearchControllerOptions = {}) {
    this.search = options.search ?? searchCountries;
    this.debouncedSearch = debounce((query: string): void => {
      void this.run(query);
    }, options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  }

  getState(): SearchState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  setQuery(value: string): void {
    const query = value.trim();
    this.currentQuery = query;
    this.debouncedSearch.cancel();

    if (!query) {
      this.activeController?.abort();
      this.activeController = null;
      this.setState(createInitialState());
      return;
    }

    this.setState({
      status: 'loading',
      query,
      results: [],
      error: null,
    });
    this.debouncedSearch(query);
  }

  retry(): void {
    if (!this.currentQuery) {
      return;
    }

    this.debouncedSearch.cancel();
    this.setState({
      status: 'loading',
      query: this.currentQuery,
      results: [],
      error: null,
    });
    void this.run(this.currentQuery);
  }

  dispose(): void {
    this.debouncedSearch.cancel();
    this.activeController?.abort();
    this.activeController = null;
    this.listeners.clear();
  }

  private async run(query: string): Promise<void> {
    this.activeController?.abort();
    const controller = new AbortController();
    this.activeController = controller;

    try {
      const raw = await this.search(query, controller.signal);
      const results = raw.map(mapCountryResponse);

      this.setState({
        status: results.length === 0 ? 'not-found' : 'success',
        query,
        results,
        error: null,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      const classified = classifyError(error);

      if (classified.kind === 'cancelled') {
        return;
      }

      this.setState({
        status: 'error',
        query,
        results: [],
        error: classified,
      });
    } finally {
      if (this.activeController === controller) {
        this.activeController = null;
      }
    }
  }

  private setState(state: SearchState): void {
    this.state = state;

    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
