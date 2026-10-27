#!/usr/bin/env bash
# Резервная копия перед любыми изменениями (task=backup в .github/workflows/ops.yml):
#   ~/backups/<метка>/unitr.ru-www.tar.gz        — весь каталог www/unitr.ru (SPA, .htaccess, robots.txt)
#   ~/backups/<метка>/manage-db.sql.gz           — дамп БД WordPress manage.unitr.ru
#   ~/backups/<метка>/manage-files.tar.gz        — файлы WordPress без wp-content/uploads
#   ~/backups/<метка>/manage-uploads.tar.gz      — wp-content/uploads (если хватает места)
#   ~/backups/<метка>/SHA256SUMS
# Каталог вне www — из интернета недоступен. Ничего на сайтах не меняет.
set -euo pipefail
H="${HOME:-/var/www/u3023644/data}"
STAMP="${BACKUP_STAMP:-$(date +%Y%m%d-%H%M%S)}"
DIR="$H/backups/$STAMP"
SITE="$H/www/unitr.ru"
WP="$H/www/manage.unitr.ru"
PHP="${PHP_BIN:-php}"
mkdir -p "$DIR" && chmod 700 "$H/backups" "$DIR"
cd "$H/www"

echo "== www/unitr.ru"
tar -czf "$DIR/unitr.ru-www.tar.gz" unitr.ru

echo "== БД manage.unitr.ru"
cfg() { "$PHP" -r 'define("ABSPATH","/tmp/"); define("WPINC","wp-includes"); $c=file_get_contents($argv[1]); preg_match("/define\\(\\s*[\x27\"]".$argv[2]."[\x27\"]\\s*,\\s*[\x27\"](.*?)[\x27\"]\\s*\\)/", $c, $m); echo $m[1] ?? "";' "$WP/wp-config.php" "$1"; }
DB_NAME="$(cfg DB_NAME)"; DB_USER="$(cfg DB_USER)"; DB_PASSWORD="$(cfg DB_PASSWORD)"; DB_HOST="$(cfg DB_HOST)"
[ -n "$DB_NAME" ] || { echo "не удалось прочитать DB_NAME из wp-config.php"; exit 1; }
HOSTPART="${DB_HOST%%:*}"; PORTPART="${DB_HOST#*:}"; [ "$PORTPART" = "$DB_HOST" ] && PORTPART=3306
MYCNF="$(mktemp)"; chmod 600 "$MYCNF"; trap 'rm -f "$MYCNF"' EXIT
printf '[client]\nuser=%s\npassword=%s\nhost=%s\nport=%s\n' "$DB_USER" "$DB_PASSWORD" "${HOSTPART:-localhost}" "$PORTPART" > "$MYCNF"
mysqldump --defaults-extra-file="$MYCNF" --single-transaction --quick --routines --no-tablespaces --default-character-set=utf8mb4 "$DB_NAME" | gzip > "$DIR/manage-db.sql.gz"

echo "== файлы WordPress (без uploads)"
tar -czf "$DIR/manage-files.tar.gz" --exclude="manage.unitr.ru/wp-content/uploads" --exclude="manage.unitr.ru/wp-content/cache" manage.unitr.ru

echo "== uploads"
NEED_KB=$(du -sk "$WP/wp-content/uploads" 2>/dev/null | cut -f1 || echo 0)
FREE_KB=$(df -Pk "$H" | awk 'NR==2 {print $4}')
if [ "${NEED_KB:-0}" -lt "$(( ${FREE_KB:-0} / 2 ))" ]; then
  tar -czf "$DIR/manage-uploads.tar.gz" manage.unitr.ru/wp-content/uploads
else
  echo "   пропущено: uploads ${NEED_KB} КБ, свободно ${FREE_KB} КБ (плагин раздела uploads не меняет)"
fi

cd "$DIR" && sha256sum ./* > SHA256SUMS
echo "== Готово: $DIR"
ls -la "$DIR"
gzip -t manage-db.sql.gz && echo "дамп БД цел: $(zcat manage-db.sql.gz | grep -c '^CREATE TABLE') таблиц"
