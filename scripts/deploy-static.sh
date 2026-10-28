#!/usr/bin/env bash
# Выкладка боевого статического варианта раздела (out-apache/) на хостинг с Apache по SFTP или FTP.
# Используется в .github/workflows/deploy-static.yml; можно запустить и вручную с машины, где есть lftp.
#
#   DEPLOY_PROTOCOL=sftp|ftp   (по умолчанию sftp)
#   DEPLOY_HOST, DEPLOY_USER, DEPLOY_PASSWORD (или DEPLOY_SSH_KEY — закрытый ключ для sftp)
#   DEPLOY_PATH                корень сайта unitr.ru на хостинге (где лежат index.html и .htaccess SPA), напр. www/unitr.ru
#   FTP_SSL_ALLOW=no          только для FTP без TLS (не рекомендуется)
#   DRY_RUN=1                  показать, что будет загружено, ничего не меняя
#
# Что меняется на хостинге: каталог /articles/ (целиком принадлежит разделу), sitemap.xml, sitemaps/, robots.txt,
# блок «# BEGIN unitr-articles … # END unitr-articles» в начале корневого .htaccess и (SPA_MENU=1, по умолчанию)
# блоки «unitr-articles» в index.html SPA — пункт «Статьи» в шапке (scripts/merge-spa-index.mjs). Остальные файлы
# сайта не трогаются. Перед первой выкладкой исходные .htaccess и robots.txt сохраняются как *.before-unitr-articles.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DEPLOY_HOST:?DEPLOY_HOST не задан}"
: "${DEPLOY_USER:?DEPLOY_USER не задан}"
: "${DEPLOY_PATH:?DEPLOY_PATH не задан}"
PROTO="${DEPLOY_PROTOCOL:-sftp}"
SRC="out-apache"
[ -f "$SRC/articles/index.html" ] || { echo "Нет $SRC/ — сначала сборка с EXPORT_TARGET=apache"; exit 1; }
command -v lftp >/dev/null || { echo "Нужен lftp (apt-get install lftp)"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SETUP="set net:max-retries 3; set net:timeout 30; set cmd:fail-exit yes; set ssl:verify-certificate yes; set ftp:ssl-allow ${FTP_SSL_ALLOW:-yes};"
if [ "$PROTO" = "sftp" ] && [ -n "${DEPLOY_SSH_KEY:-}" ]; then
  printf '%s\n' "$DEPLOY_SSH_KEY" > "$TMP/key"; chmod 600 "$TMP/key"
  SETUP="$SETUP set sftp:connect-program \"ssh -a -x -i $TMP/key -o StrictHostKeyChecking=accept-new\";"
  AUTH="$DEPLOY_USER,"
else
  : "${DEPLOY_PASSWORD:?нужен DEPLOY_PASSWORD или DEPLOY_SSH_KEY}"
  AUTH="$DEPLOY_USER,$DEPLOY_PASSWORD"
  [ "$PROTO" = "sftp" ] && SETUP="$SETUP set sftp:auto-confirm yes;"
fi
lf() { lftp -u "$AUTH" -e "$SETUP $1; bye" "$PROTO://$DEPLOY_HOST"; }

DRY=""; [ "${DRY_RUN:-}" = "1" ] && DRY="--dry-run"

echo "== Текущие корневые .htaccess и robots.txt"
lf "cd $DEPLOY_PATH; get -e -O $TMP .htaccess" 2>/dev/null || : > "$TMP/.htaccess"
lf "cd $DEPLOY_PATH; get -e -O $TMP robots.txt" 2>/dev/null || true
[ -s "$TMP/.htaccess" ] || echo "   корневого .htaccess нет — будет создан с блоком раздела"
if ! lf "cd $DEPLOY_PATH; cls .htaccess.before-unitr-articles" >/dev/null 2>&1; then
  if [ -z "$DRY" ]; then
    echo "== Первая выкладка: резервные копии *.before-unitr-articles"
    [ -s "$TMP/.htaccess" ] && lf "cd $DEPLOY_PATH; put $TMP/.htaccess -o .htaccess.before-unitr-articles"
    [ -f "$TMP/robots.txt" ] && lf "cd $DEPLOY_PATH; put $TMP/robots.txt -o robots.txt.before-unitr-articles"
    lf "cd $DEPLOY_PATH; get -e -O $TMP sitemap.xml" >/dev/null 2>&1 && lf "cd $DEPLOY_PATH; put $TMP/sitemap.xml -o sitemap.xml.before-unitr-articles"
  fi
fi

echo "== Статика раздела (новые файлы до HTML, старые не удаляются — на них могут ссылаться страницы в кешах)"
lf "mirror -R $DRY --no-perms --parallel=4 $SRC/articles/_media/_next $DEPLOY_PATH/articles/_media/_next"
echo "== Страницы раздела (/articles/), удалённые статьи удаляются"
lf "mirror -R $DRY --delete --no-perms --parallel=4 --exclude-glob _media/_next/ $SRC/articles $DEPLOY_PATH/articles"
echo "== Карта сайта и robots.txt"
lf "mirror -R $DRY --delete --no-perms $SRC/sitemaps $DEPLOY_PATH/sitemaps"
# robots.txt: правила сайта (site-original/robots.txt — исходный файл SPA) + раздел, scripts/merge-robots.mjs
node scripts/merge-robots.mjs "${ROBOTS_ORIGINAL:-site-original/robots.txt}" "$SRC/robots.txt" "$TMP/robots.final"
echo "   robots.txt: $(grep -ci '^user-agent' "$TMP/robots.final") групп User-agent, $(grep -ci '^allow: /articles/' "$TMP/robots.final") × Allow: /articles/"
[ -z "$DRY" ] && lf "cd $DEPLOY_PATH; put $SRC/sitemap.xml -o sitemap.xml; put $TMP/robots.final -o robots.txt"

echo "== Блок раздела в корневом .htaccess"
node scripts/merge-htaccess.mjs "$TMP/.htaccess" "$SRC/unitr-articles.htaccess" "$TMP/.htaccess.new"
if cmp -s "$TMP/.htaccess" "$TMP/.htaccess.new"; then
  echo "   без изменений"
elif [ -z "$DRY" ]; then
  lf "cd $DEPLOY_PATH; put $TMP/.htaccess.new -o .htaccess"
else
  # содержимое .htaccess сайта в лог не выводится (лог публичный) — только объём изменений
  echo "   будет изменено строк: $(diff "$TMP/.htaccess" "$TMP/.htaccess.new" | grep -c '^[<>]'); правила сайта вне блока сохраняются"
fi
if [ "${SPA_MENU:-1}" = "1" ]; then
  echo "== Пункт «Статьи» в шапке SPA (блоки unitr-articles в index.html)"
  if lf "cd $DEPLOY_PATH; get -e -O $TMP index.html" >/dev/null 2>&1; then
    node scripts/merge-spa-index.mjs "$TMP/index.html" "$TMP/index.html.new" "${BUILD_ID:-1}"
    if cmp -s "$TMP/index.html" "$TMP/index.html.new"; then
      echo "   без изменений"
    elif [ -z "$DRY" ]; then
      # копия index.html SPA без блоков раздела (после каждой новой сборки SPA — свежая)
      grep -q "BEGIN unitr-articles" "$TMP/index.html" || lf "cd $DEPLOY_PATH; put $TMP/index.html -o index.html.before-unitr-articles"
      lf "cd $DEPLOY_PATH; put $TMP/index.html.new -o index.html"
      echo "   index.html обновлён"
    else
      echo "   будет изменено строк: $(diff "$TMP/index.html" "$TMP/index.html.new" | grep -c '^[<>]')"
    fi
  else
    echo "   index.html сайта не найден — пропущено"
  fi
fi
echo "Готово."
