import { SearchController } from './search/search-controller.js';
import { createAppView } from './ui/render.js';

const root = document.createElement('div');
root.id = 'app';
document.body.append(root);

const controller = new SearchController();

const view = createAppView(root, {
  onQueryChange: (value) => {
    controller.setQuery(value);
  },
  onRetry: () => {
    controller.retry();
  },
});

controller.subscribe((state) => {
  view.update(state);
});

window.addEventListener('beforeunload', () => {
  controller.dispose();
});
