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
| ЧПУ | при сохранении записи с кириллическим адресом строит латинский (та же таблица транслитерации, что во фронтенде). Если стоит Cyr-To-Lat — работает он |
| GraphQL | `Post.unitrSeo { title description }`, `Post.unitrOldSlugs` (прежние адреса для 301), `RootQuery.unitrArticlesSettings { perPage category frontendUrl }` |
| Вебхук | при публикации, изменении, снятии с публикации, удалении статьи, изменении рубрик и настроек — `POST <сайт>/api/revalidate/` с секретом; сайт обновляется сразу |
| Настройки | «Настройки → Раздел «Статьи»»: количество анонсов на странице, адрес сайта, секрет; ссылки «Просмотреть» ведут на `unitr.ru/articles/<адрес>/` |
| Проверка | «Инструменты → Проверка раздела «Статьи»»: WPGraphQL, ACF, рубрика, выполнение запроса фронтенда, заполненность обложек/анонсов/SEO, тестовый вебхук. В списке записей — колонка «Раздел «Статьи»» с незаполненными полями |
| WP-CLI | `wp unitr-articles check` (код 1 при ошибках), `wp unitr-articles setup`, `wp unitr-articles webhook` |

## Установка

1. Плагины: **WPGraphQL** (обязательно), ACF и WPGraphQL for ACF — по желанию.
2. Скопировать `wp/unitr-articles` в `wp-content/plugins/unitr-articles` и активировать.
3. В `wp-config.php` (рекомендуется; иначе — в «Настройки → Раздел «Статьи»»):
   ```php
   define( 'UNITR_FRONTEND_URL', 'https://unitr.ru' );
   define( 'UNITR_REVALIDATE_SECRET', '<секрет, как REVALIDATE_SECRET у сайта>' );
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
