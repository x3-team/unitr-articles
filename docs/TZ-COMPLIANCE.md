# Соответствие ТЗ (Приложение № 4)

Для каждого пункта: где реализовано, как это работает на демо (GitHub Pages) и на боевом сервере, чем проверено.
Автопроверка — `scripts/check-acceptance.mjs` (исходный HTML без JavaScript + ответы сервера, как в п. 5.2 договора);
сквозные тесты — `tests/e2e/run-graphql-e2e.mjs` (Node.js-вариант на данных из GraphQL) и `tests/e2e/run-apache-e2e.mjs`
(статический вариант на настоящем Apache поверх SPA с fallback на index.html); WP-плагин — `tests/wp/run-wp-smoke.sh`
(настоящий WordPress 6.5 в Playground). Всё запускается в CI на каждый коммит, проверка демо — после каждой
публикации на Pages (отчёт в сводке GitHub Actions).

Боевая выкладка — двумя способами на выбор по итогам разведки сервера ([RUNBOOK.md](RUNBOOK.md)):
**А** — Node.js (SSR + ISR + вебхук), **Б** — статика + `.htaccess` для хостинга без Node.js. Колонка «Статус»
ниже относится к обоим, если не сказано иное.

Обозначения: ✅ — выполнено одинаково на демо и на бою; 🟡 — на Pages невозможно технически, сделан ближайший
аналог, на бою — полноценно (реализовано и проверено в боевом режиме локально и в CI).

## Задача 1.1. Архив `/articles/`

| Требование | Статус | Реализация | Проверка |
|---|---|---|---|
| Серверный шаблон с выборкой рубрики poleznye-stati через GraphQL WordPress | ✅ | `src/app/articles/page.tsx`, `src/lib/content/graphql.ts` (запрос `posts(where: {categoryName: "poleznye-stati", status: PUBLISH})`, подрубрики включаются) | e2e: данные из GraphQL |
| H1 «Статьи», анонсы (обложка, заголовок, excerpt, дата, ссылка) в серверном HTML без JS | ✅ | `ArchiveView`, `ArticleCard` | check-acceptance 1.1 |
| 10 анонсов, `/articles/page/2/`…, «предыдущая/следующая», номера страниц | ✅ | `src/app/articles/page/[page]/page.tsx`, `Pagination` (номера с «…», как в макете) | check-acceptance 1.1 |
| Количество анонсов — в конфигурации, меняется Заказчиком без кода | ✅ | WordPress: Настройки → Раздел «Статьи» (поле `unitrArticlesSettings.perPage`); переопределение — `ARTICLES_PER_PAGE` | e2e: смена 10 → 5 в WP |
| Смещение списка при снятии статьи (без пустых мест) | ✅ | список формируется из опубликованных записей и режется на страницы | e2e: снятие с публикации |
| canonical на `/articles/` и на каждой странице пагинации — на себя | ✅ | `src/lib/meta.ts` (`alternates.canonical`) + `rel=prev/next` | check-acceptance 1.1 |
| Собственные title / description, отличные от главной; хлебные крошки; BreadcrumbList | ✅ | `src/lib/archive-copy.ts`, `Breadcrumbs`, JSON-LD `BreadcrumbList` + `CollectionPage` | check-acceptance 1.1 |

## Задача 1.2. Статья `/articles/<slug>/`

| Требование | Статус | Реализация | Проверка |
|---|---|---|---|
| Полный текст в серверном HTML | ✅ | `src/app/articles/[slug]/page.tsx` | check-acceptance 1.2 (все статьи) |
| title / description из полей WordPress | ✅ | поля «SEO для раздела «Статьи»» (плагин; ACF или свой блок) → `Post.unitrSeo`; запасные: Yoast/Rank Math → заголовок/анонс | e2e: SEO из WP |
| canonical на саму статью | ✅ | `pageMetadata` | check-acceptance 1.2 |
| Schema.org Article (заголовок, даты публикации и изменения, автор, обложка) + Open Graph | ✅ | `src/lib/seo.ts` `articleLd`, `og:type=article`, `article:published_time` и т.д. | check-acceptance 1.2 |
| ЧПУ на латинице из заголовка | ✅ | WP-плагин транслитерирует `post_name` при сохранении; фронтенд страхует транслитерацией (`src/lib/slugify.ts`, таблица совпадает с PHP) | юнит-тест, e2e: кириллический slug |
| Подзаголовки H2/H3 | ✅ | разметка редактора WordPress выводится как есть, стили `.prose h2/h3` | check-acceptance 1.2 |
| «Предыдущая / следующая статья», хлебные крошки с возвратом в раздел | ✅ | `post-nav`, `Breadcrumbs`, ссылка «К статьям» (как «К новостям» в макете) | check-acceptance 1.2 |

## Задача 2. Пункт «Статьи» в меню

| Требование | Статус | Реализация | Проверка |
|---|---|---|---|
| Пункт «Статьи» → `/articles/` рядом с «Каталог» и «Конфигураторы» | ✅ | `src/components/Header.tsx` | check-acceptance 2 |
| Десктоп и мобильная версия | ✅ | мобильное меню открывается без JS (чекбокс + CSS), ссылки в серверном HTML | check-acceptance 2, скриншоты |
| Ссылка в серверном HTML, выделение активного пункта | ✅ | `aria-current="page"` + зелёное подчёркивание | check-acceptance 2 |

> На бою шапка основного сайта unitr.ru должна получить тот же пункт. Если основной сайт — отдельное SPA,
> в его шапку добавляется ссылка `<a href="/articles/">Статьи</a>` (в серверной HTML-оболочке); компонент
> `Header` раздела повторяет шапку макета «Юнит-Ресурс». См. docs/DEPLOY.md.

## Задача 3. Автообновление и кеш

| Требование | Статус | Реализация | Проверка |
|---|---|---|---|
| Опубликованная статья появляется в архиве, на 1-й странице и в sitemap ≤ 15 мин | ✅ / 🟡 | Бой А: вебхук из WordPress → мгновенно; без вебхука — кеш данных 300 с + ISR 300 с (худший случай 10 мин). Бой Б: сигнал из WordPress запускает пересборку (2–3 мин), без него — каждые 10 мин (`.github/workflows/deploy-static.yml`). Pages: пересборка по расписанию каждые 15 мин (`.github/workflows/pages.yml`) | e2e: публикация |
| Изменения и снятие с публикации без правки кода | ✅ | данные только из WordPress, статус `PUBLISH` | e2e: снятие, смена адреса |
| Ревалидация по событию публикации либо TTL ≤ 15 мин | ✅ | `POST /api/revalidate/` (секрет), `revalidateTag` + `revalidatePath`; WP-плагин шлёт вебхук при публикации/изменении/снятии/удалении, смене рубрик и настроек | e2e, check-acceptance 3 |

🟡 GitHub Pages не исполняет серверный код, поэтому «ревалидация» демо — это пересборка по cron. Расписание
GitHub Actions может задерживаться при высокой нагрузке GitHub; на боевом сервере этого ограничения нет.

## Задача 4. sitemap.xml и индексация

| Требование | Статус | Реализация | Проверка |
|---|---|---|---|
| Динамическая `/sitemap.xml` из данных WordPress и страниц сайта | ✅ | `src/app/sitemap.xml/route.ts`, `src/lib/sitemap.ts`; страницы сайта — из WordPress (`pages`) + `SITE_STATIC_PAGES` | check-acceptance 4 |
| Главная, каталог, `/articles/`, статьи, пагинация, `<lastmod>` | ✅ | `buildEntries` | check-acceptance 4, юнит-тест |
| Новая статья, новая рубрика, смена адреса, снятие — ≤ 15 мин без ручной правки | ✅ / 🟡 | тот же кеш и вебхук, что у страниц; подрубрики появляются автоматически (`/articles/category/<slug>/`) | e2e: все четыре события |
| Секционирование (sitemap index) > 50 000 URL / 50 МБ | ✅ | `splitEntries` + `/sitemaps/N.xml` | юнит-тест на 120 001 URL и > 50 МБ |
| HTTP 200, `application/xml` | ✅ | заголовок в route handler; Pages отдаёт .xml как `application/xml` | check-acceptance 4 |
| robots.txt: адрес карты, явное Allow `/articles/` | ✅ / 🟡 | `src/app/robots.txt/route.ts`. На Pages файл лежит в подкаталоге проекта (`/unitr-articles/robots.txt`) — поисковики читают robots.txt только из корня домена; на бою он в корне unitr.ru | check-acceptance 4 |
| Нет noindex в robots.txt, метатегах и `X-Robots-Tag` | ✅ | `robots: index, follow`; на бою `X-Robots-Tag: all` для `/articles/*` | check-acceptance 4 |

## Задача 5. Маршрутизация, безопасность, развёртывание

| Требование | Статус | Реализация | Проверка |
|---|---|---|---|
| 404 для несуществующих адресов внутри `/articles/` (не 200 с SPA-оболочкой) | ✅ | А: `notFound()` в шаблонах → HTTP 404 + `not-found.tsx`. Б: `articles/.htaccess` (`R=404` + `ErrorDocument`), правила SPA на раздел не действуют. Pages отдаёт `404.html` с кодом 404 | check-acceptance 5, e2e Apache |
| 301 с `/blog`, `/blog/`, `/poleznye-stati`, `/poleznye-stati/` на `/articles/` с сохранением адреса статьи | ✅ / 🟡 | Бой А: `src/middleware.server.ts` — HTTP 301; бой Б: те же правила в `.htaccess` (`scripts/export-apache.mjs`), HTTP 301 (`/blog/<slug>/` → `/articles/<slug>/`, плюс прежние slug, `/articles/page/1/`, адреса без слеша). Pages не умеет 301 на произвольный адрес: `/blog` → 301 на `/blog/` (делает сам Pages), там мгновенная переадресация `meta refresh` + `canonical` на `/articles/` (`scripts/postexport.mjs`) | check-acceptance 5 (бой — строго 301) |
| Выборка через GraphQL на сервере (BFF), токен изолирован от клиентского JS | ✅ | `src/lib/content/graphql.ts` (`server-only`, переменные без `NEXT_PUBLIC_`); BFF для SPA — `/api/articles/` | check-acceptance 5: в JS-бандлах нет токена/адреса WP; e2e: все запросы к WP с токеном и только с сервера |
| Развёртывание на рабочем сервере unitr.ru | ⏳ | подготовлено: разведка сервера `deploy/preflight.sh`; вариант А — `deploy/` (nginx/Apache, systemd/PM2, сборка релиза); вариант Б — `.github/workflows/deploy-static.yml` + `scripts/deploy-static.sh` (SFTP/FTP, резервные копии `.htaccess`/robots.txt, блок в `.htaccess` между маркерами). План — [RUNBOOK.md](RUNBOOK.md) | ждёт доступа к серверу Reg.ru; оба варианта проверены локально (Node.js — 58/58, Apache — 54/54) |

## WordPress (manage.unitr.ru)

Плагин `wp/unitr-articles` (см. `wp/README.md`): рубрика `poleznye-stati`, обложка (featured image), анонс (excerpt),
SEO title/description (ACF-группа или собственный блок), латинские ЧПУ статей раздела (записи других рубрик не
меняются), GraphQL-поля `unitrSeo`, `unitrOldSlugs`, `unitrArticlesSettings`, вебхук ревалидации (вариант А) или запуск
пересборки в GitHub Actions (вариант Б), страница «Инструменты → Проверка раздела «Статьи»» и `wp unitr-articles check`.
Zip — в [Releases](https://github.com/x3-team/unitr-articles/releases); установка через админку —
[WP-ADMIN-CHECKLIST.md](WP-ADMIN-CHECKLIST.md). Проверен в настоящем WordPress 6.5 (`tests/wp/run-wp-smoke.sh`, 30 проверок);
поля GraphQL — сквозным тестом фронтенда (WPGraphQL в среде проверки недоступен).
