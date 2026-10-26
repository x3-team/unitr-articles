# Выкладка раздела «Статьи» на unitr.ru — пошаговый план

Документ для дня выкладки. Подробности по каждому файлу — в [DEPLOY.md](DEPLOY.md), соответствие ТЗ —
в [TZ-COMPLIANCE.md](TZ-COMPLIANCE.md), настройка WordPress без SSH — в [WP-ADMIN-CHECKLIST.md](WP-ADMIN-CHECKLIST.md).

Раздел выкладывается **рядом** с существующим сайтом: меняются только адреса `/articles/…`, `/blog…`,
`/poleznye-stati…`, `/sitemap.xml`, `/sitemaps/…`, `/robots.txt`. Главная, каталог, конфигураторы и остальное
продолжает отдавать текущий сайт. Откат — одной командой (раздел 6).

## 0. Что нужно на руках

| Что | Для чего | Статус |
|---|---|---|
| Администратор WordPress manage.unitr.ru (MainAdmin) | установка плагина, рубрика, пароль приложения | есть |
| SSH к серверу unitr.ru **или** панель хостинга Reg.ru + SFTP/FTP | выкладка фронта | ожидается |
| Тариф Reg.ru: VPS / виртуальный хостинг | выбор варианта А или Б | уточнить |
| Доступ к GitHub x3-team/unitr-articles (Settings → Secrets) | только для варианта Б | есть |

## 1. WordPress — можно сделать заранее, без SSH

Пройти [WP-ADMIN-CHECKLIST.md](WP-ADMIN-CHECKLIST.md): установить плагин из релиза
(https://github.com/x3-team/unitr-articles/releases — `unitr-articles-wp-plugin.zip`), проверить WPGraphQL и рубрику,
создать пароль приложения. Итог шага — зелёная страница «Инструменты → Проверка раздела «Статьи»».

## 2. Разведка сервера (5 минут, ничего не меняет)

```bash
scp deploy/preflight.sh <сервер>:~ && ssh <сервер> 'bash ~/preflight.sh'      # или путь к корню сайта аргументом
```

Скрипт покажет: есть ли root/sudo и Node.js ≥ 20, какой веб-сервер (nginx/Apache), где корень сайта и что в его
`.htaccess`, что сейчас отвечают `/articles/`, `/blog/`, `/sitemap.xml`, `/robots.txt`, достаёт ли сервер до
`manage.unitr.ru/graphql`, и порекомендует вариант:

- **А — Node.js-приложение** (VPS / root, или Node.js ≥ 20 доступен): SSR + ISR + мгновенный вебхук. Основной вариант.
- **Б — статическая выкладка** (виртуальный хостинг без Node.js): GitHub Actions собирает HTML из WordPress каждые
  10 минут (и сразу по сигналу из WordPress) и выкладывает по SFTP/FTP; 301 и 404 — правилами `.htaccess`.
  Все критерии ТЗ выполняются (проверено на настоящем Apache: `tests/e2e/run-apache-e2e.mjs`), отличие от А —
  обновление за 2–10 минут вместо мгновенного.

Сохраните вывод — по нему видно, на чём сейчас работает SPA (это понадобится в шаге 5).

## 3А. Вариант А — Node.js

**А1. Код и окружение** (на сервере, под пользователем сервиса):

```bash
sudo mkdir -p /var/www/unitr-articles && sudo chown $USER /var/www/unitr-articles
git clone https://github.com/x3-team/unitr-articles.git /var/www/unitr-articles/src
sudo install -m 600 -o www-data /dev/null /etc/unitr-articles.env && sudoedit /etc/unitr-articles.env
```

Содержимое `/etc/unitr-articles.env` — как в DEPLOY.md, раздел 3. Значения:
`WP_GRAPHQL_TOKEN=<логин>:<пароль приложения из шага 1>`, `REVALIDATE_SECRET=<секрет из «Настройки → Раздел «Статьи»»>`,
`ROBOTS_EXTRA` — правила текущего robots.txt (из вывода preflight), кроме запретов `/articles`.

**А2. Сборка релиза** (нужен доступ к manage.unitr.ru — страницы пререндерятся при сборке):

```bash
cd /var/www/unitr-articles/src && npm ci
set -a; . /etc/unitr-articles.env; set +a
./deploy/package-release.sh                      # → unitr-articles-<версия>.tar.gz
V=$(ls -t unitr-articles-*.tar.gz | head -1 | sed 's/unitr-articles-\(.*\)\.tar\.gz/\1/')
mkdir -p ../releases/$V && tar -xzf unitr-articles-$V.tar.gz -C ../releases/$V
ln -sfn /var/www/unitr-articles/releases/$V /var/www/unitr-articles/current
sudo chown -R www-data /var/www/unitr-articles/releases/$V/.next/cache 2>/dev/null || true
```

**А3. Сервис:** `sudo cp deploy/unitr-articles.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now unitr-articles`
(без systemd — PM2: `pm2 start deploy/ecosystem.config.cjs && pm2 save`). Проверка до переключения трафика:

```bash
node scripts/check-acceptance.mjs http://127.0.0.1:3000 --mode=server   # все ✅, кроме сравнения с главной
```

**А4. Веб-сервер:** nginx — `deploy/nginx-unitr.conf` в `server {}` сайта перед `location /`, upstream в `http {}`;
Apache — `deploy/apache-unitr.conf` в `<VirtualHost>`. `nginx -t && systemctl reload nginx` (или `apachectl configtest && systemctl reload apache2`).

**А5. Вебхук:** в WordPress «Инструменты → Проверка раздела «Статьи»» → «Отправить тестовый вебхук» → ✅ HTTP 200.

## 3Б. Вариант Б — статическая выкладка

**Б1.** GitHub → Settings → Secrets and variables → Actions:

| Тип | Имя | Значение |
|---|---|---|
| secret | `WP_GRAPHQL_URL` | `https://manage.unitr.ru/graphql` |
| secret | `WP_GRAPHQL_TOKEN` | `<логин>:<пароль приложения>` |
| secret | `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_PASSWORD` (или `DEPLOY_SSH_KEY`) | доступ SFTP/FTP Reg.ru |
| secret | `DEPLOY_PATH` | корень сайта (из preflight, напр. `www/unitr.ru`) |
| variable | `DEPLOY_PROTOCOL` | `sftp` (или `ftp`) |
| variable | `ROBOTS_EXTRA` | правила текущего robots.txt, через `\n` |
| variable | `SITE_STATIC_PAGES` | страницы SPA для sitemap: `[{"path":"/","lastmod":"2026-10-27"},…]` |
| variable | `DEPLOY_MODE` | `static` — **последним**, включает расписание |

**Б2.** Actions → «Deploy unitr.ru (static)» → Run workflow с галкой «Только показать» — в логе список файлов
и разница корневого `.htaccess`. Убедиться, что меняется только перечисленное выше.

**Б3.** Run workflow без галки. Скрипт сам сохранит `.htaccess.before-unitr-articles` и `robots.txt.before-unitr-articles`,
выложит `/articles/`, карту сайта и robots.txt, вставит блок `# BEGIN unitr-articles … # END` в начало `.htaccess`,
затем прогонит проверку критериев по https://unitr.ru (отчёт — в сводке запуска).

**Б4.** Мгновенное обновление: в WordPress «Настройки → Раздел «Статьи»» указать репозиторий `x3-team/unitr-articles`
и fine-grained токен GitHub (только этот репозиторий, Contents: Read and write; лучше константой
`UNITR_GITHUB_TOKEN` в wp-config.php). Без этого раздел обновляется по расписанию каждые 10 минут.
Поле «Секрет вебхука» в варианте Б оставить пустым.

## 4. Проверка после выкладки (оба варианта)

```bash
node scripts/check-acceptance.mjs https://unitr.ru --mode=server --report=acceptance-prod.md   # вариант Б: --mode=static
```

Затем вручную, как при приёмке: опубликовать в WordPress тестовую статью в рубрике «Полезные статьи» — она должна
появиться на https://unitr.ru/articles/ и в https://unitr.ru/sitemap.xml (А — сразу, Б — за 2–10 минут);
снять с публикации — исчезнуть так же; старый адрес `/blog/` → 301. Отправить sitemap в Яндекс.Вебмастер и Search Console.

## 5. Пункт «Статьи» в меню основного сайта (ТЗ, задача 2)

В разделе пункт уже есть (шапка раздела отрисована на сервере). Для страниц основного сайта — по выводу preflight:

- если меню основного сайта берётся из WordPress («Внешний вид → Меню») — добавить пункт «Статьи» → `/articles/`
  после «Конфигураторы» (WP-ADMIN-CHECKLIST, п. 7);
- если меню зашито в сборку SPA — добавить ссылку в исходники SPA; если исходников нет — в `index.html` SPA внутрь
  корневого контейнера вставляется серверная шапка со ссылкой `<a href="/articles/">Статьи</a>` (React заменит её
  при загрузке, а в исходном HTML ссылка есть, как требует ТЗ).

## 6. Откат

- А: `ln -sfn …/releases/<предыдущая> …/current && systemctl restart unitr-articles`; отключить раздел целиком —
  убрать include из nginx/Apache и перезагрузить.
- Б: `DEPLOY_MODE` → пусто (останавливает расписание); вернуть `.htaccess.before-unitr-articles` → `.htaccess`
  и `robots.txt.before-unitr-articles` → `robots.txt`, удалить каталог `articles/`, `sitemap.xml`, `sitemaps/`.
- WordPress: плагин можно деактивировать в любой момент — статьи, рубрика и поля остаются.
