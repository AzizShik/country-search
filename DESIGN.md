# DESIGN.md — Country Search

## 1. Задача

Приложение ищет страны по имени через `GET https://countries.dev/name/{query}` по мере ввода. Главная проблема — гонка ответов: запрос по `sp` может завершиться позже запроса по `spain` и перезаписать актуальный результат устаревшим.

Решение обязано использовать реальную отмену через `AbortController`, а не фильтрацию ответов по времени или флагу «это последний запрос».

## 2. Архитектура

```
src/
  api/
    types.ts              — RawCountry, Country, ApiLanguage, ApiCurrency
    http-error.ts         — HttpError extends Error
    search-countries.ts   — fetch + response.ok + 404 + timeout
    map-country.ts        — чистое преобразование RawCountry → Country
  lib/
    debounce.ts           — debounce(fn, delay) с cancel()
    errors.ts             — классификация AbortError / TimeoutError / HttpError
  search/
    search-controller.ts  — состояние, debounce, AbortController, retry
    cache.ts              — кэш ответов и дедупликация одновременных запросов
    history.ts            — история последних запросов в localStorage
  ui/
    render.ts             — DOM через createElement/textContent
  main.ts                 — composition root: controller + view
tests/
  debounce.test.ts
  map-country.test.ts
  search-countries.test.ts
  errors.test.ts
  search-controller.test.ts
  search-race.test.ts
  cache.test.ts
  history.test.ts
```

Слои не зависят от лишних деталей:

- `api` знает только про HTTP и форму ответа;
- `lib` содержит чистые утилиты;
- `search` оркестрирует запросы и состояние, но не знает про DOM;
- `ui` знает про DOM, но не делает сетевых запросов;
- `main.ts` связывает всё вместе.

Благодаря этому контроллер и маппер тестируются в Node без браузера и без реальной сети.

## 3. Отмена устаревших запросов

### Почему не флаг «актуальный ответ»

Флаг или сравнение таймстампа решают только симптом: устаревший ответ всё равно приходит, занимает соединение и может быть обработан. В Network tab такой запрос остаётся активным, а пользователь продолжает ждать данные, которые уже не нужны.

`AbortController` отменяет сам запрос:

- браузер помечает его как `canceled`;
- промис `fetch` отклоняется с `AbortError`;
- обработчик не выполняет лишнюю работу;
- старый ответ физически не может перезаписать новое состояние.

В коде есть и проверка `query !== currentQuery` после `await`, но она является только страховкой от редкой гонки микрозадач. Основной механизм — `abort()`.

### Как это устроено

1. На каждый `input` вызывается `SearchController.setQuery`.
2. `setQuery` **сразу** отменяет текущий `AbortController`, ещё до того как debounce решит отправлять новый запрос:

   ```ts
   this.activeController?.abort();
   this.activeController = null;
   ```

3. Затем сбрасывается ожидающий таймер debounce и планируется новый вызов.
4. Когда debounce срабатывает, `run` создаёт новый `AbortController` и передаёт его сигнал в `searchCountries`.
5. `searchCountries` объединяет сигнал контроллера с таймаутом:

   ```ts
   AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
   ```

6. В `catch` контроллер различает причины:

   ```ts
   if (controller.signal.aborted) return;
   const classified = classifyError(error);
   if (classified.kind === 'cancelled') return;
   ```

   Отмена своего запроса не показывается пользователю.

Отмена происходит именно в `setQuery`, а не только в момент старта нового сетевого запроса. Это важно: между вводом `spain` и срабатыванием debounce проходит 350 мс, и за это время старый `sp` успел бы прийти и отрендериться под новым текстом.

### Таймаут

Таймаут — это настоящая ошибка, а не отмена пользователем. `AbortSignal.timeout(8000)` создаёт отдельный сигнал; `AbortSignal.any` пробрасывает причину того сигнала, который сработал первым:

- пользователь изменил ввод → `DOMException` с `name === 'AbortError'`;
- сервер не ответил → `DOMException` с `name === 'TimeoutError'`.

`classifyError` проверяет `name`, а не только `signal.aborted`, поэтому эти случаи не смешиваются. `TimeoutError` показывается как ошибка с кнопкой «Повторить».

### 404

`countries.dev` отвечает `404`, когда совпадений нет. `searchCountries` проверяет статус **до** `response.ok`:

```ts
if (response.status === 404) return [];
if (!response.ok) throw new HttpError(response.status, response.statusText);
```

Пустой массив превращается в состояние `not-found`, а не в `error`. Пользователь видит «Nothing found», а не сообщение о сбое.

### Повтор

`SearchController.retry()` берёт `currentQuery` — последний введённый запрос — и запускает его без debounce. Кнопка «Повторить» не использует текст из момента ошибки, если пользователь уже начал печатать что-то другое.

## 4. Debounce

Задержка — `350 мс` (`DEFAULT_DEBOUNCE_MS`).

Почему именно столько:

- без debounce каждый символ отправляет запрос: при вводе `spain` это 5 запросов вместо одного;
- слишком маленькая задержка (50–100 мс) почти не снижает количество запросов при быстром наборе;
- слишком большая (800–1000 мс) делает поиск «тормозным»: пользователь уже закончил печатать, а запрос ещё не ушёл;
- 300–400 мс — рабочий диапазон, при котором интерфейс остаётся отзывчивым, а лишние запросы отсекаются.

`debounce` реализован самостоятельно на `setTimeout`/`clearTimeout`. Каждый новый вызов сбрасывает предыдущий таймер и запоминает последние аргументы. Дополнительно есть `cancel()`, который нужен при очистке поля и при `dispose()`.

## 5. Состояния интерфейса

`SearchState` — discriminated union по `status`:

- `idle` — пустой ввод;
- `loading` — идёт debounce или запрос;
- `success` — непустой список;
- `not-found` — пустой ответ, 404;
- `error` — таймаут, HTTP-ошибка или сеть.

`SearchController` не знает про DOM: он только вызывает слушателей. `createAppView` подписывается на состояние и переключает секции через `hidden`, а список пересобирает через `replaceChildren`. Динамический HTML не используется: только `createElement` и `textContent`, поэтому пользовательские данные не могут внедрить разметку.

Клик по карточке открывает `<dialog>` с деталями: описание, площадь, границы, языки, валюта. Поля приходят из того же ответа API, отдельный запрос не нужен.

## 6. Кэш и дедупликация

`createCachedSearch` оборачивает `searchCountries` и решает две задачи.

### Кэш

Ключ — `query.trim().toLowerCase()`, поэтому `Spain`, `spain` и `Spain` попадают в одну запись. Кэшируются только успешные ответы, включая пустой массив (404). Ошибки не кэшируются: следующий запрос снова идёт в сеть.

Кэш ограничен 50 записями и работает как LRU: при чтении запись перемещается в конец `Map`, при переполнении удаляется самая старая. Это не даёт памяти расти бесконечно при долгой сессии.

### Дедупликация

Если одинаковый запрос уже в полёте, второй вызывающий не создаёт новый `fetch`, а подписывается на существующий промис. Внутри хранится:

```ts
{
  controller: AbortController,
  promise: Promise<RawCountry[]>,
  consumers: number
}
```

У каждого вызывающего свой внешний `AbortSignal`. Отмена одного потребителя:

1. уменьшает `consumers`;
2. отклоняет только его собственный промис с `AbortError`;
3. **не отменяет** общий запрос, пока живы другие потребители.

Общий сетевой запрос отменяется только когда `consumers` доходит до нуля. Поэтому сценарий «один вызывающий передумал, остальные ждут результат» не ломается. Это и есть требование бонуса: сигнал отмены не должен быть общим для всех.

### История

`SearchHistory` хранит последние 6 запросов в `localStorage` под ключом `country-search-history`. Записи дедуплицируются без учёта регистра, новые идут первыми. Повреждённый JSON или не-массив в storage не роняют приложение: `getAll()` возвращает пустой список.

Клик по истории вызывает `SearchController.searchImmediately(query)` — поиск запускается без debounce. Если ответ уже в кэше, он возвращается сразу, без сетевого запроса.

## 7. Сложность

`mapCountryResponse` обрабатывает одну страну:

- языки: O(L), где L — количество языков;
- валюты: O(C), где C — количество валют;
- границы: O(B), где B — количество границ (копия массива);
- остальные поля: O(1).

Итого O(L + C + B) по времени и O(L + C + B) по памяти на новые массивы. Если маппить массив из n стран, получается O(n · (L + C + B)).

`debounce` — O(1) на вызов и O(1) памяти. `classifyError` — O(1). `searchCountries` добавляет O(m) на парсинг JSON, где m — размер ответа. Рендер списка — O(n) по количеству карточек.

Кэш: чтение и запись в `Map` — O(1) в среднем, LRU-перемещение — O(1), память O(k), где k ≤ 50. Дедупликация: поиск в `Map` — O(1) в среднем, память O(i), где i — количество одновременных уникальных запросов (на практике 1–2). История: `getAll()` парсит массив из не более чем 6 элементов — O(h), `add()` делает `filter` + `unshift` — O(h), память O(h). Итоговая практическая сложность остаётся O(1) по числу запросов и O(n · (L + C + B)) на отображение n стран.

## 8. Принципы чистого кода

- **Единственная ответственность.** `search-countries.ts` отвечает только за HTTP, `map-country.ts` — только за преобразование, `search-controller.ts` — за состояние и отмену, `render.ts` — за DOM.
- **Чистые функции.** `mapCountryResponse` не мутирует вход и не обращается к сети/DOM. `classifyError` не имеет побочных эффектов. `debounce` изолирован замыканием.
- **Инъекция зависимостей.** `SearchController` принимает `search` и `debounceMs` через `SearchControllerOptions`; в тестах это позволяет управлять поведением без подмены глобального состояния.
- **Явные ошибки.** `HttpError` хранит `status`, `classifyError` возвращает discriminated union, а не набор boolean-флагов.
- **Неизменяемость состояния.** Контроллер создаёт новый объект состояния, а `mapCountryResponse` копирует массивы (`borders: [...(raw.borders ?? [])]`).
- **DRY.** `createElement` в `render.ts` убирает повторение `document.createElement` + `textContent`; `createDetailsField` переиспользуется для всех полей детального вида.
- **Безопасный DOM.** В `render.ts` нет `innerHTML`/`insertAdjacentHTML`; текст пользовательских данных проходит через `textContent`.
- **Тестируемость.** Логика не зависит от DOM, тесты используют fake timers и управляемый fetch-мок, который реагирует на `signal`. `createCachedSearch` и `SearchHistory` принимают зависимости снаружи: search-функцию и storage.
- **Изоляция отмены.** `cache.ts` хранит отдельный внутренний `AbortController` для общего запроса и счётчик потребителей; внешний сигнал каждого вызывающего обрабатывается отдельно. `history.ts` не знает про `localStorage` напрямую — получает `StorageLike`, поэтому тестируется с in-memory storage.

## 9. Тесты и порядок коммитов

Для обязательных функций соблюдён порядок «красный тест → реализация»:

```
test: add failing tests for debounce
feat: implement debounce
test: add failing tests for mapCountryResponse
feat: implement mapCountryResponse
test: add failing tests for searchCountries and HttpError
feat: implement searchCountries and HttpError
test: add failing tests for error classification
feat: implement error classification
test: add failing tests for search controller
feat: implement search controller
test: add race-condition test for stale responses
fix: abort stale requests on every input change
test: add failing tests for cached search
feat: add cached search with deduplication
test: add failing tests for search history
feat: add search history storage
feat: integrate cached search and search history
```

Тест гонки (`tests/search-race.test.ts`) использует мок fetch, который:

- хранит промис каждого вызова;
- позволяет резолвить ответы вручную в любом порядке;
- при вызове `abort()` на переданном сигнале отклоняет промис с `AbortError`.

Тест проверяет, что после ввода `spain` сигнал запроса `sp` уже отменён, ответ `spain` попадает в состояние, а поздний `sp` не может его перезаписать.

## 10. Ограничения

- Кэш живёт в памяти вкладки и очищается при перезагрузке; в `localStorage` сохраняется только история запросов.
- `AbortSignal.any` требует современного браузера; для старых окружений нужна ручная связка сигналов.
- API не отдаёт поле `description`, поэтому описание в детальном виде собирается из `nativeName`, `subregion` и `demonym`.
