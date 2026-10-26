#!/usr/bin/env bash
# Проверка WP-плагина в настоящем WordPress (WordPress Playground: PHP в WebAssembly + SQLite, без MySQL и Docker).
# Ставит плагин, активирует и выполняет tests/wp/plugin-smoke.php. WPGraphQL не ставится — поля GraphQL
# проверяются сквозным тестом фронтенда (tests/e2e/run-graphql-e2e.mjs).
#
#   tests/wp/run-wp-smoke.sh             (нужны Node.js 20+ и доступ к registry.npmjs.org)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${WP_SMOKE_DIR:-$(mktemp -d)}"
PG_CLI="@wp-playground/cli@3.1.61"
WP_BUILDS="@wp-playground/wordpress-builds@0.9.19"   # содержит сборки WordPress (wordpress.org может быть недоступен)
WP_VERSION="${WP_VERSION:-6.5}"

cd "$WORK"
if [ ! -d wordpress ]; then
  npm pack --silent "$WP_BUILDS" >/dev/null
  tar -xzf wp-playground-wordpress-builds-*.tgz "package/src/wordpress/wp-${WP_VERSION}.zip"
  mkdir wordpress && (cd wordpress && unzip -q "../package/src/wordpress/wp-${WP_VERSION}.zip")
fi
rm -rf site && cp -r wordpress site
mkdir -p smoke && cp "$ROOT/tests/wp/plugin-smoke.php" smoke/ && rm -f smoke/result.txt
cat > smoke/blueprint.json <<'EOF'
{
  "steps": [
    { "step": "activatePlugin", "pluginPath": "unitr-articles/unitr-articles.php" },
    { "step": "runPHP", "code": "<?php require '/wordpress/wp-load.php'; require_once ABSPATH . 'wp-admin/includes/admin.php'; require '/smoke/plugin-smoke.php';" }
  ]
}
EOF
npx -y "$PG_CLI" run-blueprint --php=8.2 --verbosity=quiet \
  --wordpress-install-mode=install-from-existing-files \
  --mount-before-install="$WORK/site:/wordpress" \
  --mount="$ROOT/wp/unitr-articles:/wordpress/wp-content/plugins/unitr-articles" \
  --mount="$WORK/smoke:/smoke" \
  --blueprint="$WORK/smoke/blueprint.json" >/dev/null 2>&1 || true

[ -f smoke/result.txt ] || { echo "❌ Проверка не выполнилась (WordPress Playground)"; exit 1; }
cat smoke/result.txt
if grep -q "❌" smoke/result.txt; then echo "❌ Есть ошибки"; exit 1; fi
echo "✅ Плагин проверен в WordPress ${WP_VERSION}"
