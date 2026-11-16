# Country Search

Живой поиск стран по имени с отменой устаревших запросов через `AbortController`.

**Демо:** https://azizshik.github.io/country-search/

## Возможности

- поиск по мере ввода с debounce 350 мс;
- реальная отмена предыдущего запроса при каждом изменении ввода;
- отдельная обработка `AbortError`, `TimeoutError`, `HttpError` и 404;
- состояния `idle`, `loading`, `success`, `not-found`, `error`;
- кнопка «Повторить» для последнего запроса;
- карточки стран с флагом, столицей, регионом и населением;
- детальный вид по клику: описание, площадь, границы, языки, валюта;
- кэш ответов и дедупликация одновременных одинаковых запросов;
- история последних запросов в `localStorage` с мгновенным повтором.

## Стек

- TypeScript, ES-модули;
- Vite для dev-сервера и сборки;
- Vitest для тестов, fake timers и мок fetch;
- ESLint, Prettier, Husky, lint-staged;
- GitHub Pages для деплоя.

## Команды

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 45 тестов
npm run build      # typecheck + production build в dist
npm run preview    # просмотр production-сборки
npm run lint
npm run format
npm run deploy     # публикация dist в ветку gh-pages
```

## Архитектура

```
src/api       — HTTP, HttpError, маппинг ответа
src/lib       — debounce и классификация ошибок
src/search    — SearchController, кэш/дедупликация, история
src/ui        — DOM через createElement/textContent, без innerHTML
src/main.ts   — связывание контроллера и представления
```

Подробности решений и Big O — в [DESIGN.md](./DESIGN.md).

## Проверка

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
```
