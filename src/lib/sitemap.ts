import { SITEMAP_MAX_BYTES, SITEMAP_MAX_URLS } from "./config";
import { absoluteUrl, archivePath, articlePath, rubricPath } from "./paths";
import type { Article, Rubric, SitePage } from "./content/types";

export interface SitemapEntry {
  loc: string;
  lastmod: string;
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const maxDate = (dates: string[], fallback: string) => dates.reduce((m, d) => (d > m ? d : m), fallback);

/**
 * Состав карты сайта (ТЗ, задача 4): главная и страницы каталога, раздел /articles/,
 * страницы пагинации, подрубрики, все статьи — каждая с <lastmod>.
 */
export function buildEntries(input: {
  sitePages: SitePage[];
  articles: Article[];
  rubrics: Rubric[];
  perPage: number;
  rootRubricSlug: string;
}): SitemapEntry[] {
  const { sitePages, articles, rubrics, perPage, rootRubricSlug } = input;
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();
  const push = (path: string, lastmod: string) => {
    const loc = absoluteUrl(path);
    if (seen.has(loc)) return;
    seen.add(loc);
    entries.push({ loc, lastmod: new Date(lastmod).toISOString() });
  };
  const epoch = "1970-01-01T00:00:00.000Z";

  for (const p of sitePages) push(p.path, p.lastmod);

  const pageLastmods = (list: Article[]) => {
    const out: string[] = [];
    for (let i = 0; i < Math.max(1, Math.ceil(list.length / perPage)); i++) {
      out.push(maxDate(list.slice(i * perPage, (i + 1) * perPage).map((a) => a.modified), epoch));
    }
    return out;
  };

  // раздел и пагинация: lastmod страницы — самое свежее изменение среди её анонсов
  const newest = maxDate(articles.map((a) => a.modified), epoch);
  pageLastmods(articles).forEach((lm, i) => push(archivePath(i + 1), i === 0 ? newest : lm));

  // подрубрики появляются в карте автоматически, как только в них опубликована статья
  for (const r of rubrics) {
    if (r.slug === rootRubricSlug) continue;
    const list = articles.filter((a) => a.categories.some((c) => c.slug === r.slug));
    if (!list.length) continue;
    pageLastmods(list).forEach((lm, i) => push(rubricPath(r.slug, i + 1), lm));
  }

  for (const a of articles) push(articlePath(a.slug), a.modified);
  return entries;
}

export function renderUrlset(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) => `  <url>\n    <loc>${xmlEscape(e.loc)}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function renderIndex(sections: { loc: string; lastmod: string }[]): string {
  const body = sections
    .map((s) => `  <sitemap>\n    <loc>${xmlEscape(s.loc)}</loc>\n    <lastmod>${s.lastmod}</lastmod>\n  </sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

/**
 * Секционирование: не более SITEMAP_MAX_URLS адресов и SITEMAP_MAX_BYTES байт в одном файле.
 * Возвращает массив секций; если секция одна — /sitemap.xml отдаётся как обычный urlset.
 */
export function splitEntries(
  entries: SitemapEntry[],
  maxUrls = SITEMAP_MAX_URLS,
  maxBytes = SITEMAP_MAX_BYTES,
): SitemapEntry[][] {
  const overhead = Buffer.byteLength(renderUrlset([]));
  const sections: SitemapEntry[][] = [];
  let cur: SitemapEntry[] = [];
  let bytes = overhead;
  for (const e of entries) {
    // +1 — перевод строки между записями
    const size = Buffer.byteLength(renderUrlset([e])) - overhead + 1;
    if (cur.length && (cur.length >= maxUrls || bytes + size > maxBytes)) {
      sections.push(cur);
      cur = [];
      bytes = overhead;
    }
    cur.push(e);
    bytes += size;
  }
  if (cur.length || !sections.length) sections.push(cur);
  return sections;
}

export const SECTION_PATH = (n: number) => `/sitemaps/${n}.xml`;

export function sectionLastmod(section: SitemapEntry[]) {
  return maxDate(section.map((e) => e.lastmod), "1970-01-01T00:00:00.000Z");
}
