#!/usr/bin/env bash
# Разведка shared-хостинга Reg.ru (только чтение). Запускается по SSH из .github/workflows/ops.yml (task=recon),
# вывод шифруется и в лог GitHub не попадает.
set -u
H="${HOME:-/var/www/u3023644/data}"
SITE="$H/www/unitr.ru"
WP="$H/www/manage.unitr.ru"
h() { printf '\n===== %s\n' "$*"; }

h "Система"
uname -a; id; echo "HOME=$H"; cat /etc/os-release 2>/dev/null | head -3
quota -s 2>/dev/null || true
df -h "$H" 2>/dev/null | tail -1
du -sh "$SITE" "$WP" "$WP/wp-content/uploads" 2>/dev/null
ulimit -a 2>/dev/null | grep -i "proc\|mem\|time"

h "Интерпретаторы"
for b in node npm php php8.2 php82 /opt/php82/bin/php /opt/php/8.2/bin/php /usr/local/bin/php wp mysql mysqldump rsync zip unzip tar gzip curl wget git htpasswd crontab; do
  p="$(command -v "$b" 2>/dev/null)"; [ -n "$p" ] && printf '%-22s %s\n' "$b" "$p"
done
ls -d /opt/php* /opt/alt/php* 2>/dev/null | head -20
php -v 2>/dev/null | head -1; node -v 2>/dev/null
for p in /opt/php82/bin/php /opt/php/8.2/bin/php /opt/alt/php82/usr/bin/php; do [ -x "$p" ] && echo "$p: $($p -v | head -1)"; done

h "Сайт unitr.ru: файлы"
ls -la "$SITE" | head -50
h "Сайт unitr.ru: .htaccess"
cat "$SITE/.htaccess" 2>/dev/null
h "Сайт unitr.ru: robots.txt / sitemap.xml"
cat "$SITE/robots.txt" 2>/dev/null | head -30
ls -la "$SITE"/sitemap* 2>/dev/null; head -c 600 "$SITE/sitemap.xml" 2>/dev/null; echo
h "Сайт unitr.ru: index.html (head)"
head -c 3000 "$SITE/index.html" 2>/dev/null; echo
h "SPA: упоминания рубрики/GraphQL/меню в бандле"
for f in "$SITE"/assets/*.js; do
  [ -f "$f" ] || continue
  for k in poleznye-stati poleznye categoryName manage.unitr.ru/graphql graphql Authorization Bearer 'Конфигураторы' '/articles' '/blog' menuItems 'menu('; do
    c=$(grep -o -- "$k" "$f" 2>/dev/null | wc -l); [ "$c" -gt 0 ] && echo "$(basename "$f"): '$k' ×$c"
  done
done
grep -o '.\{120\}poleznye.\{120\}' "$SITE"/assets/*.js 2>/dev/null | head -5
grep -o '.\{160\}Конфигураторы.\{200\}' "$SITE"/assets/*.js 2>/dev/null | head -3

h "Другие сайты в www"
ls -la "$H/www"

h "Apache"
ls -la "$H"/logs 2>/dev/null | head; ls "$H/etc" 2>/dev/null | head
for f in /etc/apache2/mods-enabled /etc/httpd/conf.modules.d; do ls "$f" 2>/dev/null | tr '\n' ' '; done; echo

h "WordPress manage.unitr.ru"
ls -la "$WP" | head -40
grep -E "define\(\s*'(DB_NAME|DB_HOST|DB_CHARSET|WP_DEBUG|DISALLOW_FILE_MODS|DISALLOW_FILE_EDIT|WP_HOME|WP_SITEURL|UNITR_[A-Z_]+)'" "$WP/wp-config.php" 2>/dev/null | sed -E "s/(DB_NAME'\s*,\s*')[^']*/\1***/"
grep -n "table_prefix" "$WP/wp-config.php" 2>/dev/null
grep "wp_version =" "$WP/wp-includes/version.php" 2>/dev/null
ls -la "$WP/wp-content/plugins" 2>/dev/null
ls "$WP/wp-content/mu-plugins" 2>/dev/null
ls "$WP/wp-content/themes" 2>/dev/null
cat "$WP/.htaccess" 2>/dev/null | head -40

h "WP-CLI"
command -v wp && wp --info 2>&1 | head -5
ls -la "$H/bin" 2>/dev/null

h "Cron"
crontab -l 2>&1 | sed -E 's/(pass(word)?=)[^ ]+/\1***/Ig' | head -20

h "Бэкапы"
ls -la "$H/backups" 2>/dev/null | head
echo "recon: done"
