#!/usr/bin/env node
// Ручные пункты Прил. № 4, проверенные на стенде после изменений в WordPress (DEMO_MODE=apply в
// deploy/hosting/wp-stand-scenario.php): число анонсов меняется без кода, снятая статья исчезает без пустых мест,
// смена адреса — новый адрес + 301 со старого, новая подрубрика — страница и карта сайта.
//
//   node scripts/check-scenario.mjs <BASE_URL> '<SCENARIO json>' [--report=файл.md]
import fs from "node:fs";

const [baseArg, json, ...rest] = process.argv.slice(2);
const BASE = baseArg.replace(/\/+$/, "");
const S = JSON.parse(json);
const REPORT = (rest.find((a) => a.startsWith("--report=")) || "").slice(9);
const AUTH = process.env.BASIC_AUTH ? { Authorization: `Basic ${Buffer.from(process.env.BASIC_AUTH).toString("base64")}` } : {};
const get = async (p) => {
  const r = await fetch(p.startsWith("http") ? p : BASE + p, { redirect: "manual", headers: AUTH });
  return { status: r.status, location: r.headers.get("location"), body: await r.text() };
};
const results = [];
const check = (name, ok, details = "") => results.push({ name, ok: !!ok, details: String(details) });
const cards = (html) => (html.match(/<article class="card"/g) || []).length;

const arch = await get("/articles/");
const pages = Math.ceil(S.published / S.perPage);
check(`Анонсов на странице из настройки WordPress: ${S.perPage}`, cards(arch.body) === S.perPage, `на /articles/: ${cards(arch.body)}`);
const last = await get(`/articles/page/${pages}/`);
const lastN = S.published - (pages - 1) * S.perPage;
check(`Список сдвинулся без пустых мест: ${pages} стр., на последней ${lastN}`, last.status === 200 && cards(last.body) === lastN && (await get(`/articles/page/${pages + 1}/`)).status === 404, `HTTP ${last.status}, анонсов ${cards(last.body)}`);
const draft = await get(`/articles/${S.draftSlug}/`);
check("Снятая с публикации статья → 404", draft.status === 404, `HTTP ${draft.status}`);
const neu = await get(`/articles/${S.newSlug}/`);
check("Статья по новому адресу → 200", neu.status === 200, `/articles/${S.newSlug}/ HTTP ${neu.status}`);
const old = await get(`/articles/${S.oldSlug}/`);
check("Старый адрес статьи → 301 на новый", old.status === 301 && new URL(old.location || "", BASE).pathname === `/articles/${S.newSlug}/`, `HTTP ${old.status} → ${old.location}`);
const cat = await get(`/articles/category/${S.rubric}/`);
check("Новая подрубрика: страница со статьёй", cat.status === 200 && cat.body.includes(`/articles/${S.inRubric}/`), `HTTP ${cat.status}`);

const sm = await get("/sitemap.xml");
let locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (/<sitemapindex/.test(sm.body)) {
  const parts = await Promise.all(locs.map((l) => get(l)));
  locs = parts.flatMap((p) => [...p.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
}
const has = (p) => locs.some((l) => new URL(l).pathname === p);
check("Карта сайта: новый адрес есть, старый и снятая статья — нет", has(`/articles/${S.newSlug}/`) && !has(`/articles/${S.oldSlug}/`) && !has(`/articles/${S.draftSlug}/`));
check("Карта сайта: новая подрубрика", has(`/articles/category/${S.rubric}/`));

const minutes = ((Date.now() / 1000 - S.applied) / 60).toFixed(1);
const failed = results.filter((r) => !r.ok);
const md = [`# Изменения в WordPress → стенд (${minutes} мин после изменения)`, "", "| | Проверка | Детали |", "|---|---|---|", ...results.map((r) => `| ${r.ok ? "✅" : "❌"} | ${r.name} | ${r.details.replace(/\|/g, "\\|")} |`)].join("\n");
if (REPORT) fs.writeFileSync(REPORT, md + "\n");
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.details ? ` — ${r.details}` : ""}`);
console.log(`\nИтого: ${results.length - failed.length}/${results.length}; от изменения в WordPress до проверки: ${minutes} мин`);
process.exit(failed.length ? 1 : 0);
