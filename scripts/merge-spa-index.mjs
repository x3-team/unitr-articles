#!/usr/bin/env node
// Пункт «Статьи» в шапке SPA: блоки раздела в index.html сайта (выкладка — scripts/deploy-static.sh).
//
//   node scripts/merge-spa-index.mjs <index.html> <результат> [версия]
//
// 1) в <head> — скрипт /articles/_media/spa-menu.js: ставит «Статьи» рядом с «Конфигураторы» в шапке SPA;
// 2) в <div id="root"> — запасная навигация «Каталог · Конфигураторы · Статьи» обычными ссылками в исходном HTML
//    (для роботов без JS); React заменяет содержимое #root при запуске, spa-menu.js убирает её и сам.
// Блоки ограничены комментариями BEGIN/END unitr-articles и заменяются при каждой выкладке; остальное не меняется.
import fs from "node:fs";

const [src, dst, ver = "1"] = process.argv.slice(2);
if (!src || !dst) throw new Error("usage: merge-spa-index.mjs <index.html> <out> [version]");
let html = fs.readFileSync(src, "utf8");

const strip = (s, name) => s.replace(new RegExp(`<!-- BEGIN ${name} -->[\\s\\S]*?<!-- END ${name} -->\\n?`, "g"), "");
html = strip(strip(html, "unitr-articles"), "unitr-articles-prenav");

if (!/<\/head>/i.test(html) || !/<div id="root"[^>]*>/i.test(html)) {
  console.error("index.html без </head> или <div id=\"root\"> — блоки раздела не добавлены");
  fs.writeFileSync(dst, html);
  process.exit(0);
}

const head = `<!-- BEGIN unitr-articles -->\n<script src="/articles/_media/spa-menu.js?v=${encodeURIComponent(ver)}" defer></script>\n<!-- END unitr-articles -->\n`;
const prenav =
  `<!-- BEGIN unitr-articles-prenav -->` +
  `<nav data-unitr-prenav aria-label="Разделы сайта" style="display:flex;gap:24px;padding:20px 24px;font:16px/1.2 sans-serif">` +
  `<a href="/catalog">Каталог</a><a href="/configurators">Конфигураторы</a><a href="/articles/">Статьи</a>` +
  `</nav><!-- END unitr-articles-prenav -->`;

html = html.replace(/<\/head>/i, `${head}</head>`).replace(/<div id="root"([^>]*)>/i, (m) => `${m}${prenav}`);
fs.writeFileSync(dst, html);
