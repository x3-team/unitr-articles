// Сквозной тест боевого режима с GraphQL-источником (ТЗ, задачи 3–5):
//  1. сборка Next.js (CONTENT_SOURCE=graphql) против имитации WordPress + WPGraphQL;
//  2. полная проверка критериев приёмки (scripts/check-acceptance.mjs, режим server);
//  3. публикация новой статьи → вебхук → статья на 1-й странице архива и в sitemap.xml;
//  4. снятие с публикации → вебхук → статья исчезает из архива и карты, адрес отдаёт 404;
//  5. смена адреса статьи → 301 со старого адреса; новая подрубрика → в карте сайта;
//  6. смена количества анонсов в WordPress → архив перестраивается без правки кода;
//  7. кириллический slug в WordPress → латинский ЧПУ на сайте;
//  8. все запросы к WordPress идут с токеном только с сервера.
// Запуск: node tests/e2e/run-graphql-e2e.mjs
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createFakeWp } from "./fake-wpgraphql.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WP_PORT = 4010;
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const TOKEN = "editor:abcd EFGH 1234 ijkl";
const SECRET = "e2e-secret-" + Math.random().toString(36).slice(2);

const env = {
  ...process.env,
  CONTENT_SOURCE: "graphql",
  WP_GRAPHQL_URL: `http://127.0.0.1:${WP_PORT}/graphql`,
  WP_GRAPHQL_TOKEN: TOKEN,
  WP_GRAPHQL_AUTH: "basic",
  SITE_URL: BASE,
  REVALIDATE_SECRET: SECRET,
  REDIRECTS_TTL_SECONDS: "1",
  ARTICLES_PER_PAGE: "",
  SITE_STATIC_PAGES: JSON.stringify([{ path: "/configurators/", lastmod: "2026-10-01" }]),
  NEXT_TELEMETRY_DISABLED: "1",
};

let failed = 0;
const ok = (cond, msg, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${msg}${cond ? "" : ` — ${extra}`}`);
  if (!cond) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (p, opts = {}) => {
  const r = await fetch(p.startsWith("http") ? p : BASE + p, { redirect: "manual", ...opts });
  return { status: r.status, location: r.headers.get("location"), body: await r.text(), headers: r.headers };
};
const revalidate = async () => {
  const r = await fetch(`${BASE}/api/revalidate/`, { method: "POST", headers: { "x-revalidate-secret": SECRET } });
  return r.status;
};
// после ревалидации первый запрос может отдать устаревшую копию (stale-while-revalidate) и запустить перегенерацию
const fresh = async (p) => {
  await get(p);
  await sleep(1500);
  return get(p);
};

// execSync нельзя: он блокирует цикл событий, и имитация WordPress в этом же процессе перестаёт отвечать
const run = (cmd, args, opts) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")}: код ${code}`))));
  });

const wp = createFakeWp({ token: TOKEN, port: WP_PORT });
const titles = [
  "Как выбрать серверный шкаф для офиса",
  "PDU с мониторингом: зачем он нужен",
  "Холодный коридор в серверной",
  "Медь или оптика в новом здании",
  "Заземление телекоммуникационного шкафа",
  "Настенный шкаф для небольшого офиса",
  "Расчёт ИБП для серверной",
  "Маркировка кабелей в СКС",
  "Коллокейшн-шкаф: кому он нужен",
  "Кабельные органайзеры в стойке",
  "Чек-лист помещения под серверную",
  "Патч-панели: категория и экранирование",
];
titles.forEach((t, i) =>
  wp.addPost({
    title: t,
    // одна запись — с кириллическим адресом (WordPress без Cyr-To-Lat): сайт должен построить латинский ЧПУ
    slug: i === 3 ? encodeURIComponent("медь-или-оптика") : `statya-${i + 1}`,
    sub: i % 3 === 0,
    seoTitle: i === 0 ? "SEO-заголовок из WordPress" : undefined,
    seoDescription: i === 0 ? "SEO-описание, заполненное в WordPress." : undefined,
    oldSlugs: i === 1 ? ["staryj-adres-pdu"] : [],
  }),
);

await wp.listen();
let server;
try {
  console.log("Сборка (CONTENT_SOURCE=graphql)…");
  fs.rmSync(path.join(ROOT, ".next"), { recursive: true, force: true });
  await run("npx", ["next", "build"], { cwd: ROOT, env });
  const sa = path.join(ROOT, ".next/standalone");
  fs.cpSync(path.join(ROOT, "public"), path.join(sa, "public"), { recursive: true });
  fs.cpSync(path.join(ROOT, ".next/static"), path.join(sa, ".next/static"), { recursive: true });
  server = spawn("node", ["server.js"], { cwd: sa, env: { ...env, PORT: String(PORT), HOSTNAME: "127.0.0.1" }, stdio: "inherit" });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await get("/articles/")).status === 200) break;
    } catch {}
    await sleep(200);
  }

  console.log("\n— Критерии приёмки (scripts/check-acceptance.mjs) —");
  try {
    await run("node", ["scripts/check-acceptance.mjs", BASE, "--mode=server", `--report=${path.join(ROOT, "docs/acceptance-graphql.md")}`], {
      cwd: ROOT,
      env: { ...env, HOME_URL: `http://127.0.0.1:${WP_PORT}/home`, SECRET_VALUES: [TOKEN, SECRET].join(",") },
    });
    ok(true, "Все критерии приёмки пройдены на данных из GraphQL");
  } catch {
    ok(false, "Критерии приёмки", "см. вывод выше");
  }

  console.log("\n— Сценарии автообновления —");
  const latin = await get("/articles/med-ili-optika/");
  ok(latin.status === 200, "Кириллический slug WordPress → латинский ЧПУ /articles/med-ili-optika/", `HTTP ${latin.status}`);
  const seo = await get("/articles/statya-1/");
  ok(/<title>SEO-заголовок из WordPress<\/title>/.test(seo.body) && /content="SEO-описание, заполненное в WordPress."/.test(seo.body), "title/description статьи — из полей WordPress");
  const old = await get("/articles/staryj-adres-pdu/");
  ok(old.status === 301 && old.location?.endsWith("/articles/statya-2/"), "Прежний адрес статьи (_wp_old_slug) → 301", `${old.status} ${old.location}`);

  // публикация
  const fresh1 = wp.publish({ title: "Новая статья: тест автообновления", slug: "novaya-statya-test", date: new Date().toISOString() });
  ok((await revalidate()) === 200, "Вебхук ревалидации принят (секрет верный)");
  let a = await fresh("/articles/");
  ok(a.body.includes(fresh1.title), "Новая статья появилась на первой странице архива");
  let sm = await fresh("/sitemap.xml");
  ok(sm.body.includes(`${BASE}/articles/novaya-statya-test/`), "Новая статья появилась в sitemap.xml");
  ok((await get("/articles/novaya-statya-test/")).status === 200, "Страница новой статьи открывается (рендер на сервере при первом обращении)");
  const cards = (a.body.match(/<article class="card"/g) || []).length;
  ok(cards === 10, `На первой странице по-прежнему 10 анонсов (${cards})`);

  // снятие с публикации
  wp.unpublish("novaya-statya-test");
  await revalidate();
  a = await fresh("/articles/");
  ok(!a.body.includes(fresh1.title), "Снятая с публикации статья исчезла из архива");
  sm = await fresh("/sitemap.xml");
  ok(!sm.body.includes("novaya-statya-test"), "…и из sitemap.xml");
  const gone = await fresh("/articles/novaya-statya-test/");
  ok(gone.status === 404, "…и её адрес отдаёт 404", `HTTP ${gone.status}`);
  const p2 = await fresh("/articles/page/2/");
  ok((p2.body.match(/<article class="card"/g) || []).length === 2, "Список сместился без пустых мест (на 2-й странице 2 анонса из 12)");

  // смена адреса
  wp.rename("statya-5", "zazemlenie-shkafa");
  await revalidate();
  await sleep(1200);
  await fresh("/articles/");
  const moved = await get("/articles/statya-5/");
  ok(moved.status === 301 && moved.location?.endsWith("/articles/zazemlenie-shkafa/"), "Изменённый адрес статьи → 301 на новый", `${moved.status} ${moved.location}`);
  sm = await fresh("/sitemap.xml");
  ok(sm.body.includes("/articles/zazemlenie-shkafa/") && !sm.body.includes("/articles/statya-5/"), "Карта сайта отразила изменение адреса");

  // новая подрубрика
  wp.addRubric("pitanie", "Электропитание");
  wp.tagPost("statya-7", { slug: "pitanie", name: "Электропитание" });
  await revalidate();
  sm = await fresh("/sitemap.xml");
  ok(sm.body.includes(`${BASE}/articles/category/pitanie/`), "Новая рубрика автоматически появилась в sitemap.xml");
  ok((await fresh("/articles/category/pitanie/")).status === 200, "…и её страница открывается");

  // количество анонсов из WordPress
  wp.state.perPage = 5;
  await revalidate();
  a = await fresh("/articles/");
  const n = (a.body.match(/<article class="card"/g) || []).length;
  ok(n === 5 && a.body.includes("/articles/page/3/"), `Количество анонсов изменено в WordPress (5) без правки кода (${n}, страниц: 3)`);

  // токен
  ok(wp.state.requests > 0 && wp.state.unauthorized === 0, `Все ${wp.state.requests} запросов к WordPress — с сервера и с токеном`);
  const bad = await fetch(`${BASE}/api/revalidate/`, { method: "POST", headers: { "x-revalidate-secret": "wrong" } });
  ok(bad.status === 401, "Вебхук с неверным секретом отклонён (401)");
} finally {
  server?.kill();
  await wp.close();
}
console.log(failed ? `\n❌ Не пройдено: ${failed}` : "\n✅ Сквозной тест пройден");
process.exit(failed ? 1 : 0);
