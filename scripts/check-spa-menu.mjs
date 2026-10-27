#!/usr/bin/env node
// Пункт «Статьи» в шапке страниц SPA unitr.ru (ТЗ, п. 2): проверка в настоящем браузере (Playwright, Chromium).
//
//   node scripts/check-spa-menu.mjs <BASE_URL> [--inspect] [--report=файл.md]
//
//   Проверяется: ссылка /articles/ в исходном HTML главной (без JS); в шапке на десктопе — «Статьи» видна и стоит
//   после «Каталог» и «Конфигураторы»; в мобильном меню — видна после открытия меню; переход по ссылке открывает
//   раздел (HTTP 200, H1 «Статьи»); то же на других страницах SPA и после перехода внутри SPA без перезагрузки.
//   --inspect — дополнительно вывести упрощённую структуру шапки (теги, классы, тексты) для отладки.
//   BASIC_AUTH=логин:пароль — для тестового стенда.
//
// Нужен пакет playwright и Chromium: npm i --no-save playwright && npx playwright install --with-deps chromium
import fs from "node:fs";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) || "http://localhost:8080").replace(/\/+$/, "");
const INSPECT = args.includes("--inspect");
const REPORT = (args.find((a) => a.startsWith("--report=")) || "").slice(9);
const [user, ...pass] = (process.env.BASIC_AUTH || "").split(":");
const httpCredentials = process.env.BASIC_AUTH ? { username: user, password: pass.join(":") } : undefined;
const AUTH = process.env.BASIC_AUTH ? { Authorization: `Basic ${Buffer.from(process.env.BASIC_AUTH).toString("base64")}` } : {};

const results = [];
const check = (name, ok, details = "") => results.push({ name, ok: !!ok, details: String(details) });

// упрощённое дерево элементов: теги, классы, href и короткие тексты (без атрибутов данных и скриптов); выполняется в браузере
function dump({ selector, limit, max }) {
  const outline = (el, depth) => {
    if (!el || depth > max) return "";
    const cls = typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
    const href = el.getAttribute("href") ? ` href=${el.getAttribute("href")}` : "";
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").slice(0, 40);
    const vis = el.getClientRects().length ? "" : " [скрыт]";
    let s = `${"  ".repeat(depth)}<${el.tagName.toLowerCase()}${cls}${href}>${own ? ` «${own}»` : ""}${vis}\n`;
    for (const c of el.children) if (!["SCRIPT", "STYLE", "SVG", "svg", "PATH", "path"].includes(c.tagName)) s += outline(c, depth + 1);
    return s;
  };
  return [...document.querySelectorAll(selector)].slice(0, limit).map((e) => outline(e, 0)).join("---\n");
}

// пункты меню в порядке документа: видимые ссылки/кнопки с текстом «Каталог», «Конфигураторы», «Статьи»
async function menuState(page) {
  return page.evaluate(() => {
    const want = ["Каталог", "Конфигураторы", "Статьи"];
    const items = [...document.querySelectorAll("a, button")]
      .filter((el) => want.includes((el.textContent || "").trim()) && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")
      .map((el) => ({ text: el.textContent.trim(), href: el.getAttribute("href"), top: Math.round(el.getBoundingClientRect().top) }));
    return items;
  });
}

async function openMobileMenu(page) {
  // кнопка меню: aria-label / класс со словами menu, burger, hamburger, toggle (первая видимая)
  const btn = page.locator(
    'header button, header [role="button"], [class*="burger" i], [class*="hamburger" i], [aria-label*="меню" i], [aria-label*="menu" i]',
  );
  const n = await btn.count();
  for (let i = 0; i < n; i++) {
    const b = btn.nth(i);
    if (!(await b.isVisible())) continue;
    const label = `${(await b.getAttribute("aria-label")) || ""} ${(await b.getAttribute("class")) || ""}`;
    if (!/menu|меню|burger|hamburger|toggle/i.test(label) && n > 1) continue;
    await b.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

async function main() {
  // 1. исходный HTML главной (как у поискового робота, без JS)
  const raw = await fetch(`${BASE}/`, { headers: { ...AUTH } });
  const html = await raw.text();
  check("Главная: ссылка /articles/ «Статьи» в исходном HTML (без JS)", /<a [^>]*href="(https?:\/\/[^/"]+)?\/articles\/"[^>]*>\s*Статьи\s*</.test(html), `HTTP ${raw.status}`);

  const browser = await chromium.launch();
  try {
    // 2. десктоп
    const desk = await browser.newContext({ httpCredentials, viewport: { width: 1440, height: 900 } });
    const page = await desk.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    if (INSPECT) {
      console.log("== Шапка главной (десктоп)\n" + (await page.evaluate(dump, { selector: "header, body > div > nav, #root > div > nav", limit: 2, max: 9 })));
    }
    const pages = await page.evaluate((base) => {
      const out = new Set();
      for (const a of document.querySelectorAll("a[href]")) {
        const u = new URL(a.href, base);
        if (u.origin === new URL(base).origin && !u.pathname.startsWith("/articles") && u.pathname !== "/" && !/\.\w+$/.test(u.pathname)) out.add(u.pathname);
      }
      return [...out].slice(0, 3);
    }, BASE);

    for (const path of ["/", ...pages]) {
      if (path !== "/") await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      const items = await menuState(page);
      const order = items.map((i) => i.text);
      const iA = order.indexOf("Статьи");
      const ok = iA > -1 && order.indexOf("Конфигураторы") > -1 && order.indexOf("Каталог") > -1 && order.indexOf("Конфигураторы") < iA && order.indexOf("Каталог") < iA && /\/articles\/$/.test(items[iA].href || "");
      check(`Десктоп ${path}: «Статьи» видна после «Каталог» и «Конфигураторы»`, ok, order.join(" · ") || "пунктов не найдено");
    }

    // 3. переход внутри SPA без перезагрузки — пункт не пропадает после перерисовки шапки
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const inner = page.locator("header a[href]:not([href^='http']):not([href*='/articles'])").filter({ hasNotText: /^$/ });
    if ((await inner.count()) > 1) {
      await inner.nth(1).click();
      await page.waitForTimeout(800);
      const order = (await menuState(page)).map((i) => i.text);
      check(`Десктоп: после перехода внутри SPA (${new URL(page.url()).pathname}) пункт на месте`, order.includes("Статьи"), order.join(" · "));
    }

    // 4. переход по ссылке «Статьи»
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const link = page.locator('a[href$="/articles/"]', { hasText: "Статьи" }).first();
    const [resp] = await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => null), link.click()]);
    const h1 = await page.locator("h1").first().textContent().catch(() => "");
    check("Клик по «Статьи» на главной → /articles/ (200, H1 «Статьи»)", new URL(page.url()).pathname === "/articles/" && resp?.status() === 200 && h1?.trim() === "Статьи", `${page.url()} HTTP ${resp?.status()} H1 «${h1?.trim()}»`);
    await desk.close();

    // 5. мобильное меню
    const mob = await browser.newContext({ httpCredentials, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mp = await mob.newPage();
    await mp.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const opened = await openMobileMenu(mp);
    if (INSPECT) {
      console.log(`== Мобильная шапка (меню открыто: ${opened})\n` + (await mp.evaluate(dump, { selector: "header, nav, [class*=menu i], [role=dialog]", limit: 5, max: 7 })));
    }
    const mItems = (await menuState(mp)).map((i) => i.text);
    check("Мобильное меню главной: «Статьи» видна после открытия меню", opened && mItems.includes("Статьи") && mItems.lastIndexOf("Конфигураторы") < mItems.lastIndexOf("Статьи"), `меню открыто: ${opened}; ${mItems.join(" · ") || "пунктов не найдено"}`);
    await mob.close();
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  const md = [`# Пункт «Статьи» в меню SPA — ${BASE}`, "", "| | Проверка | Детали |", "|---|---|---|", ...results.map((r) => `| ${r.ok ? "✅" : "❌"} | ${r.name} | ${r.details.replace(/\|/g, "\\|")} |`)].join("\n");
  if (REPORT) fs.writeFileSync(REPORT, md + "\n");
  for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.details ? ` — ${r.details}` : ""}`);
  console.log(`\nИтого: ${results.length - failed.length}/${results.length} пройдено`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
