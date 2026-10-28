# WP-плагин «Юнит-Ресурс — раздел «Статьи»» (manage.unitr.ru)

Готовит WordPress к работе раздела `/articles/` сайта unitr.ru. Устанавливается до выкладки фронтенда —
редакторы могут сразу наполнять рубрику.

## Что делает

| | |
|---|---|
| Рубрика | создаёт «Полезные статьи» (`poleznye-stati`) при активации; подрубрики попадают в раздел автоматически |
| Обложка | включает «Изображение записи» для записей; размер `unitr-og` 1200×630 для соцсетей |
| Анонс | включает «Отрывок» (excerpt) |
| SEO | поля «SEO title» и «Meta description»: при активном ACF — группа ACF (в GraphQL: `Post.unitrSeoFields`), без ACF — блок в редакторе. Если поля пусты — берутся значения Yoast SEO / Rank Math |
| ЧПУ | при сохранении статьи раздела с кириллическим адресом строит латинский по схеме транслитерации Яндекса (ё → e, й → y, х → h, ц → c, щ → sch; та же таблица и то же правило для обрезанных WordPress адресов, что во фронтенде). Ярлык, введённый вручную латиницей, не меняется; при смене ярлыка старый адрес отдаёт 301. Записи других рубрик не трогает. Если стоит Cyr-To-Lat, адрес статьи, построенный им из заголовка, заменяется адресом по схеме Яндекса (прежний отдаёт 301); записи вне раздела остаются как у Cyr-To-Lat |
| GraphQL | `Post.unitrSeo { title description }`, `Post.unitrOldSlugs` (прежние адреса для 301), `RootQuery.unitrArticlesSettings { perPage category frontendUrl }` |
| Вебхук | при публикации, изменении, снятии с публикации, удалении статьи, изменении рубрик и настроек — `POST <сайт>/api/revalidate/` с секретом (вариант А, сайт обновляется сразу) и/или `repository_dispatch` в GitHub (вариант Б, пересборка за 2–3 минуты) |
| Настройки | «Настройки → Раздел «Статьи»»: количество анонсов на странице, адрес сайта, секрет, репозиторий и токен GitHub (вариант Б); ссылки «Просмотреть» на `unitr.ru/articles/<адрес>/` (включаются после запуска раздела) |
| Проверка | «Инструменты → Проверка раздела «Статьи»»: WPGraphQL, ACF, рубрика, выполнение запроса фронтенда, заполненность обложек/анонсов/SEO, тестовый вебхук. В списке записей — колонка «Раздел «Статьи»» с незаполненными полями |
| WP-CLI | `wp unitr-articles check` (код 1 при ошибках), `wp unitr-articles setup`, `wp unitr-articles webhook` |

## Установка

Подробный чеклист через админку, без SSH — [docs/WP-ADMIN-CHECKLIST.md](../docs/WP-ADMIN-CHECKLIST.md).

1. Плагины: **WPGraphQL** (обязательно), ACF и WPGraphQL for ACF — по желанию.
2. «Плагины → Добавить новый → Загрузить плагин» → `unitr-articles-wp-plugin.zip` из
   [Releases](https://github.com/x3-team/unitr-articles/releases) → активировать
   (или скопировать `wp/unitr-articles` в `wp-content/plugins/unitr-articles`).
3. В `wp-config.php` (рекомендуется; иначе — в «Настройки → Раздел «Статьи»»):
   ```php
   define( 'UNITR_FRONTEND_URL', 'https://unitr.ru' );
   define( 'UNITR_REVALIDATE_SECRET', '<секрет, как REVALIDATE_SECRET у сайта>' );   // вариант А
   // вариант Б (статическая выкладка): пересборка раздела в GitHub Actions сразу после изменений
   define( 'UNITR_GITHUB_REPO', 'x3-team/unitr-articles' );
   define( 'UNITR_GITHUB_TOKEN', '<fine-grained token: только этот репозиторий, Contents: Read and write>' );
   ```
4. Пароль приложения для сайта: «Пользователи → (редактор) → Пароли приложений». Значение `логин:пароль`
   — в `WP_GRAPHQL_TOKEN` на сервере сайта (только там).
5. «Инструменты → Проверка раздела «Статьи»» — всё ✅.

## Проверка GraphQL вручную

```bash
curl -s -u 'логин:пароль приложения' https://manage.unitr.ru/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ unitrArticlesSettings { perPage category } posts(first: 3, where: {categoryName: \"poleznye-stati\"}) { nodes { slug title unitrSeo { title description } unitrOldSlugs featuredImage { node { sourceUrl } } } } }"}'
```

Требования: WordPress ≥ 6.0, PHP ≥ 7.4, WPGraphQL ≥ 1.14.

## Релиз

Версия — в заголовке `unitr-articles.php` (`Version` и `UNITR_ARTICLES_VERSION`). Тег `wp-v<версия>` запускает
`.github/workflows/release-wp.yml`: проверка PHP, zip и публикация в Releases. Проверка в настоящем WordPress —
`tests/wp/run-wp-smoke.sh`.
