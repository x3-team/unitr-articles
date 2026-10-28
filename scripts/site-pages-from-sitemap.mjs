#!/usr/bin/env node
// Страницы основного сайта (SPA) для карты сайта раздела: из исходного sitemap.xml сайта (до выкладки раздела).
//
//   node scripts/site-pages-from-sitemap.mjs <sitemap.xml>   → JSON [{"path","lastmod"}] для SITE_STATIC_PAGES
//
// Адреса раздела (/articles/…) и прежние адреса (/blog, /poleznye-stati) пропускаются — их карта строится из WordPress. Без <lastmod> — дата сборки.
import fs from "node:fs";

const xml = fs.existsSync(process.argv[2] || "") ? fs.readFileSync(process.argv[2], "utf8") : "";
const today = new Date().toISOString().slice(0, 10);
const pages = [];
for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  const loc = /<loc>\s*([^<]+?)\s*<\/loc>/.exec(m[1])?.[1];
  if (!loc) continue;
  let path;
  try {
    path = new URL(loc.replace(/&amp;/g, "&")).pathname;
  } catch {
    continue;
  }
  // раздел и его прежние адреса (/blog, /poleznye-stati — теперь 301 на /articles/) в карту сайта не попадают
  if (/^\/(articles|blog|poleznye-stati)(\/|$)/.test(path) || pages.some((p) => p.path === path)) continue;
  pages.push({ path, lastmod: /<lastmod>\s*([^<]+?)\s*<\/lastmod>/.exec(m[1])?.[1] || today });
}
process.stdout.write(JSON.stringify(pages));
