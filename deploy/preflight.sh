#!/usr/bin/env bash
# Разведка сервера unitr.ru перед выкладкой раздела «Статьи». Ничего не меняет — только читает и печатает отчёт.
# Запуск на сервере по SSH:   bash preflight.sh [корень сайта]      (или: curl … | bash)
# По итогам выбирается вариант выкладки из docs/RUNBOOK.md: А — Node.js + nginx/Apache-прокси, Б — статика + .htaccess.
set -u
DOCROOT="${1:-}"
SITE="${SITE_URL:-https://unitr.ru}"
WP="${WP_GRAPHQL_URL:-https://manage.unitr.ru/graphql}"
ok()   { printf '  ✅ %s\n' "$*"; }
warn() { printf '  ⚠️  %s\n' "$*"; }
bad()  { printf '  ❌ %s\n' "$*"; }
h()    { printf '\n== %s\n' "$*"; }

h "Система"
echo "  $(uname -srm); пользователь: $(id -un) (uid $(id -u))"
[ -r /etc/os-release ] && . /etc/os-release && echo "  ОС: ${PRETTY_NAME:-?}"
SUDO=no; if [ "$(id -u)" = 0 ] || sudo -n true 2>/dev/null; then SUDO=yes; ok "есть root/sudo — подходит вариант А (свой Node.js-сервис)"; else warn "нет root/sudo — похоже на виртуальный хостинг"; fi
df -h "${DOCROOT:-$HOME}" 2>/dev/null | tail -1 | awk '{print "  диск: свободно " $4 " из " $2}'
free -m 2>/dev/null | awk '/Mem:/ {print "  память: свободно " $7 " МБ из " $2 " МБ (Node.js-процессу нужно ~300 МБ)"}'

h "Node.js"
NODE=""
for n in node /usr/bin/node /usr/local/bin/node /opt/alt/alt-nodejs*/root/usr/bin/node "$HOME"/.nvm/versions/node/*/bin/node; do
  if command -v "$n" >/dev/null 2>&1 || [ -x "$n" ]; then NODE="$(command -v "$n" 2>/dev/null || echo "$n")"; break; fi
done
if [ -n "$NODE" ]; then
  V="$("$NODE" -v 2>/dev/null)"; MAJOR="${V#v}"; MAJOR="${MAJOR%%.*}"
  if [ "${MAJOR:-0}" -ge 20 ]; then ok "Node.js $V ($NODE)"; else warn "Node.js $V ($NODE) — нужен ≥ 20.9 (можно поставить через nvm без root)"; fi
else
  warn "Node.js не найден (на VPS ставится пакетом/nvm; на виртуальном хостинге — раздел «Node.js» в панели, если есть)"
fi
ls -d /opt/alt/alt-nodejs* 2>/dev/null | sed 's/^/  CloudLinux Node.js Selector: /'
command -v pm2 >/dev/null 2>&1 && ok "pm2: $(pm2 -v 2>/dev/null)"
command -v systemctl >/dev/null 2>&1 && [ "$SUDO" = yes ] && ok "systemd доступен"

h "Веб-сервер"
for b in nginx apache2 httpd litespeed lshttpd; do
  pgrep -x "$b" >/dev/null 2>&1 && echo "  запущен: $b"
done
command -v nginx >/dev/null 2>&1 && echo "  $(nginx -v 2>&1)"
(command -v apache2 || command -v httpd) >/dev/null 2>&1 && echo "  $( (apache2 -v 2>/dev/null || httpd -v 2>/dev/null) | head -1)"
if [ "$SUDO" = yes ] && command -v nginx >/dev/null 2>&1; then
  echo "  конфигурация nginx для unitr.ru:"
  sudo -n nginx -T 2>/dev/null | grep -n "server_name.*unitr\|root \|try_files\|X-Robots-Tag\|location /api\|location /_next\|proxy_pass" | grep -v "^\s*#" | head -30 | sed 's/^/    /'
fi
for m in rewrite headers proxy proxy_http; do
  (apache2ctl -M 2>/dev/null || httpd -M 2>/dev/null) | grep -q "${m}_module" && echo "  Apache: mod_$m есть"
done

h "Корень сайта"
if [ -z "$DOCROOT" ]; then
  for d in "$HOME"/www/unitr.ru "$HOME"/unitr.ru/public_html "$HOME"/public_html /var/www/unitr.ru /var/www/unitr /var/www/html /var/www/unitr.ru/public; do
    [ -f "$d/index.html" ] || [ -f "$d/index.php" ] && { DOCROOT="$d"; break; }
  done
fi
if [ -n "$DOCROOT" ] && [ -d "$DOCROOT" ]; then
  ok "корень сайта: $DOCROOT"
  ls -la "$DOCROOT" | head -30 | sed 's/^/    /'
  [ -f "$DOCROOT/.htaccess" ] && { echo "  .htaccess:"; sed 's/^/    | /' "$DOCROOT/.htaccess" | head -40; }
  [ -d "$DOCROOT/_next" ] && warn "в корне есть /_next/ — основной сайт на Next.js: собирать раздел с ASSET_PREFIX (см. DEPLOY.md)"
  [ -e "$DOCROOT/articles" ] && warn "в корне уже есть articles — посмотреть, что это, до выкладки"
  [ -w "$DOCROOT" ] && ok "есть права на запись" || bad "нет прав на запись в корень сайта"
else
  warn "корень сайта не найден автоматически — передайте путь: bash preflight.sh /путь/к/корню"
fi

h "Сайт снаружи ($SITE)"
for p in / /articles/ /articles/takoj-stranicy-net/ /blog/ /sitemap.xml /robots.txt /api/; do
  r="$(curl -s -o /dev/null -m 15 -w '%{http_code} %{content_type} → %{redirect_url}' "$SITE$p")"
  echo "  $p: $r"
done
echo "  robots.txt сейчас:"; curl -s -m 15 "$SITE/robots.txt" | head -20 | sed 's/^/    | /'
curl -sI -m 15 "$SITE/" | grep -i "^server:\|^x-powered-by:\|^x-robots-tag:" | sed 's/^/  заголовок: /'

h "WordPress GraphQL ($WP)"
code="$(curl -s -o /tmp/unitr-preflight-wp.json -m 20 -w '%{http_code}' -H 'Content-Type: application/json' -d '{"query":"{ generalSettings { title } unitrArticlesSettings { perPage category } }"}' "$WP")"
if [ "$code" = 200 ]; then
  ok "доступен с сервера (HTTP 200)"
  grep -q unitrArticlesSettings /tmp/unitr-preflight-wp.json && grep -q '"perPage"' /tmp/unitr-preflight-wp.json && ok "плагин раздела установлен (unitrArticlesSettings отвечает)" || warn "плагин раздела ещё не установлен/не активирован: $(head -c 300 /tmp/unitr-preflight-wp.json)"
else
  bad "HTTP $code — сервер сайта не достаёт до WordPress (нужно для SSR)"
fi
rm -f /tmp/unitr-preflight-wp.json

h "Порты"
(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | awk 'NR==1 || /:3000 |:3001 |:80 |:443 /' | sed 's/^/  /'

h "Итог"
if [ -n "$NODE" ] && [ "${MAJOR:-0}" -ge 20 ] || [ "$SUDO" = yes ]; then
  echo "  Рекомендуемый вариант: А — Node.js-приложение (SSR + ISR + вебхук), docs/RUNBOOK.md, шаги А1–А5."
else
  echo "  Рекомендуемый вариант: Б — статическая выкладка + .htaccess из GitHub Actions, docs/RUNBOOK.md, шаги Б1–Б4."
fi
