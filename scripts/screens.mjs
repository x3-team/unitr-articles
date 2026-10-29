#!/usr/bin/env node
// Скриншоты и размеры вёрстки страниц раздела (отладка вёрстки на стенде и бою).
//   node scripts/screens.mjs <out-dir> <URL>...   BASIC_AUTH=логин:пароль — для адресов test.*
// В <out-dir>: PNG (1440 и 390 px) и layout.json — ширины контейнера, колонок, текста и блоков текста статьи.
// HEADER=1 — вместо этого шапка: размеры и стили логотипа, пунктов меню, телефона и кнопки, разметка логотипа
// (сравнение шапки раздела с шапкой SPA unitr.ru).
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

// шапка страницы (раздела или SPA): выполняется в браузере
function measureHeader() {
  const r2 = (n) => Math.round(n * 10) / 10;
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r2(r.x), y: r2(r.y), w: r2(r.width), h: r2(r.height) };
  };
  const st = (el, keys) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return Object.fromEntries(keys.map((k) => [k, cs[k]]));
  };
  const header = document.querySelector("header") || document.body.firstElementChild;
  const visible = (el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
  const logoLink =
    [...header.querySelectorAll("a")].find((a) => visible(a) && /^(\/|https?:\/\/[^/]+\/?)$/.test(a.getAttribute("href") || "") && a.querySelector("img,svg")) ||
    [...header.querySelectorAll("a")].find((a) => visible(a) && a.querySelector("img,svg"));
  const media = logoLink ? [...logoLink.querySelectorAll("img,svg")].filter(visible) : [];
  const links = [...header.querySelectorAll("a, button")]
    .filter((el) => visible(el) && (el.textContent || "").trim())
    .slice(0, 12)
    .map((el) => ({
      text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 40),
      ...box(el),
      ...st(el, ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "color", "backgroundColor", "paddingLeft", "paddingTop", "borderRadius"]),
    }));
  return {
    viewport: innerWidth,
    header: { ...box(header), ...st(header, ["backgroundColor", "borderBottom", "boxShadow", "position"]) },
    headerInner: [...header.children].filter(visible).map((c) => ({ tag: c.tagName.toLowerCase(), cls: String(c.className).slice(0, 60), ...box(c), ...st(c, ["paddingLeft", "paddingRight", "maxWidth"]) })),
    logoLink: logoLink ? { href: logoLink.getAttribute("href"), ...box(logoLink) } : null,
    logo: media.map((m) => ({
      tag: m.tagName.toLowerCase(),
      ...box(m),
      src: m.getAttribute("src"),
      currentSrc: m.currentSrc || null,
      natural: m.naturalWidth ? `${m.naturalWidth}x${m.naturalHeight}` : null,
      viewBox: m.getAttribute("viewBox"),
      outerHTML: m.tagName.toLowerCase() === "svg" ? m.outerHTML.slice(0, 12000) : m.outerHTML.slice(0, 600),
    })),
    links,
    bodyFont: getComputedStyle(document.body).fontFamily,
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
    report[url][label] = await page.evaluate(process.env.HEADER ? measureHeader : measure);
    await page.screenshot({ path: path.join(out, `${name}_${label}.png`), ...(process.env.HEADER ? { clip: { x: 0, y: 0, width: viewport.width, height: 160 } } : { fullPage: true }) });
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(out, "layout.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
