// Тестовые статьи для рубрики poleznye-stati в WordPress (manage.unitr.ru) — из демо-контента раздела.
// Готовит out-demo/articles.json и обложки out-demo/covers/*.jpg; на хостинге их загружает
// deploy/hosting/wp-demo-content.php (workflow .github/workflows/wp-demo-content.yml).
//
//   node --import tsx scripts/wp-demo-export.ts [каталог] [число опубликованных]
//
// Одна статья — без заданного ярлыка: его строит плагин раздела из кириллического заголовка (проверка ЧПУ).
// Черновик (status: draft) не должен попасть на сайт и в sitemap.
import fs from "node:fs";
import path from "node:path";
import { MOCK_ARTICLES } from "../src/content/mock/articles";
import { bodyToHtml } from "../src/lib/content/body-html";
import { slugify } from "../src/lib/slugify";

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(" ", n - 1))}…`);

const OUT = process.argv[2] || "out-demo";
const COUNT = Number(process.argv[3] || 12);

const published = MOCK_ARTICLES.filter((m) => (m.status || "publish") === "publish").slice(0, COUNT);
const drafts = MOCK_ARTICLES.filter((m) => m.status === "draft");

const items = [...published, ...drafts].map((m, i) => ({
  key: slugify(m.title),
  title: m.title,
  // ярлык задаём явно (латиница из заголовка), кроме одной статьи — его транслитерирует плагин
  slug: i === 1 ? "" : slugify(m.title),
  status: m.status || "publish",
  date: m.date,
  modified: m.modified || m.date,
  excerpt: m.excerpt,
  content: bodyToHtml(m.body),
  // SEO-поля заполнены у всех тестовых статей (в демо-контенте — не у всех)
  seo_title: m.seoTitle || m.title.split(":")[0],
  seo_description: m.seoDescription || clip(m.excerpt, 160),
  cover: `${m.cover}.jpg`,
}));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "covers"), { recursive: true });
for (const c of new Set(items.map((i) => i.cover)))
  fs.copyFileSync(path.join("public/articles/_media/covers", c), path.join(OUT, "covers", c));
fs.writeFileSync(path.join(OUT, "articles.json"), JSON.stringify(items, null, 1));
console.log(`${OUT}/articles.json: опубликованных ${published.length}, черновиков ${drafts.length}`);
