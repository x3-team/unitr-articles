// Боевой статический вариант раздела для хостинга без Node.js (Apache + .htaccess). Вызывается из postexport.mjs
// при EXPORT_TARGET=apache. Собирает out-apache/:
//
//   articles/                 — страницы раздела (+ _media/: файлы раздела, _next/ при ASSET_PREFIX=/articles/_media, 404.html)
//   articles/.htaccess        — 301 (прежние адреса статей, /page/1/, слеш), 404 для несуществующих адресов, заголовки
//   sitemap.xml, sitemaps/, robots.txt — в корень сайта
//   unitr-articles.htaccess   — блок для корневого .htaccess (301 со /blog и /poleznye-stati); вставляется
//                               scripts/merge-htaccess.mjs между маркерами BEGIN/END, остальное не трогается
//
// Правила повторяют src/middleware.server.ts (боевой Node.js-вариант) и проверяются тем же
// scripts/check-acceptance.mjs (--mode=static) и тестом tests/e2e/run-apache-e2e.sh.
import fs from "node:fs";
import path from "node:path";

const MEDIA = "articles/_media";
const LEGACY = "(?:blog|poleznye-stati)";
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const slugOf = (p) => p.split("/").filter(Boolean).pop();

export function buildApache({ out, rules, assetPrefix }) {
  const dest = path.resolve("out-apache");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.join(dest, MEDIA), { recursive: true });

  if (assetPrefix && assetPrefix !== `/${MEDIA}`) {
    throw new Error(`Для EXPORT_TARGET=apache соберите с ASSET_PREFIX=/${MEDIA} (сейчас: ${assetPrefix})`);
  }
  if (!assetPrefix) throw new Error(`Для EXPORT_TARGET=apache нужен ASSET_PREFIX=/${MEDIA}: статика раздела — внутри /articles/`);

  fs.cpSync(path.join(out, "articles"), path.join(dest, "articles"), { recursive: true });
  fs.cpSync(path.join(out, "_next"), path.join(dest, MEDIA, "_next"), { recursive: true });
  fs.copyFileSync(path.join(out, "404.html"), path.join(dest, MEDIA, "404.html"));
  for (const f of ["sitemap.xml", "robots.txt"]) fs.copyFileSync(path.join(out, f), path.join(dest, f));
  if (fs.existsSync(path.join(out, "sitemaps"))) fs.cpSync(path.join(out, "sitemaps"), path.join(dest, "sitemaps"), { recursive: true });
  // служебные файлы RSC (*.txt) статическому сайту без клиентской навигации Next.js не нужны, но безвредны — оставляем

  // прежние адреса статей (slug изменили в WordPress): /articles/<old>/ и /blog/<old>/ → /articles/<new>/
  const renamed = new Map();
  for (const { from, to } of rules) {
    const fromSlug = slugOf(from);
    const toSlug = slugOf(to);
    if (to !== "/articles/" && fromSlug !== toSlug) renamed.set(fromSlug, toSlug);
  }

  const banner = "# Сгенерировано scripts/export-apache.mjs — не редактировать вручную, файл перезаписывается при выкладке.";
  const articlesHt = [
    banner,
    "# Раздел «Статьи» unitr.ru: 301, 404 и заголовки (ТЗ, задачи 4–5).",
    "DirectoryIndex index.html",
    `ErrorDocument 404 /${MEDIA}/404.html`,
    "",
    "<IfModule mod_rewrite.c>",
    "RewriteEngine On",
    "RewriteBase /articles/",
    "# прежние адреса статей → актуальные",
    ...[...renamed].map(([o, n]) => `RewriteRule ^${reEsc(o)}/?$ /articles/${n}/ [R=301,L]`),
    "# /articles/page/1/ — дубль первой страницы",
    "RewriteRule ^((?:category/[^/]+/)?)page/1/?$ /articles/$1 [R=301,L]",
    "# адрес без завершающего слеша → со слешем",
    "RewriteCond %{REQUEST_FILENAME} -d",
    "RewriteRule ^(.*[^/])$ /articles/$1/ [R=301,L]",
    "# несуществующий адрес внутри раздела → HTTP 404 со страницей ошибки (а не SPA-оболочка с кодом 200)",
    "RewriteCond %{REQUEST_FILENAME} !-f",
    "RewriteCond %{REQUEST_FILENAME}/index.html !-f",
    "RewriteRule ^ - [R=404,L]",
    "</IfModule>",
    "",
    "<IfModule mod_headers.c>",
    "# индексация раздела явно разрешена, кеш страниц ≤ 5 минут (обновление раздела — каждые 10 минут)",
    'Header always set X-Robots-Tag "all"',
    '<FilesMatch "\\.html$">',
    'Header set Cache-Control "public, max-age=300, must-revalidate"',
    "</FilesMatch>",
    "</IfModule>",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dest, "articles", ".htaccess"), articlesHt);

  fs.writeFileSync(
    path.join(dest, MEDIA, "_next", ".htaccess"),
    [banner, "<IfModule mod_headers.c>", 'Header set Cache-Control "public, max-age=31536000, immutable"', "</IfModule>", ""].join("\n"),
  );

  const rootBlock = [
    "# BEGIN unitr-articles",
    banner,
    "# Старые адреса раздела → /articles/ (HTTP 301, адрес статьи сохраняется). Карта сайта и robots.txt.",
    "<IfModule mod_rewrite.c>",
    "RewriteEngine On",
    `RewriteRule ^${LEGACY}/?$ /articles/ [R=301,L]`,
    ...[...renamed].map(([o, n]) => `RewriteRule ^${LEGACY}/${reEsc(o)}/?$ /articles/${n}/ [R=301,L]`),
    `RewriteRule ^${LEGACY}/(.+?)/?$ /articles/$1/ [R=301,L]`,
    "</IfModule>",
    '<FilesMatch "^(sitemap\\.xml|robots\\.txt)$">',
    "<IfModule mod_headers.c>",
    'Header set Cache-Control "public, max-age=300, must-revalidate"',
    'Header always set X-Robots-Tag "all"',
    "</IfModule>",
    "</FilesMatch>",
    '<FilesMatch "^sitemap\\.xml$">',
    "ForceType application/xml",
    "</FilesMatch>",
    "# END unitr-articles",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dest, "unitr-articles.htaccess"), rootBlock);
  // карты-секции /sitemaps/N.xml
  fs.mkdirSync(path.join(dest, "sitemaps"), { recursive: true });
  fs.writeFileSync(
    path.join(dest, "sitemaps", ".htaccess"),
    [banner, "ForceType application/xml", "<IfModule mod_headers.c>", 'Header set Cache-Control "public, max-age=300, must-revalidate"', "</IfModule>", ""].join("\n"),
  );

  console.log(`postexport (apache): out-apache/ готов; переименованных статей: ${renamed.size}`);
}
