import "server-only";
import { MOCK_ARTICLES, MOCK_RUBRICS, type MockArticle } from "@/content/mock/articles";
import { MOCK_SITE_PAGES } from "@/content/mock/site-pages";
import { absoluteUrl, MEDIA_PATH } from "../paths";
import { slugify } from "../slugify";
import { bodyToHtml } from "./body-html";
import type { Article, ContentSource, Rubric } from "./types";

function toArticle(m: MockArticle, index: number): Article {
  const rubric = MOCK_RUBRICS[m.rubric];
  return {
    id: `mock-${index + 1}`,
    slug: slugify(m.title),
    title: m.title,
    excerpt: m.excerpt,
    date: new Date(m.date).toISOString(),
    modified: new Date(m.modified || m.date).toISOString(),
    cover: {
      url: absoluteUrl(`${MEDIA_PATH}covers/${m.cover}.jpg`),
      width: 1200,
      height: 630,
      alt: m.title,
    },
    contentHtml: bodyToHtml(m.body),
    author: { name: m.author },
    seo: { title: m.seoTitle || "", description: m.seoDescription || "" },
    categories: [MOCK_RUBRICS.root, rubric].map((c) => ({ slug: c.slug, name: c.name })),
  };
}

const published = () =>
  MOCK_ARTICLES.map((m, i) => ({ m, a: toArticle(m, i) }))
    .filter(({ m }) => (m.status || "publish") === "publish")
    .sort((x, y) => y.a.date.localeCompare(x.a.date));

export const mockSource: ContentSource = {
  async listArticles() {
    return published().map(({ a }) => a);
  },
  async perPageSetting() {
    return undefined;
  },
  async redirects() {
    const map: Record<string, string> = {};
    for (const { m, a } of published()) for (const old of m.oldSlugs || []) map[old] = a.slug;
    return map;
  },
  async sitePages() {
    return MOCK_SITE_PAGES;
  },
  async rubrics() {
    const list = published();
    return Object.values(MOCK_RUBRICS).map((r): Rubric => {
      const inRubric = list.filter(({ a }) => a.categories.some((c) => c.slug === r.slug));
      return {
        slug: r.slug,
        name: r.name,
        lastmod: inRubric.reduce((max, { a }) => (a.modified > max ? a.modified : max), "1970-01-01T00:00:00.000Z"),
      };
    });
  },
};
