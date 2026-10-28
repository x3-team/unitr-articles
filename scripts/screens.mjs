#!/usr/bin/env node
// Скриншоты и размеры вёрстки страниц раздела (отладка вёрстки на стенде и бою).
//   node scripts/screens.mjs <out-dir> <URL>...   BASIC_AUTH=логин:пароль — для адресов test.*
// В <out-dir>: PNG (1440 и 390 px) и layout.json — ширины контейнера, колонок, текста и блоков текста статьи.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [out, ...urls] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const [user, ...pass] = (process.env.BASIC_AUTH || "").split(":");

function measure() {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const q = (s) => document.querySelector(s);
  const prose = q(".prose");
  return {
    viewport: innerWidth,
    container: box(q(".post")?.closest(".container") || q("main .container")),
    post: box(q(".post")),
    gridColumns: q(".post") ? getComputedStyle(q(".post")).gridTemplateColumns : null,
    main: box(q(".post__main")),
    aside: box(q(".post__aside")),
    asideItems: document.querySelectorAll(".post__aside li").length,
    prose: box(prose),
    proseChildren: prose
      ? [...prose.children].slice(0, 40).map((c) => ({
          tag: c.tagName.toLowerCase(),
          cls: (c.className || "").toString().slice(0, 80),
          style: (c.getAttribute("style") || "").slice(0, 120),
          ...box(c),
        }))
      : [],
    cover: box(q(".post__cover img")),
    // стили и структура, пришедшие в тексте статьи из WordPress
    proseStyle: prose ? [...prose.querySelectorAll("style")].map((st) => st.textContent.slice(0, 6000)) : [],
    proseOutline: prose
      ? (function outline(el, d) {
          if (d > 4) return [];
          return [...el.children].slice(0, 25).flatMap((c) => [
            `${"  ".repeat(d)}<${c.tagName.toLowerCase()}${c.className ? "." + String(c.className).trim().split(/\s+/).join(".") : ""}> ${Math.round(c.getBoundingClientRect().width)}px «${(c.textContent || "").trim().slice(0, 40)}»`,
            ...outline(c, d + 1),
          ]);
        })(prose, 0)
      : [],
  };
}

const browser = await chromium.launch();
const report = {};
for (const url of urls) {
  const u = new URL(url);
  const httpCredentials = /^test\./.test(u.hostname) && process.env.BASIC_AUTH ? { username: user, password: pass.join(":") } : undefined;
  const name = `${u.hostname}${u.pathname}`.replace(/[^a-z0-9]+/gi, "_").replace(/_$/, "");
  report[url] = {};
  for (const [label, viewport] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
    if (process.env.ONLY_1440 && label !== "1440") continue;
    const ctx = await browser.newContext({ httpCredentials, viewport });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 45_000 });
    await page.waitForTimeout(800);
    report[url][label] = await page.evaluate(measure);
    await page.screenshot({ path: path.join(out, `${name}_${label}.png`), fullPage: true });
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(out, "layout.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
