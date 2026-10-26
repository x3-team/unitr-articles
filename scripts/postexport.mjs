// Пост-обработка статического экспорта для GitHub Pages.
//  1. .nojekyll — иначе Pages не отдаст каталог _next/.
//  2. Страницы-переадресации для старых адресов раздела (/blog/, /poleznye-stati/, прежние slug статей).
//     GitHub Pages не умеет отдавать HTTP 301, поэтому здесь — максимально близкий аналог:
//     <link rel="canonical"> + <meta http-equiv="refresh" content="0"> + location.replace().
//     Поисковые системы обрабатывают такую мгновенную переадресацию как постоянный редирект.
//     Адреса без слеша (/blog) Pages сам переводит на /blog/ кодом 301.
//     На боевом сервере те же правила отдаются настоящим HTTP 301 (src/middleware.server.ts).
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("out");
const SITE_URL = (process.env.SITE_URL || "").replace(/\/+$/, "");
if (!SITE_URL) throw new Error("SITE_URL не задан");

fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

const rules = JSON.parse(fs.readFileSync(path.join(OUT, "demo-redirects.json"), "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
let n = 0;
for (const { from, to } of rules) {
  const target = `${SITE_URL}${to}`;
  const file = path.join(OUT, from, "index.html");
  if (fs.existsSync(file)) continue; // не перезаписываем реальные страницы
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Страница переехала — Статьи | Юнит-Ресурс</title>
<link rel="canonical" href="${esc(target)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
</head>
<body>
<p>Раздел «Статьи» переехал: <a href="${esc(target)}">${esc(target)}</a></p>
<!-- На боевом сервере этот адрес отдаёт HTTP 301 Location: ${esc(target)} -->
</body>
</html>
`,
  );
  n++;
}
console.log(`postexport: страниц-переадресаций создано: ${n}`);
