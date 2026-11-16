import { searchCountries } from './api/search-countries.js';
import { createCachedSearch } from './search/cache.js';
import { SearchHistory } from './search/history.js';
import { SearchController } from './search/search-controller.js';
import { createAppView } from './ui/render.js';
import type { AppView } from './ui/render.js';

const root = document.createElement('div');
root.id = 'app';
document.body.append(root);

const history = new SearchHistory(window.localStorage);
const cachedSearch = createCachedSearch(searchCountries);

const app: { view?: AppView } = {};

const controller = new SearchController({
  search: cachedSearch,
  onSearch: (query) => {
    const items = history.add(query);
    app.view?.setHistory(items);
  },
});

app.view = createAppView(root, {
  onQueryChange: (value) => {
    controller.setQuery(value);
  },
  onRetry: () => {
    controller.retry();
  },
  onHistorySelect: (query) => {
    app.view?.setQueryValue(query);
    controller.searchImmediately(query);
  },
});

app.view.setHistory(history.getAll());

controller.subscribe((state) => {
  app.view?.update(state);
});

window.addEventListener('beforeunload', () => {
  controller.dispose();
});
