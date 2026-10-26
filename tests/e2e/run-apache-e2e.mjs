// Сквозной тест боевого статического варианта (хостинг без Node.js): данные из имитации WPGraphQL →
// статический экспорт (EXPORT_TARGET=apache) → настоящий Apache с .htaccess поверх «существующего сайта»-SPA,
// у которого есть свой .htaccess с fallback на index.html (как сейчас на unitr.ru).
// Проверяется: все критерии приёмки (check-acceptance --mode=static), настоящие 301 и 404, SPA не сломан,
// повторная выкладка не дублирует блок в корневом .htaccess.
//
//   node tests/e2e/run-apache-e2e.mjs        (нужен apache2: apt-get install apache2)
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFakeWp } from "./fake-wpgraphql.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WP_PORT = 4012;
const PORT = 8095;
const BASE = `http://localhost:${PORT}`;
const TOKEN = "editor:apache e2e";
const APACHE = ["/usr/sbin/apache2", "/usr/sbin/httpd"].find((p) => fs.existsSync(p));
const MODULES = ["/usr/lib/apache2/modules", "/usr/lib64/httpd/modules", "/usr/libexec/apache2"].find((p) => fs.existsSync(p));
if (!APACHE || !MODULES) {
  console.error("apache2 не найден (apt-get install apache2)");
  process.exit(1);
}

let failed = 0;
const ok = (cond, msg, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${msg}${cond ? "" : ` — ${extra}`}`);
  if (!cond) failed++;
};
const get = async (p) => {
  const r = await fetch(BASE + p, { redirect: "manual" });
  return { status: r.status, location: r.headers.get("location"), body: await r.text(), headers: r.headers };
};
const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", cwd: ROOT, ...opts });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")}: код ${code}`))));
  });

const wp = createFakeWp({ token: TOKEN, port: WP_PORT });
for (let i = 0; i < 13; i++) {
  wp.addPost({
    title: `Статья для проверки Apache ${i + 1}`,
    slug: i === 4 ? encodeURIComponent("медь-или-оптика") : `statya-${i + 1}`,
    sub: i % 3 === 0,
    oldSlugs: i === 1 ? ["staryj-adres-pdu"] : [],
  });
}
await wp.listen();

const work = fs.mkdtempSync(path.join(os.tmpdir(), "unitr-apache-"));
const docroot = path.join(work, "www");
let apache;
try {
  console.log("Сборка (STATIC_EXPORT=1, EXPORT_TARGET=apache, CONTENT_SOURCE=graphql)…");
  fs.rmSync(path.join(ROOT, ".next"), { recursive: true, force: true });
  await run("npm", ["run", "build:pages"], {
    env: {
      ...process.env,
      STATIC_EXPORT: "1",
      EXPORT_TARGET: "apache",
      ASSET_PREFIX: "/articles/_media",
      BASE_PATH: "",
      CONTENT_SOURCE: "graphql",
      WP_GRAPHQL_URL: `http://127.0.0.1:${WP_PORT}/graphql`,
      WP_GRAPHQL_TOKEN: TOKEN,
      WP_GRAPHQL_AUTH: "basic",
      SITE_URL: BASE,
      SITE_STATIC_PAGES: JSON.stringify([{ path: "/", lastmod: "2026-10-01" }, { path: "/catalog/", lastmod: "2026-10-01" }]),
      ROBOTS_EXTRA: "Disallow: /search\\nDisallow: /articles/секретное",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });

  // «существующий сайт»: SPA с fallback на index.html для любых адресов (из-за него сейчас /articles/… отдаёт 200)
  fs.mkdirSync(docroot, { recursive: true });
  fs.writeFileSync(
    path.join(docroot, "index.html"),
    '<!doctype html><html><head><title>Юнит-Ресурс — главная</title><meta name="description" content="Главная страница unitr.ru"></head><body><div id="root"></div></body></html>',
  );
  fs.writeFileSync(path.join(docroot, "robots.txt"), "User-agent: *\nDisallow: /articles/\n");
  const spaHt = "RewriteEngine On\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule . /index.html [L]\n";
  fs.writeFileSync(path.join(docroot, ".htaccess"), spaHt);

  // выкладка — так же, как scripts/deploy-static.sh: файлы раздела + блок в корневой .htaccess (дважды — проверка идемпотентности)
  const outApache = path.join(ROOT, "out-apache");
  for (const e of fs.readdirSync(outApache)) {
    if (e !== "unitr-articles.htaccess") fs.cpSync(path.join(outApache, e), path.join(docroot, e), { recursive: true });
  }
  for (let i = 0; i < 2; i++) {
    await run("node", ["scripts/merge-htaccess.mjs", path.join(docroot, ".htaccess"), path.join(outApache, "unitr-articles.htaccess"), path.join(docroot, ".htaccess")]);
  }
  const rootHt = fs.readFileSync(path.join(docroot, ".htaccess"), "utf8");
  ok((rootHt.match(/# BEGIN unitr-articles/g) || []).length === 1 && rootHt.includes(spaHt), "Корневой .htaccess: один блок раздела, правила SPA сохранены");

  const conf = path.join(work, "httpd.conf");
  fs.writeFileSync(
    conf,
    [
      `ServerRoot "${work}"`,
      `Listen 127.0.0.1:${PORT}`,
      `PidFile "${work}/httpd.pid"`,
      `ErrorLog "${work}/error.log"`,
      "LogLevel warn",
      ...["mpm_event", "authz_core", "dir", "mime", "rewrite", "headers", "alias"].map((m) => `LoadModule ${m}_module "${MODULES}/mod_${m}.so"`),
      "TypesConfig /etc/mime.types",
      "ServerName localhost",
      `DocumentRoot "${docroot}"`,
      `<Directory "${docroot}">`,
      "  AllowOverride All",
      "  Require all granted",
      "</Directory>",
      "DirectoryIndex index.html",
      "",
    ].join("\n"),
  );
  apache = spawn(APACHE, ["-f", conf, "-DFOREGROUND"], { stdio: "inherit" });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(BASE + "/");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log("\nКритерии приёмки (check-acceptance --mode=static):");
  try {
    await run("node", ["scripts/check-acceptance.mjs", BASE, "--mode=static", "--report=docs/acceptance-static.md"], {
      env: { ...process.env, SECRET_VALUES: TOKEN },
    });
    ok(true, "check-acceptance --mode=static");
  } catch (e) {
    ok(false, "check-acceptance --mode=static", e.message);
  }

  console.log("\nДополнительно:");
  const home = await get("/");
  ok(home.status === 200 && /Юнит-Ресурс — главная/.test(home.body), "Главная по-прежнему отдаётся существующим сайтом (SPA)");
  const spa = await get("/catalog/shkafy/");
  ok(spa.status === 200 && /id="root"/.test(spa.body), "Адреса SPA вне раздела работают как раньше", `HTTP ${spa.status}`);
  const old = await get("/articles/staryj-adres-pdu/");
  ok(old.status === 301 && old.location === `${BASE}/articles/statya-2/`, "Прежний адрес статьи → 301 на актуальный", `${old.status} ${old.location}`);
  const oldBlog = await get("/blog/staryj-adres-pdu");
  ok(oldBlog.status === 301 && oldBlog.location === `${BASE}/articles/statya-2/`, "/blog/<прежний адрес> → 301 сразу на актуальный", `${oldBlog.status} ${oldBlog.location}`);
  const cyr = await get("/articles/med-ili-optika/");
  ok(cyr.status === 200, "Кириллический slug WordPress → латинский ЧПУ /articles/med-ili-optika/", `HTTP ${cyr.status}`);
  const noSlash = await get("/articles/statya-3");
  ok(noSlash.status === 301 && noSlash.location === `${BASE}/articles/statya-3/`, "Адрес статьи без слеша → 301", `${noSlash.status} ${noSlash.location}`);
  const deep = await get("/articles/statya-3/lishnee/");
  ok(deep.status === 404, "Лишний сегмент внутри раздела → 404", `HTTP ${deep.status}`);
  const placeholder = await get("/articles/category/_/");
  ok(placeholder.status === 404, "Служебные адреса-заглушки экспорта не опубликованы", `HTTP ${placeholder.status}`);
  const asset = await get("/articles/_media/og-default.jpg");
  ok(asset.status === 200, "Файлы раздела отдаются из /articles/_media/", `HTTP ${asset.status}`);
  const robots = (await get("/robots.txt")).body;
  ok(/Disallow: \/search/.test(robots) && !/Disallow: \/articles/.test(robots), "robots.txt: правила сайта из ROBOTS_EXTRA перенесены, запреты раздела отброшены", robots);
  const chunk = /src="(\/articles\/_media\/_next\/static\/[^"]+\.js)"/.exec((await get("/articles/")).body)?.[1];
  const js = chunk ? await get(chunk) : null;
  ok(js?.status === 200 && /immutable/.test(js.headers.get("cache-control") || ""), "Статика раздела: 200 и долгий кеш (immutable)", `${js?.status} ${js?.headers.get("cache-control")}`);
  ok(wp.state.unauthorized === 0 && wp.state.requests > 0, `Все ${wp.state.requests} запросов к WordPress — при сборке и с токеном`);
} finally {
  apache?.kill("SIGTERM");
  await wp.close();
  const log = path.join(work, "error.log");
  if (failed && fs.existsSync(log)) console.log("\nerror.log Apache:\n" + fs.readFileSync(log, "utf8").slice(-3000));
}
console.log(failed ? `\n❌ Не пройдено: ${failed}` : "\n✅ Сквозной тест Apache пройден");
process.exit(failed ? 1 : 0);
