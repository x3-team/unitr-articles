#!/usr/bin/env bash
# Тестовые статьи в рубрике poleznye-stati на manage.unitr.ru (для приёмки на стенде; .github/workflows/wp-demo-content.yml).
#   DEMO_MODE=seed|status|remove   DEMO_DIR=~/tmp/unitr-demo (articles.json, covers/, wp-demo-content.php)
#   ALLOW_SPA=yes — загрузить, даже если боевой SPA (www/unitr.ru) упоминает рубрику poleznye-stati
# Статьи помечены мета-полем _unitr_demo и меткой test-unitr-demo; remove удаляет только их (вместе с обложками).
set -euo pipefail
H="${HOME:-/var/www/u3023644/data}"
WP_PATH="$H/www/manage.unitr.ru"
PHP="${PHP_BIN:-php}"
DEMO_DIR="${DEMO_DIR:-$H/tmp/unitr-demo}"
export DEMO_MODE="${DEMO_MODE:-status}" DEMO_DIR

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

if [ "$DEMO_MODE" = seed ]; then
  # тестовые статьи не должны появиться на боевом сайте: выводит ли текущий SPA рубрику из WordPress
  # (файл SPA упоминает рубрику и обращается к API WordPress)
  MENTIONS="$(grep -rlF poleznye "$H/www/unitr.ru" --include='*.js' --include='*.html' 2>/dev/null | grep -v '/articles/' || true)"
  WP_API="$(printf '%s\n' "$MENTIONS" | grep . | xargs -r grep -lE 'graphql|wp-json|manage\.unitr\.ru' 2>/dev/null | wc -l || true)"
  echo "== Боевой SPA: файлов с упоминанием poleznye: $(printf '%s\n' "$MENTIONS" | grep -c . || true), из них с запросами к WordPress: $WP_API"
  if [ "$WP_API" != 0 ] && [ "${ALLOW_SPA:-}" != yes ]; then
    echo "Боевой SPA может выводить рубрику из WordPress — тестовые статьи не загружены (allow_spa=true — после согласования)"
    exit 1
  fi
fi

echo "== WP-CLI: $(wp --version 2>&1 | head -1)"
wp eval-file "$DEMO_DIR/wp-demo-content.php" 2>&1
# ссылки и кеш объектов WordPress, если включён
wp cache flush >/dev/null 2>&1 || true
rm -rf "$DEMO_DIR"
