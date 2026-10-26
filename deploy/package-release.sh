#!/usr/bin/env bash
# Сборка релиза для боевого сервера: архив с автономным сервером Next.js (без node_modules проекта).
#   CONTENT_SOURCE=graphql SITE_URL=https://unitr.ru WP_GRAPHQL_TOKEN=... ./deploy/package-release.sh
# Сборке нужен доступ к manage.unitr.ru (страницы пререндерятся при сборке и затем обновляются ISR).
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SITE_URL:?SITE_URL не задан}"
export CONTENT_SOURCE="${CONTENT_SOURCE:-graphql}"
rm -rf .next
npx next build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
VERSION="$(date +%Y%m%d-%H%M%S)"
tar -C .next/standalone -czf "unitr-articles-${VERSION}.tar.gz" .
echo "Готово: unitr-articles-${VERSION}.tar.gz"
echo "На сервере: распаковать в /var/www/unitr-articles/releases/${VERSION}, ln -sfn … current, systemctl restart unitr-articles"
