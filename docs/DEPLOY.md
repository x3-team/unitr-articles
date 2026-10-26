# Развёртывание на боевом сервере (unitr.ru, Reg.ru)

> Пошаговый план на день выкладки — [RUNBOOK.md](RUNBOOK.md): разведка сервера (`deploy/preflight.sh`) и выбор
> варианта. Здесь — справочные подробности по варианту А (Node.js). Вариант Б (хостинг без Node.js: статика +
> `.htaccess`, выкладка из GitHub Actions) описан в RUNBOOK, раздел 3Б.

Раздел — отдельное Node.js-приложение (Next.js standalone). Веб-сервер направляет в него только адреса раздела,
`sitemap.xml`, `robots.txt` и старые адреса `/blog`, `/poleznye-stati`; остальное по-прежнему отдаёт текущий сайт.

## 1. Требования к серверу

- Node.js ≥ 20.9 (рекомендуется 22 LTS), ~300 МБ RAM на процесс.
- nginx (или Apache с `mod_proxy`) перед приложением.
- Доступ с сервера к `https://manage.unitr.ru/graphql`.
- Тариф Reg.ru: VPS или хостинг с поддержкой Node.js и проксированием части адресов. На виртуальном хостинге без
  Node.js — вариант Б из RUNBOOK (все критерии ТЗ выполняются, обновление раздела за 2–10 минут).

## 2. WordPress (manage.unitr.ru) — можно сделать заранее

1. Установить и активировать плагины: **WPGraphQL** (обязательно), ACF (если используется на сайте; не обязателен).
2. «Плагины → Добавить новый → Загрузить плагин» → `unitr-articles-wp-plugin.zip` из
   [Releases](https://github.com/x3-team/unitr-articles/releases) → активировать «Юнит-Ресурс — раздел «Статьи»»
   (подробный чеклист без SSH — [WP-ADMIN-CHECKLIST.md](WP-ADMIN-CHECKLIST.md)).
   Рубрика «Полезные статьи» (`poleznye-stati`) создастся автоматически.
3. В `wp-config.php`:
   ```php
   define( 'UNITR_FRONTEND_URL', 'https://unitr.ru' );
   define( 'UNITR_REVALIDATE_SECRET', '<длинная случайная строка>' );
   ```
4. Создать пользователя с ролью «Редактор» для сайта и пароль приложения (Пользователи → Профиль → Пароли приложений).
5. Открыть «Инструменты → Проверка раздела «Статьи»» — все пункты должны быть ✅
   (или `wp unitr-articles check` по SSH).

## 3. Переменные окружения приложения

Файл `/etc/unitr-articles.env` (права `600`, владелец — пользователь сервиса):

```ini
SITE_URL=https://unitr.ru
CONTENT_SOURCE=graphql
WP_GRAPHQL_URL=https://manage.unitr.ru/graphql
WP_GRAPHQL_TOKEN=site-editor:xxxx xxxx xxxx xxxx xxxx xxxx
WP_GRAPHQL_AUTH=basic
ARTICLES_CATEGORY=poleznye-stati
REVALIDATE_SECONDS=300
REVALIDATE_SECRET=<то же, что UNITR_REVALIDATE_SECRET>
# страницы основного сайта, которых нет в WordPress, для sitemap.xml:
SITE_STATIC_PAGES=[{"path":"/","lastmod":"2026-10-01"},{"path":"/catalog/","lastmod":"2026-10-01"}]
# robots.txt раздела заменяет robots.txt сайта — перенести сюда его правила (кроме запретов /articles/):
ROBOTS_EXTRA=Disallow: /search\nDisallow: /cart
```

Токен WordPress существует только здесь: в клиентский JavaScript он не попадает (проверяется `scripts/check-acceptance.mjs`).

## 4. Сборка и запуск

```bash
# на машине сборки (или на сервере), с доступом к manage.unitr.ru:
set -a; . /etc/unitr-articles.env; set +a
./deploy/package-release.sh            # → unitr-articles-<версия>.tar.gz

# на сервере:
mkdir -p /var/www/unitr-articles/releases/<версия>
tar -xzf unitr-articles-<версия>.tar.gz -C /var/www/unitr-articles/releases/<версия>
ln -sfn /var/www/unitr-articles/releases/<версия> /var/www/unitr-articles/current
sudo cp deploy/unitr-articles.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now unitr-articles   # или PM2: deploy/ecosystem.config.cjs
```

Каталог `.next/cache` внутри релиза должен быть доступен на запись пользователю сервиса (там хранится ISR-кеш).

## 5. nginx (или Apache)

Подключить `deploy/nginx-unitr.conf` в `server { }` сайта unitr.ru перед общим `location /`, добавить upstream.
Если на сервере Apache — `deploy/apache-unitr.conf` в `<VirtualHost>` (нужны `mod_proxy`, `mod_proxy_http`).
Собственные файлы раздела (иконка, og-картинка, логотип для Schema.org) лежат в `/articles/_media/` и не
пересекаются с файлами основного сайта.
Обязательно проверить, что в текущей конфигурации:
- нет `try_files … /index.html`, перехватывающего `/articles/` (из-за этого сейчас несуществующие адреса отдают 200);
- нет `X-Robots-Tag: noindex` и `Disallow` для `/articles/` в существующем robots.txt — robots.txt теперь отдаёт приложение.

Если основной сайт тоже использует `/_next/`, задайте `ASSET_PREFIX=/articles-assets` при сборке и в nginx:
`location ^~ /articles-assets/ { rewrite ^/articles-assets/(.*)$ /$1 break; proxy_pass http://unitr_articles; }`.

## 6. Пункт меню на основном сайте

Если шапку основного сайта рендерит отдельное приложение (SPA), в его меню добавляется пункт
`<a href="/articles/">Статьи</a>` после «Каталог» и «Конфигураторы», в серверной HTML-оболочке
(чтобы ссылка была в исходном коде без JS). Разметка и стили — как в `src/components/Header.tsx`.

## 7. Проверка после выкладки

```bash
node scripts/check-acceptance.mjs https://unitr.ru --mode=server --report=acceptance-prod.md
```

Скрипт проверяет все пункты раздела 5.1 договора (кроме «в течение 15 минут»): опубликуйте тестовую статью в рубрике
«Полезные статьи» — она появится на `/articles/` и в `/sitemap.xml` сразу (вебхук) или не позже чем через 10 минут
(без вебхука); снимите её с публикации — исчезнет так же.

## 8. Откат

`ln -sfn /var/www/unitr-articles/releases/<предыдущая> /var/www/unitr-articles/current && systemctl restart unitr-articles`;
для отключения раздела — убрать `include` из nginx (сайт вернётся к прежнему поведению).
