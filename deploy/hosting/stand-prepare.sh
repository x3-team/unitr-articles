#!/usr/bin/env bash
# Тестовый стенд (task=stand-prepare в .github/workflows/ops.yml): копия текущего SPA из www/unitr.ru в каталог
# поддомена стенда + закрытие паролем (Basic Auth). Боевой www/unitr.ru только читается.
#   STAND_DIR=www/test.unitr.ru  AUTH_USER=…  AUTH_PASS=…
set -euo pipefail
H="${HOME:-/var/www/u3023644/data}"
SRC="$H/www/unitr.ru"
DST="$H/${STAND_DIR:?STAND_DIR не задан}"
PHP="${PHP_BIN:-php}"
: "${AUTH_USER:?}" "${AUTH_PASS:?}"
case "$DST" in "$SRC"|"$SRC/"*) echo "STAND_DIR не может быть боевым каталогом"; exit 1 ;; esac
[ -d "$DST" ] || { echo "Каталог $DST не существует — создайте поддомен в ISPmanager"; exit 1; }

echo "== Копия SPA: $SRC → $DST (раздел «Статьи» стенда сохраняется)"
if command -v rsync >/dev/null; then
  rsync -a --delete --exclude=/articles/ --exclude=/sitemaps/ --exclude=/sitemap.xml --exclude=/robots.txt \
    --exclude=/.htaccess --exclude='/*.before-unitr-articles' --exclude=/.well-known/ "$SRC/" "$DST/"
else
  (cd "$SRC" && tar -cf - --exclude=./articles --exclude=./sitemaps --exclude=./sitemap.xml --exclude=./robots.txt --exclude=./.htaccess .) | (cd "$DST" && tar -xf -)
fi
# .htaccess и robots.txt SPA — как исходные «до раздела» (деплой раздела вставит свой блок и заменит robots.txt)
cp -p "$SRC/.htaccess" "$DST/.htaccess.spa" 2>/dev/null || : > "$DST/.htaccess.spa"
[ -f "$DST/.htaccess" ] || cp -p "$DST/.htaccess.spa" "$DST/.htaccess"
[ -f "$SRC/robots.txt" ] && cp -p "$SRC/robots.txt" "$DST/robots.txt.spa"

echo "== Basic Auth"
PW="$H/.htpasswd-unitr-stand"
"$PHP" -r 'echo $argv[1].":".password_hash($argv[2], PASSWORD_BCRYPT)."\n";' "$AUTH_USER" "$AUTH_PASS" > "$PW"
chmod 644 "$PW"
BLOCK="# BEGIN unitr-stand-auth
# Тестовый стенд раздела «Статьи»: закрыт паролем, в поиск не попадает
AuthType Basic
AuthName \"unitr test stand\"
AuthUserFile $PW
Require valid-user
# END unitr-stand-auth"
TMP="$(mktemp)"
awk 'BEGIN{skip=0} /^# BEGIN unitr-stand-auth/{skip=1} !skip{print} /^# END unitr-stand-auth/{skip=0}' "$DST/.htaccess" > "$TMP"
{ printf '%s\n\n' "$BLOCK"; cat "$TMP"; } > "$DST/.htaccess"
rm -f "$TMP"
echo "== Готово"
ls -la "$DST" | head -30
echo "--- .htaccess стенда:"; cat "$DST/.htaccess"
