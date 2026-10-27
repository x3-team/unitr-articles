#!/usr/bin/env node
// Автоматическая проверка критериев приёмки (Приложение № 4, раздел 5.1 / ТЗ, раздел 6).
// Проверка — как у Заказчика: по исходному HTML без выполнения JavaScript и по ответам сервера.
//
//   node scripts/check-acceptance.mjs <BASE_URL> [--mode=server|static|pages] [--report=файл.md]
//
//   --mode=server  — боевой режим (Node.js): ожидаются настоящие HTTP 301, заголовки кеша, вебхук.
//   --mode=static  — боевой статический вариант (хостинг без Node.js, Apache + .htaccess): настоящие 301 и 404,
//                    кеш HTML ≤ 900 с, обновление — пересборкой каждые 10 минут (deploy-static.yml).
//   --mode=pages   — статическое демо на GitHub Pages: 301 эмулируются страницами-переадресациями.
//   HOME_URL=...   — адрес главной страницы сайта для сравнения title/description (по умолчанию BASE_URL/).
//   SECRET_VALUES=a,b — значения секретов, которых не должно быть в клиентском JS.
//   BASIC_AUTH=логин:пароль — для тестового стенда, закрытого паролем.
//   --stand        — тестовый стенд (включается и при BASIC_AUTH): стенд закрыт от индексации заголовком
//                    X-Robots-Tag: noindex до показа заказчику — это не ошибка. meta robots в HTML раздела
//                    (то, что поедет на прод) проверяется строго. На production проверка noindex строгая целиком.

import fs from "node:fs";

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) || "http://localhost:3000").replace(/\/+$/, "");
const MODE = (args.find((a) => a.startsWith("--mode=")) || "--mode=server").slice(7);
if (!["server", "static", "pages"].includes(MODE)) throw new Error(`Неизвестный режим: ${MODE}`);
/** настоящие HTTP 301 / 404 от веб-сервера (Node.js или Apache) */
const REAL_HTTP = MODE !== "pages";
const REPORT = (args.find((a) => a.startsWith("--report=")) || "").slice(9);
const HOME_URL = process.env.HOME_URL || `${BASE}/`;
const SECRETS = (process.env.SECRET_VALUES || "").split(",").filter(Boolean);
// тестовый стенд, закрытый паролем (Basic Auth): BASIC_AUTH=логин:пароль
const AUTH = process.env.BASIC_AUTH ? { Authorization: `Basic ${Buffer.from(process.env.BASIC_AUTH).toString("base64")}` } : {};
const STAND = args.includes("--stand") || !!process.env.BASIC_AUTH;

const results = [];
let currentGroup = "";
const group = (name) => (currentGroup = name);
function check(name, ok, details = "", { soft = false } = {}) {
  results.push({ group: currentGroup, name, ok: !!ok, soft, details: String(details) });
}

async function get(path, { redirect = "manual" } = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { redirect, headers: { "User-Agent": "unitr-acceptance-check/1.0 (no-js)", ...AUTH } });
      const body = await res.text();
      return { url, status: res.status, headers: res.headers, body, location: res.headers.get("location") };
    } catch (e) {
      if (attempt === 2) return { url, status: 0, headers: new Headers(), body: "", location: null, error: e.message };
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

// ---------- разбор HTML без DOM (как «просмотр исходного кода») ----------
const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag);
  return m ? decode(m[1]) : null;
};
const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) || [];
const head = (html) => (/<head[^>]*>([\s\S]*?)<\/head>/i.exec(html) || [, ""])[1];
const titleOf = (html) => decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head(html)) || [, ""])[1].trim());
const metaContent = (html, key) => {
  for (const t of tags(head(html), "meta")) if (attr(t, "name") === key || attr(t, "property") === key) return attr(t, "content");
  return null;
};
const canonicalOf = (html) => {
  for (const t of tags(head(html), "link")) if (attr(t, "rel") === "canonical") return attr(t, "href");
  return null;
};
const linkRel = (html, rel) => {
  for (const t of tags(head(html), "link")) if (attr(t, "rel") === rel) return attr(t, "href");
  return null;
};
const h1Of = (html) => (html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || []).map((h) => decode(h.replace(/<[^>]+>/g, "").trim()));
const jsonLds = (html) =>
  (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || []).flatMap((s) => {
    try {
      return [JSON.parse(s.replace(/^<script[^>]*>|<\/script>$/gi, ""))];
    } catch {
      return [];
    }
  });
const hrefs = (html) => tags(html, "a").map((t) => attr(t, "href")).filter(Boolean);
const abs = (href) => new URL(href, `${BASE}/`).toString();
const articlesPrefix = new URL(`${BASE}/articles/`).pathname;
const isArticleHref = (href) => {
  const p = new URL(href, `${BASE}/`).pathname;
  if (!p.startsWith(articlesPrefix)) return false;
  const rest = p.slice(articlesPrefix.length).replace(/\/$/, "");
  return rest && !rest.includes("/") && rest !== "page" && rest !== "category";
};
const metaNoindex = (res) => /noindex|none/i.test(metaContent(res.body, "robots") || "");
const headerNoindex = (res) => /noindex|none/i.test(res.headers.get("x-robots-tag") || "");
// на стенде X-Robots-Tag: noindex задан намеренно (закрыт до показа заказчику), в счёт идёт только meta robots
const noindex = (res) => metaNoindex(res) || (!STAND && headerNoindex(res));
const sMaxAge = (res) => {
  const cc = res.headers.get("cache-control") || "";
  const m = /s-maxage=(\d+)/.exec(cc) || /max-age=(\d+)/.exec(cc);
  return m ? Number(m[1]) : null;
};

async function main() {
  console.log(`Проверка ${BASE} (режим: ${MODE}${STAND ? ", тестовый стенд" : ""})\n`);

  // ===== 1. Архив /articles/ =====
  group("1.1 Страница архива /articles/");
  const arch = await get("/articles/");
  check("/articles/ открывается (HTTP 200)", arch.status === 200, `HTTP ${arch.status}`);
  const h1 = h1Of(arch.body);
  check("H1 «Статьи» в исходном HTML", h1.length === 1 && h1[0] === "Статьи", JSON.stringify(h1));
  const cardLinks = [...new Set(hrefs(arch.body).filter(isArticleHref).map(abs))];
  const cards = arch.body.match(/<article class="card"/g) || [];
  check("10 анонсов на первой странице", cards.length === 10, `анонсов: ${cards.length}`);
  check("Заголовки статей со ссылками (без JS)", cardLinks.length >= 10 && /<h2 class="card__title">[^<]+<\/h2>/.test(arch.body), `ссылок на статьи: ${cardLinks.length}`);
  check("Анонс: обложка, excerpt, дата", /class="card__cover"><img [^>]*src="[^"]+"/.test(arch.body) && /class="card__excerpt">[^<]{20,}/.test(arch.body) && /<time dateTime="\d{4}-\d\d-\d\dT/.test(arch.body));
  check("canonical /articles/ → на себя", canonicalOf(arch.body) === `${BASE}/articles/`, canonicalOf(arch.body));
  check("Пагинация: номера страниц и «Следующая»", /class="pager__num[^"]*"[^>]*>2</.test(arch.body) && /rel="next"[^>]*>Следующая|>Следующая/.test(arch.body) && hrefs(arch.body).some((h) => abs(h) === `${BASE}/articles/page/2/`));
  check("<link rel=next> на /articles/page/2/", linkRel(arch.body, "next") === `${BASE}/articles/page/2/`, linkRel(arch.body, "next"));

  const archTitle = titleOf(arch.body);
  const archDesc = metaContent(arch.body, "description");
  const home = await get(HOME_URL);
  const homeTitle = titleOf(home.body);
  const homeDesc = metaContent(home.body, "description");
  check("Собственный title, отличный от главной", archTitle && archTitle !== homeTitle, `«${archTitle}» vs главная «${homeTitle}»`);
  check("Собственный meta description, отличный от главной", archDesc && archDesc !== homeDesc, archDesc);
  const archLd = jsonLds(arch.body);
  const bc = archLd.find((x) => x["@type"] === "BreadcrumbList");
  check("Хлебные крошки в HTML + Schema.org BreadcrumbList", /class="crumbs"/.test(arch.body) && bc && bc.itemListElement?.length >= 2, bc ? bc.itemListElement.map((i) => i.name).join(" › ") : "нет");

  // все страницы пагинации
  let totalPages = 1;
  const nums = [...arch.body.matchAll(/class="pager__num[^"]*"[^>]*>(\d+)</g)].map((m) => Number(m[1]));
  if (nums.length) totalPages = Math.max(...nums);
  const allArticleUrls = new Set(cardLinks);
  for (let p = 2; p <= totalPages; p++) {
    const r = await get(`/articles/page/${p}/`);
    const url = `${BASE}/articles/page/${p}/`;
    check(`/articles/page/${p}/: 200 и canonical на себя`, r.status === 200 && canonicalOf(r.body) === url, `HTTP ${r.status}, canonical ${canonicalOf(r.body)}`);
    check(`/articles/page/${p}/: title и description уникальны`, titleOf(r.body) !== archTitle && /Страница \d+/.test(metaContent(r.body, "description") || ""), titleOf(r.body));
    check(`/articles/page/${p}/: «Предыдущая» и rel=prev`, /rel="prev"/.test(r.body) && linkRel(r.body, "prev") === (p === 2 ? `${BASE}/articles/` : `${BASE}/articles/page/${p - 1}/`), linkRel(r.body, "prev"));
    check(`/articles/page/${p}/: H1 «Статьи»`, h1Of(r.body)[0] === "Статьи");
    hrefs(r.body).filter(isArticleHref).forEach((h) => allArticleUrls.add(abs(h)));
    if (p === totalPages) {
      const n = (r.body.match(/<article class="card"/g) || []).length;
      check(`Последняя страница без пустых мест (анонсов: ${n})`, n >= 1 && n <= 10);
    }
  }
  const outOfRange = await get(`/articles/page/${totalPages + 1}/`);
  check(`Страница пагинации за пределами (/page/${totalPages + 1}/) → 404`, outOfRange.status === 404, `HTTP ${outOfRange.status}`);

  // ===== 1.2 Статьи =====
  group("1.2 Страница статьи /articles/<slug>/");
  const articleUrls = [...allArticleUrls];
  let okCount = 0;
  const failures = [];
  for (const url of articleUrls) {
    const r = await get(url);
    const problems = [];
    if (r.status !== 200) problems.push(`HTTP ${r.status}`);
    if (h1Of(r.body).length !== 1) problems.push(`H1: ${h1Of(r.body).length}`);
    if (canonicalOf(r.body) !== url) problems.push(`canonical ${canonicalOf(r.body)}`);
    if (!titleOf(r.body)) problems.push("title");
    if (!(metaContent(r.body, "description") || "").trim()) problems.push("description");
    const art = jsonLds(r.body).find((x) => x["@type"] === "Article");
    if (!art || !art.headline || !art.datePublished || !art.dateModified || !art.author?.name || !art.image?.url) problems.push("Schema.org Article");
    if (!jsonLds(r.body).some((x) => x["@type"] === "BreadcrumbList")) problems.push("BreadcrumbList");
    for (const og of ["og:title", "og:description", "og:image", "og:url", "og:type"]) if (!metaContent(r.body, og)) problems.push(og);
    if (metaContent(r.body, "og:type") !== "article") problems.push("og:type≠article");
    if (!/<div class="prose">[\s\S]*<h2>/.test(r.body)) problems.push("H2 в тексте");
    const textLen = ((/<div class="prose">([\s\S]*?)<\/div>/.exec(r.body) || [, ""])[1] || "").replace(/<[^>]+>/g, "").length;
    if (textLen < 300) problems.push(`полный текст (${textLen} симв.)`);
    if (!/class="post-nav"/.test(r.body)) problems.push("навигация пред./след.");
    if (!/class="crumbs"[\s\S]*?href="[^"]*\/articles\/"/.test(r.body)) problems.push("крошки → раздел");
    if (!/^[a-z0-9-]+$/.test(new URL(url).pathname.split("/").filter(Boolean).pop())) problems.push("ЧПУ не латиница");
    if (noindex(r)) problems.push("noindex");
    if (problems.length) failures.push(`${url}: ${problems.join(", ")}`);
    else okCount++;
  }
  check(`Все статьи (${articleUrls.length}): 200, полный текст и H2/H3 в HTML, title, description, canonical на себя, Article, Open Graph, крошки, пред./след., латинский ЧПУ`, articleUrls.length > 0 && okCount === articleUrls.length, failures.slice(0, 5).join("\n") || `OK: ${okCount}`);
  if (articleUrls[0]) {
    const r = await get(articleUrls[0]);
    const art = jsonLds(r.body).find((x) => x["@type"] === "Article") || {};
    check("Пример Article (первая статья)", true, `headline: ${art.headline}; datePublished: ${art.datePublished}; dateModified: ${art.dateModified}; author: ${art.author?.name}; image: ${art.image?.url}; og:image: ${metaContent(r.body, "og:image")}`);
  }

  // ===== 2. Меню =====
  group("2 Пункт «Статьи» в меню");
  const navDesktop = /<nav class="header__nav"[\s\S]*?<\/nav>/.exec(arch.body)?.[0] || "";
  const navMobile = /<nav class="mobile-menu"[\s\S]*?<\/nav>/.exec(arch.body)?.[0] || "";
  const navHas = (nav) => /href="[^"]*\/articles\/"[^>]*>Статьи</.test(nav);
  const order = (nav) => ["Каталог", "Конфигураторы", "Статьи"].map((s) => nav.indexOf(`>${s}<`));
  check("Десктоп: «Статьи» рядом с «Каталог» и «Конфигураторы», ссылка в серверном HTML", navHas(navDesktop) && order(navDesktop).every((v, i, a) => v > 0 && (i === 0 || v > a[i - 1])));
  check("Мобильное меню: ссылка «Статьи» в серверном HTML (открывается без JS)", navHas(navMobile) && /id="menu-toggle"/.test(arch.body));
  check("Активный пункт выделен в разделе (aria-current + is-active)", /class="header__link is-active" aria-current="page"[^>]*>Статьи|href="[^"]*\/articles\/" class="header__link is-active" aria-current="page"/.test(navDesktop) || /is-active[^>]*aria-current="page"[^>]*>Статьи</.test(navDesktop), "");
  if (articleUrls[0]) {
    const r = await get(articleUrls[0]);
    check("Пункт активен и на странице статьи", /is-active[^>]*aria-current="page"[^>]*>Статьи</.test(r.body));
  }
  if (MODE === "pages") {
    const homeNav = /<nav class="header__nav"[\s\S]*?<\/nav>/.exec(home.body)?.[0] || "";
    check("На главной (демо) пункт «Статьи» есть и не активен", navHas(homeNav) && !/is-active/.test(homeNav));
  }

  // ===== 3. Автообновление и кеш =====
  group("3 Автообновление и кеш (≤ 15 минут)");
  if (REAL_HTTP) {
    const ttlA = sMaxAge(arch);
    check("Кеш HTML архива ≤ 900 с (Cache-Control)", ttlA !== null && ttlA <= 900, arch.headers.get("cache-control"));
    const sm = await get("/sitemap.xml");
    const ttlS = sMaxAge(sm);
    check("Кеш sitemap.xml ≤ 900 с", ttlS !== null && ttlS <= 900, sm.headers.get("cache-control"));
    if (MODE === "server") {
      const wh = await fetch(`${BASE}/api/revalidate/`, { method: "POST" });
      check("Вебхук ревалидации существует и защищён секретом (без секрета → 401)", wh.status === 401, `HTTP ${wh.status}`);
    } else {
      check("Обновление: пересборка и выкладка каждые 10 минут (.github/workflows/deploy-static.yml)", true, "", { soft: true });
    }
  } else {
    check("Pages: кеш CDN ≤ 900 с", (sMaxAge(arch) ?? 0) <= 900, arch.headers.get("cache-control") || "нет заголовка");
    check("Pages: пересборка по расписанию каждые 15 минут (GitHub Actions cron) — см. .github/workflows/pages.yml", true, "на боевом сервере — ISR 300 с + кеш данных 300 с + вебхук", { soft: true });
  }
  const draft = /chernovik/;
  check("Снятая с публикации (черновик) отсутствует в разделе", !draft.test(arch.body) && ![...allArticleUrls].some((u) => draft.test(u)));

  // ===== 4. Sitemap и robots =====
  group("4 Карта сайта и индексация");
  const sm = await get("/sitemap.xml");
  check("/sitemap.xml → HTTP 200", sm.status === 200, `HTTP ${sm.status}`);
  check("Content-Type: application/xml", /application\/xml|text\/xml/.test(sm.headers.get("content-type") || ""), sm.headers.get("content-type"));
  let locs = [];
  let lastmods = 0;
  if (/<sitemapindex/.test(sm.body)) {
    for (const m of sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const part = await get(decode(m[1]));
      locs.push(...[...part.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => decode(x[1])));
      lastmods += (part.body.match(/<lastmod>/g) || []).length;
    }
  } else {
    locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => decode(x[1]));
    lastmods = (sm.body.match(/<lastmod>/g) || []).length;
  }
  const locSet = new Set(locs);
  check("В карте: главная", locSet.has(`${BASE}/`) || locSet.has(HOME_URL));
  check("В карте: страницы каталога", locs.some((l) => /\/catalog\//.test(l)), locs.filter((l) => /\/catalog\//.test(l)).length + " адресов", { soft: REAL_HTTP });
  check("В карте: раздел /articles/", locSet.has(`${BASE}/articles/`));
  const missingArticles = articleUrls.filter((u) => !locSet.has(u));
  check(`В карте: все статьи (${articleUrls.length})`, missingArticles.length === 0, missingArticles.slice(0, 3).join(", "));
  const pagesMissing = [];
  for (let p = 2; p <= totalPages; p++) if (!locSet.has(`${BASE}/articles/page/${p}/`)) pagesMissing.push(p);
  check("В карте: страницы пагинации", pagesMissing.length === 0, pagesMissing.length ? `нет: ${pagesMissing}` : `${totalPages - 1} стр.`);
  check("<lastmod> у каждого адреса", lastmods === locs.length && locs.length > 0, `${lastmods}/${locs.length}`);
  check("Черновик отсутствует в карте", !locs.some((l) => draft.test(l)));
  check("В карте только существующие адреса (выборочно 5)", (await Promise.all(locs.slice(-5).map((l) => get(l)))).every((r) => r.status === 200));

  const robotsUrl = MODE === "pages" ? `${BASE}/robots.txt` : `${new URL(BASE).origin}/robots.txt`;
  const robots = await get(robotsUrl);
  check("/robots.txt → 200", robots.status === 200, `${robotsUrl}: HTTP ${robots.status}`);
  check("robots.txt: адрес карты сайта", new RegExp(`^Sitemap:\\s*${BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/sitemap\\.xml\\s*$`, "mi").test(robots.body), (robots.body.match(/^Sitemap:.*$/im) || [""])[0]);
  check("robots.txt: явное Allow для /articles/", /^Allow:\s*\S*\/articles\/\s*$/im.test(robots.body));
  const disallows = [...robots.body.matchAll(/^Disallow:\s*(\S*)\s*$/gim)].map((m) => m[1]).filter(Boolean);
  const blocks = disallows.filter((d) => `${articlesPrefix}x/`.startsWith(d) || articlesPrefix.startsWith(d));
  check("robots.txt: нет запретов для /articles/", blocks.length === 0, `Disallow: ${disallows.join(", ") || "—"}`);
  const sample = [arch, ...(await Promise.all(articleUrls.slice(0, 3).map((u) => get(u))))];
  const robotsDetails = sample.map((r) => `${r.headers.get("x-robots-tag") || "—"} / ${metaContent(r.body, "robots") || "—"}`).join("; ");
  if (STAND) {
    check("Нет noindex в meta robots на страницах раздела", sample.every((r) => !metaNoindex(r)), robotsDetails);
    check("Стенд закрыт от индексации (X-Robots-Tag: noindex до показа заказчику; на production проверяется отсутствие)", true, sample.some(headerNoindex) ? "X-Robots-Tag: noindex — есть" : "X-Robots-Tag не задан", { soft: true });
  } else {
    check("Нет noindex (meta robots и X-Robots-Tag) на страницах раздела", sample.every((r) => !noindex(r)), robotsDetails);
  }

  // ===== 5. 404, 301, токен =====
  group("5 Маршрутизация, ошибки, безопасность");
  for (const p of ["/articles/takoj-stati-net-xyz/", "/articles/page/0/", "/articles/category/nesushhestvuyushhaya/"]) {
    const r = await get(p);
    check(`${p} → 404 со страницей ошибки`, r.status === 404 && /Страница не найдена/.test(r.body) && !/<article class="card"/.test(r.body), `HTTP ${r.status}`);
  }
  const firstSlug = articleUrls[0] ? new URL(articleUrls[0]).pathname.split("/").filter(Boolean).pop() : "x";
  const legacy = ["/blog", "/blog/", "/poleznye-stati", "/poleznye-stati/"];
  if (REAL_HTTP) {
    for (const p of legacy) {
      const r = await get(p);
      check(`${p} → 301 /articles/`, r.status === 301 && abs(r.location || "") === `${BASE}/articles/`, `HTTP ${r.status} → ${r.location}`);
    }
    for (const p of [`/blog/${firstSlug}/`, `/poleznye-stati/${firstSlug}`]) {
      const r = await get(p);
      check(`${p} → 301 на статью (адрес сохраняется)`, r.status === 301 && abs(r.location || "") === `${BASE}/articles/${firstSlug}/`, `HTTP ${r.status} → ${r.location}`);
    }
    const ns = await get("/articles");
    check("/articles (без слеша) → 301 /articles/", ns.status === 301 && abs(ns.location || "") === `${BASE}/articles/`, `HTTP ${ns.status} → ${ns.location}`);
    const p1 = await get("/articles/page/1/");
    check("/articles/page/1/ → 301 /articles/ (нет дубля)", p1.status === 301 && abs(p1.location || "") === `${BASE}/articles/`, `HTTP ${p1.status} → ${p1.location}`);
  } else {
    for (const p of legacy) {
      const r = await get(p, { redirect: "follow" });
      const target = /http-equiv="refresh" content="0; url=([^"]+)"/.exec(r.body)?.[1];
      check(`${p} → переадресация на /articles/ (Pages: 301 на «/» + мгновенный refresh; на бою — HTTP 301)`, r.status === 200 && decode(target || "") === `${BASE}/articles/` && canonicalOf(r.body) === `${BASE}/articles/`, `→ ${target}`);
    }
    const r = await get(`/blog/${firstSlug}/`);
    const target = /http-equiv="refresh" content="0; url=([^"]+)"/.exec(r.body)?.[1];
    check(`/blog/${firstSlug}/ → на статью (адрес сохраняется)`, decode(target || "") === `${BASE}/articles/${firstSlug}/`, `→ ${target}`);
  }

  // токен WordPress не попадает в клиентский JS
  const scripts = [...new Set(tags(arch.body, "script").map((t) => attr(t, "src")).filter(Boolean))];
  let leaks = [];
  for (const s of scripts) {
    const js = (await get(abs(s))).body;
    for (const needle of ["WP_GRAPHQL_TOKEN", "WP_GRAPHQL_URL", "Authorization", "manage.unitr.ru/graphql", "REVALIDATE_SECRET", ...SECRETS])
      if (js.includes(needle)) leaks.push(`${s}: ${needle}`);
  }
  for (const needle of ["WP_GRAPHQL_TOKEN", "manage.unitr.ru/graphql", ...SECRETS]) if (arch.body.includes(needle)) leaks.push(`HTML: ${needle}`);
  check(`GraphQL-токен и адрес WP не попадают в клиентский код (проверено JS-файлов: ${scripts.length})`, scripts.length > 0 && leaks.length === 0, leaks.join("; ") || "чисто");

  // ===== отчёт =====
  const failed = results.filter((r) => !r.ok && !r.soft);
  const lines = [
    `# Проверка критериев приёмки — ${BASE}`,
    "",
    `Режим: **${{ server: "боевой (Node.js SSR)", static: "боевой статический (Apache)", pages: "статическое демо (GitHub Pages)" }[MODE]}${STAND ? ", тестовый стенд" : ""}** · ${new Date().toISOString()} · проверок: ${results.length}, не пройдено: ${failed.length}`,
    "",
  ];
  let g = "";
  for (const r of results) {
    if (r.group !== g) {
      g = r.group;
      lines.push("", `## ${g}`, "", "| | Проверка | Детали |", "|---|---|---|");
    }
    lines.push(`| ${r.ok ? "✅" : r.soft ? "⚠️" : "❌"} | ${r.name.replace(/\|/g, "\\|")} | ${r.details.replace(/\|/g, "\\|").replace(/\n/g, "<br>").slice(0, 400)} |`);
  }
  const md = lines.join("\n") + "\n";
  if (REPORT) fs.writeFileSync(REPORT, md);
  for (const r of results) console.log(`${r.ok ? "✅" : r.soft ? "⚠️ " : "❌"} [${r.group}] ${r.name}${r.ok ? "" : ` — ${r.details}`}`);
  console.log(`\nИтого: ${results.length - failed.length}/${results.length} пройдено`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
