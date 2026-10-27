#!/usr/bin/env bash
# Установка и проверка WP-плагина раздела на manage.unitr.ru (task=wp-plugin / wp-check в .github/workflows/ops.yml).
#   MODE=install|check|app-password   PLUGIN_ZIP=~/tmp/unitr-articles-wp-plugin.zip   FRONTEND_URL=https://test.unitr.ru
#   app-password: пользователь unitr-site (роль «Редактор», создаётся при отсутствии) + пароль приложения для сборки
#   раздела; пароль печатается один раз (вывод шифруется) и кладётся в секрет WP_GRAPHQL_TOKEN
# Перед install обязателен бэкап (task=backup). Плагин не меняет существующие записи, меню и адреса вне рубрики.
set -euo pipefail
H="${HOME:-/var/www/u3023644/data}"
WP_PATH="$H/www/manage.unitr.ru"
PHP="${PHP_BIN:-php}"
MODE="${MODE:-check}"

WPCLI="$H/bin/wp-cli.phar"
if command -v wp >/dev/null 2>&1; then
  wp() { command wp --path="$WP_PATH" "$@"; }
else
  if [ ! -f "$WPCLI" ]; then
    mkdir -p "$H/bin"
    curl -fsSL -o "$WPCLI" https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
  fi
  wp() { "$PHP" -d memory_limit=512M "$WPCLI" --path="$WP_PATH" "$@"; }
fi
echo "== WP-CLI: $(wp --version 2>&1 | head -1); PHP: $("$PHP" -v | head -1)"
echo "== WordPress $(wp core version 2>&1)"

if [ "$MODE" = install ]; then
  : "${PLUGIN_ZIP:?}" "${FRONTEND_URL:?}"
  ls "$H/backups" | tail -1 | grep -q . || { echo "Нет бэкапа в ~/backups — сначала task=backup"; exit 1; }
  echo "== Плагины до установки"; wp plugin list --fields=name,status,version 2>&1
  wp plugin install "$PLUGIN_ZIP" --force --activate 2>&1
  # тестовый этап: адрес сайта — стенд, вебхук на сайт не нужен (статический вариант), «Просмотреть» на прод — выключено
  wp option patch update unitr_articles_settings frontend_url "$FRONTEND_URL" 2>&1
  wp option patch update unitr_articles_settings secret "" 2>&1
  wp option patch update unitr_articles_settings rewrite_links 0 2>&1
fi

if [ "$MODE" = app-password ]; then
  if ! wp user get unitr-site --field=ID >/dev/null 2>&1; then
    wp user create unitr-site unitr-site@unitr.ru --role=editor --display_name="unitr.ru — раздел «Статьи»" --porcelain 2>&1
  fi
  echo "== Пароли приложений unitr-site (до)"; wp user application-password list unitr-site --fields=uuid,name,created 2>&1
  APP="$(wp user application-password create unitr-site "unitr.ru articles $(date +%F)" --porcelain 2>&1)"
  echo "WP_GRAPHQL_TOKEN=unitr-site:$APP"
fi

echo "== Плагины"; wp plugin list --fields=name,status,version 2>&1
echo "== Настройки раздела"; wp option get unitr_articles_settings --format=json 2>&1 | sed -E 's/("(secret|github_token)":")[^"]+/\1***/g'
echo "== Рубрика"; wp term list category --fields=term_id,name,slug,parent,count 2>&1 | grep -E "slug|poleznye|^.*\t[0-9]+$" | head -30
echo "== Проверка плагина (wp unitr-articles check)"; wp unitr-articles check 2>&1 || true
echo "== ACF-группа SEO"; wp eval 'echo function_exists("acf_get_local_field_group") && acf_get_local_field_group("group_unitr_article_seo") ? "зарегистрирована" : (function_exists("acf") ? "ACF есть, группа не найдена" : "ACF нет — поля в своём блоке"); echo "\n";' 2>&1
echo "== GraphQL (как запрашивает сайт)"
wp eval '
$q = "{ unitrArticlesSettings { perPage category frontendUrl } posts(first: 5, where: {categoryName: \"poleznye-stati\", status: PUBLISH}) { nodes { databaseId slug title date modified excerpt unitrSeo { title description } unitrOldSlugs featuredImage { node { sourceUrl } } categories { nodes { slug } } } } category(id: \"poleznye-stati\", idType: SLUG) { name children { nodes { slug name } } } }";
echo wp_json_encode( graphql( array( "query" => $q ) ), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT ), "\n";' 2>&1 | head -120
echo "== Статьи рубрики"; wp post list --post_type=post --category_name=poleznye-stati --post_status=any --fields=ID,post_status,post_name,post_title --format=table 2>&1 | head -40
