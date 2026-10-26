import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEntries, renderIndex, renderUrlset, splitEntries } from "../src/lib/sitemap";
import type { Article } from "../src/lib/content/types";

const art = (i: number, cats = ["poleznye-stati"]): Article => ({
  id: String(i),
  slug: `statya-${i}`,
  title: `Статья ${i}`,
  excerpt: "",
  date: new Date(Date.UTC(2026, 0, i)).toISOString(),
  modified: new Date(Date.UTC(2026, 1, i)).toISOString(),
  cover: null,
  contentHtml: "",
  author: { name: "" },
  seo: { title: "", description: "" },
  categories: cats.map((slug) => ({ slug, name: slug })),
});

test("карта содержит главную, раздел, пагинацию, подрубрики и статьи с lastmod", () => {
  const articles = Array.from({ length: 23 }, (_, i) => art(23 - i, i % 2 ? ["poleznye-stati", "shkafy"] : ["poleznye-stati"]));
  const entries = buildEntries({
    sitePages: [{ path: "/", lastmod: "2026-01-01" }, { path: "/catalog/", lastmod: "2026-01-02" }],
    articles,
    rubrics: [
      { slug: "poleznye-stati", name: "", lastmod: "" },
      { slug: "shkafy", name: "", lastmod: "" },
    ],
    perPage: 10,
    rootRubricSlug: "poleznye-stati",
  });
  const locs = entries.map((e) => new URL(e.loc).pathname);
  for (const p of ["/", "/catalog/", "/articles/", "/articles/page/2/", "/articles/page/3/", "/articles/category/shkafy/", "/articles/category/shkafy/page/2/", "/articles/statya-1/"])
    assert.ok(locs.includes(p), p);
  assert.ok(!locs.includes("/articles/page/4/"));
  assert.equal(new Set(locs).size, locs.length, "без дублей");
  assert.ok(entries.every((e) => /^\d{4}-\d\d-\d\dT/.test(e.lastmod)));
  const xml = renderUrlset(entries);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  assert.equal((xml.match(/<lastmod>/g) || []).length, entries.length);
});

test("секционирование: > 50 000 адресов → несколько файлов и sitemap index", () => {
  const entries = Array.from({ length: 120_001 }, (_, i) => ({ loc: `https://unitr.ru/articles/s-${i}/`, lastmod: "2026-01-01T00:00:00.000Z" }));
  const sections = splitEntries(entries);
  assert.equal(sections.length, 3);
  assert.ok(sections.every((s) => s.length <= 50_000));
  assert.equal(sections.reduce((n, s) => n + s.length, 0), entries.length);
  const idx = renderIndex(sections.map((_, i) => ({ loc: `https://unitr.ru/sitemaps/${i + 1}.xml`, lastmod: "2026-01-01T00:00:00.000Z" })));
  assert.match(idx, /<sitemapindex/);
  assert.equal((idx.match(/<sitemap>/g) || []).length, 3);
});

test("секционирование по размеру: > 50 МБ", () => {
  const long = "x".repeat(2000);
  const entries = Array.from({ length: 30_000 }, (_, i) => ({ loc: `https://unitr.ru/articles/${long}-${i}/`, lastmod: "2026-01-01T00:00:00.000Z" }));
  const sections = splitEntries(entries);
  assert.ok(sections.length >= 2);
  for (const s of sections) assert.ok(Buffer.byteLength(renderUrlset(s)) <= 50 * 1024 * 1024);
});

test("экранирование XML", () => {
  assert.match(renderUrlset([{ loc: "https://unitr.ru/?a=1&b=2", lastmod: "2026-01-01T00:00:00.000Z" }]), /a=1&amp;b=2/);
});
