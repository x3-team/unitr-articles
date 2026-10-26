# Раздел «Статьи» для unitr.ru

Реализация Приложения № 4 к договору № 18-03-2026: автономный индексируемый раздел «Статьи»
(рубрика WordPress `poleznye-stati`) с серверным рендерингом.

- **Демо:** https://x3-team.github.io/unitr-articles/articles/ — статический пререндер с демо-статьями
- **Боевой режим:** Next.js 15 (SSR + ISR) на Node.js, данные — WPGraphQL `manage.unitr.ru`
- **WordPress:** плагин [`wp/unitr-articles`](wp/README.md) — рубрика, поля SEO, латинские ЧПУ, GraphQL-поля, вебхук, проверка
- **Соответствие ТЗ:** [docs/TZ-COMPLIANCE.md](docs/TZ-COMPLIANCE.md) — каждый пункт → реализация → как проверено
- **Выкладка на unitr.ru — пошагово:** [docs/RUNBOOK.md](docs/RUNBOOK.md) (разведка сервера `deploy/preflight.sh`,
  вариант А — Node.js, вариант Б — статика + `.htaccess` для хостинга без Node.js), подробности — [docs/DEPLOY.md](docs/DEPLOY.md)
- **WordPress без SSH:** [docs/WP-ADMIN-CHECKLIST.md](docs/WP-ADMIN-CHECKLIST.md); zip плагина — в
  [Releases](https://github.com/x3-team/unitr-articles/releases) (тег `wp-v<версия>` собирает его автоматически)

## Как устроено

Один код собирается в трёх режимах (третий — статический вариант для хостинга без Node.js, `EXPORT_TARGET=apache`,
см. [RUNBOOK](docs/RUNBOOK.md), вариант Б):

| | Боевой сервер (`npm run build`) | Демо на GitHub Pages (`npm run build:pages`) |
|---|---|---|
| HTML | SSR + ISR: страницы пререндерятся и перегенерируются каждые 5 минут и сразу по вебхуку | Пререндер всех страниц при сборке |
| Данные | GraphQL WordPress на сервере (BFF), токен только в окружении сервера | Демо-статьи из `src/content/mock` (или GraphQL при сборке в CI) |
| Обновление ≤ 15 мин | Кеш данных 300 с + ISR 300 с + вебхук из WordPress | Пересборка GitHub Actions каждые 15 минут |
| 404 | HTTP 404 из шаблонов (`notFound()`) | `404.html`, Pages отдаёт его с кодом 404 |
| 301 со `/blog`, `/poleznye-stati` | HTTP 301 из `src/middleware.server.ts` | Pages: 301 на адрес со слешем + мгновенная переадресация (`meta refresh` + `canonical`) |
| sitemap.xml / robots.txt | Динамические, `application/xml`, секционирование > 50 000 URL / 50 МБ | Генерируются при сборке |

Файлы `*.server.ts` (middleware, API-маршруты) собираются только в боевом режиме — GitHub Pages не исполняет серверный код.

```
src/
  app/
    articles/page.tsx                    /articles/ — архив, 10 анонсов, пагинация
    articles/page/[page]/page.tsx        /articles/page/N/
    articles/[slug]/page.tsx             /articles/<slug>/ — статья
    articles/category/[rubric]/…         подрубрики poleznye-stati (появляются автоматически)
    sitemap.xml/route.ts, sitemaps/[file]/route.ts, robots.txt/route.ts
    api/revalidate/route.server.ts       вебхук из WordPress
    api/articles/route.server.ts         BFF для клиентского кода основного сайта
    api/redirects/route.server.ts        карта прежних адресов для middleware
    not-found.tsx                        страница 404
  middleware.server.ts                   301: /blog, /poleznye-stati, прежние адреса, слеш, /page/1/
  components/                            шапка с пунктом «Статьи», карточка, пагинация, крошки, подвал
  lib/content/                           источники данных: graphql.ts (WordPress), mock.ts (демо)
  lib/sitemap.ts, lib/seo.ts, lib/meta.ts
wp/unitr-articles/                       плагин WordPress
scripts/check-acceptance.mjs             автопроверка критериев приёмки (раздел 6 ТЗ): --mode=server|static|pages
scripts/export-apache.mjs, deploy-static.sh, merge-htaccess.mjs   статический вариант (Apache + .htaccess, SFTP/FTP)
deploy/                                  preflight.sh, nginx/Apache, systemd/PM2, сборка релиза
tests/                                   юнит-тесты, сквозные тесты (GraphQL, Apache), проверка WP-плагина
```

## Команды

```bash
npm ci
npm run dev                                   # разработка (демо-данные)
npm test                                      # юнит-тесты
node tests/e2e/run-graphql-e2e.mjs            # сквозной тест: публикация/снятие/смена адреса через GraphQL
node tests/e2e/run-apache-e2e.mjs             # статический вариант на настоящем Apache поверх SPA (нужен apache2)
tests/wp/run-wp-smoke.sh                      # WP-плагин в настоящем WordPress (Playground + SQLite)

# боевая сборка и запуск
CONTENT_SOURCE=graphql SITE_URL=https://unitr.ru WP_GRAPHQL_TOKEN=... REVALIDATE_SECRET=... npm run build
node .next/standalone/server.js               # см. docs/DEPLOY.md

# проверка критериев приёмки (как у Заказчика: исходный HTML без JS + ответы сервера)
node scripts/check-acceptance.mjs https://unitr.ru --mode=server
node scripts/check-acceptance.mjs https://x3-team.github.io/unitr-articles --mode=pages
```

Переменные окружения — в [`.env.example`](.env.example).

## Дизайн

По макету Figma «RATEP → CMS Pages»: шапка и подвал «Юнит-Ресурс / ТЗ к CMS секциям» (меню «Каталог»,
«Конфигураторы» + новый пункт «Статьи»), сетка анонсов и пагинация — «Новости предприятия — 1440»,
страница статьи — «Страница новости — 1440». Фирменный цвет Юнит-Ресурс (#68BC25) вместо красного РАТЕП.
В карточку добавлена обложка (требование ТЗ). Шрифт макета Suisse Intl коммерческий: если он подключён на
сайте — используется он, иначе Inter. Обложки демо-статей сгенерированы (`scripts/make-covers.py`).
