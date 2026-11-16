import type { Country } from '../api/types.js';
import type { SearchState } from '../search/search-controller.js';

export interface AppViewHandlers {
  onQueryChange: (value: string) => void;
  onRetry: () => void;
  onHistorySelect: (query: string) => void;
}

export interface AppView {
  update: (state: SearchState) => void;
  setHistory: (items: string[]) => void;
  setQueryValue: (value: string) => void;
}

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function createFlagFallback(country: Country): HTMLElement {
  const flag = createElement('span', 'country-flag-fallback', country.flagEmoji || '🏳️');
  flag.setAttribute('aria-hidden', 'true');
  return flag;
}

function createFlag(country: Country): HTMLElement {
  if (!country.flagUrl) {
    return createFlagFallback(country);
  }

  const image = createElement('img', 'country-flag');
  image.src = country.flagUrl;
  image.alt = `Flag of ${country.name}`;
  image.loading = 'lazy';
  image.width = 64;
  image.height = 48;

  image.addEventListener(
    'error',
    () => {
      image.replaceWith(createFlagFallback(country));
    },
    { once: true },
  );

  return image;
}

function createCountryCard(country: Country, onSelect: (country: Country) => void): HTMLLIElement {
  const item = createElement('li', 'country-item');
  const button = createElement('button', 'country-card');
  button.type = 'button';
  button.addEventListener('click', () => onSelect(country));

  const content = createElement('div', 'country-card-content');
  const name = createElement('h2', 'country-name', country.name);
  const capital = createElement('p', 'country-capital', country.capital);
  const region = createElement('p', 'country-region', country.region);
  const population = createElement(
    'p',
    'country-population',
    `Population: ${formatNumber(country.population)}`,
  );

  content.append(name, capital, region, population);
  button.append(createFlag(country), content);
  item.append(button);

  return item;
}

function createDetailsField(list: HTMLDListElement, label: string): HTMLElement {
  const group = createElement('div', 'details-row');
  const term = createElement('dt', undefined, label);
  const value = createElement('dd');

  group.append(term, value);
  list.append(group);

  return value;
}

function createDetailsView(root: HTMLElement): (country: Country) => void {
  const dialog = createElement('dialog', 'country-details');
  const article = createElement('article', 'details-content');
  const close = createElement('button', 'details-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close details');

  const closeLineA = createElement('span', 'details-close-line');
  const closeLineB = createElement('span', 'details-close-line');
  closeLineA.setAttribute('aria-hidden', 'true');
  closeLineB.setAttribute('aria-hidden', 'true');
  close.append(closeLineA, closeLineB);

  const flagSlot = createElement('div', 'details-flag');
  const name = createElement('h2', 'details-name');
  const native = createElement('p', 'details-native');
  const description = createElement('p', 'details-description');
  const list = createElement('dl', 'details-list');

  const fields = {
    capital: createDetailsField(list, 'Capital'),
    region: createDetailsField(list, 'Region'),
    population: createDetailsField(list, 'Population'),
    area: createDetailsField(list, 'Area'),
    borders: createDetailsField(list, 'Borders'),
    languages: createDetailsField(list, 'Languages'),
    currencies: createDetailsField(list, 'Currencies'),
  };

  article.append(close, flagSlot, name, native, description, list);
  dialog.append(article);
  root.append(dialog);

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  return (country: Country): void => {
    flagSlot.replaceChildren(createFlag(country));
    name.textContent = country.name;
    native.textContent = country.nativeName === country.name ? '' : country.nativeName;
    native.hidden = country.nativeName === country.name;
    description.textContent = country.description;

    fields.capital.textContent = country.capital;
    fields.region.textContent = country.subregion
      ? `${country.subregion}, ${country.region}`
      : country.region;
    fields.population.textContent = formatNumber(country.population);
    fields.area.textContent =
      country.area === null ? 'No data' : `${formatNumber(country.area)} km²`;
    fields.borders.textContent =
      country.borders.length > 0 ? country.borders.join(', ') : 'No land borders';
    fields.languages.textContent =
      country.languages.length > 0 ? country.languages.join(', ') : 'No language data';
    fields.currencies.textContent =
      country.currencies.length > 0 ? country.currencies.join(', ') : 'No currency data';

    if (!dialog.open) {
      dialog.showModal();
    }
  };
}

export function createAppView(root: HTMLElement, handlers: AppViewHandlers): AppView {
  const header = createElement('header', 'app-header');
  const title = createElement('h1', 'app-title', 'Country Search');
  const subtitle = createElement(
    'p',
    'app-subtitle',
    'Live search with cancellation of stale requests',
  );

  const searchField = createElement('div', 'search-field');
  const input = createElement('input', 'search-input');
  input.type = 'search';
  input.placeholder = 'Search countries...';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Search countries');
  input.setAttribute('aria-controls', 'search-results');

  const historySection = createElement('section', 'search-history');
  historySection.hidden = true;
  const historyTitle = createElement('p', 'history-title', 'Recent searches');
  const historyList = createElement('div', 'history-list');
  historySection.append(historyTitle, historyList);
  searchField.append(input, historySection);

  header.append(title, subtitle, searchField);

  const main = createElement('main', 'app-main');
  const status = createElement('div', 'status');
  status.setAttribute('aria-live', 'polite');

  const idle = createElement('section', 'state state-idle');
  idle.append(createElement('p', undefined, 'Start typing a country name to see results.'));

  const loading = createElement('section', 'state state-loading');
  const loadingRow = createElement('div', 'loading-row');
  const spinner = createElement('span', 'spinner');
  spinner.setAttribute('aria-hidden', 'true');
  loadingRow.append(spinner, createElement('p', undefined, 'Searching countries…'));
  loading.append(loadingRow);

  const notFound = createElement('section', 'state state-not-found');
  const notFoundTitle = createElement('h2', 'state-title', 'Nothing found');
  const notFoundText = createElement('p', 'state-message');
  notFound.append(notFoundTitle, notFoundText);

  const error = createElement('section', 'state state-error');
  const errorTitle = createElement('h2', 'state-title', 'Something went wrong');
  const errorMessage = createElement('p', 'state-message');
  const retryButton = createElement('button', 'retry-button', 'Retry');
  retryButton.type = 'button';
  error.append(errorTitle, errorMessage, retryButton);

  const results = createElement('ul', 'results');
  results.id = 'search-results';
  results.setAttribute('aria-label', 'Search results');

  status.append(idle, loading, notFound, error);
  main.append(status, results);

  const showDetails = createDetailsView(root);
  root.append(header, main);

  input.addEventListener('input', () => {
    handlers.onQueryChange(input.value);
  });
  retryButton.addEventListener('click', () => {
    handlers.onRetry();
  });

  input.focus({ preventScroll: true });

  return {
    setHistory(items: string[]): void {
      historySection.hidden = items.length === 0;
      historyList.replaceChildren(
        ...items.map((query) => {
          const button = createElement('button', 'history-item', query);
          button.type = 'button';
          button.addEventListener('click', () => {
            handlers.onHistorySelect(query);
          });
          return button;
        }),
      );
    },
    setQueryValue(value: string): void {
      input.value = value;
      input.focus({ preventScroll: true });
    },
    update(state: SearchState): void {
      status.hidden = state.status === 'success';
      idle.hidden = state.status !== 'idle';
      loading.hidden = state.status !== 'loading';
      notFound.hidden = state.status !== 'not-found';
      error.hidden = state.status !== 'error';
      results.hidden = state.status !== 'success';
      main.setAttribute('aria-busy', state.status === 'loading' ? 'true' : 'false');

      if (state.status === 'success') {
        results.replaceChildren(
          ...state.results.map((country) => createCountryCard(country, showDetails)),
        );
      } else {
        results.replaceChildren();
      }

      if (state.status === 'not-found') {
        notFoundText.textContent = `No countries match "${state.query}".`;
      }

      if (state.status === 'error') {
        const error = state.error;
        errorMessage.textContent =
          error && error.kind !== 'cancelled'
            ? error.message
            : 'Something went wrong. Please try again.';
      }
    },
  };
}
