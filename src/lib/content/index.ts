import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAG, CONTENT_SOURCE, DEFAULT_PER_PAGE, ENV_PER_PAGE, REVALIDATE_SECONDS } from "../config";
import { isLatinSlug, latinSlug } from "../slugify";
import { graphqlSource } from "./graphql";
import { mockSource } from "./mock";
import type { Article, ArticleSummary, ContentSource, Paginated } from "./types";

export type { Article, ArticleSummary, Paginated, Rubric, SitePage } from "./types";

const source: ContentSource = CONTENT_SOURCE === "graphql" ? graphqlSource : mockSource;

/**
 * Кеш данных (ТЗ, задача 3): TTL = REVALIDATE_SECONDS (≤ 900 с) + мгновенный сброс по тегу
 * из вебхука WordPress (POST /api/revalidate). Публикация, правка и снятие статьи с публикации
 * отражаются в разделе и sitemap.xml без участия разработчиков не позже чем через 15 минут.
 */
const cached = <T>(key: string, fn: () => Promise<T>) =>
  unstable_cache(fn, ["unitr-articles", CONTENT_SOURCE, key], { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAG] });

/**
 * Все опубликованные статьи рубрики. Если в WordPress адрес записи остался кириллическим
 * (не установлен плагин раздела / Cyr-To-Lat), ЧПУ строится транслитерацией этого адреса (или заголовка).
 */
const loadArticles = cached("articles", async (): Promise<Article[]> => {
  const list = await source.listArticles();
  const seen = new Set<string>();
  return list.map((a) => {
    let slug = latinSlug(a.slug, a.title);
    if (seen.has(slug)) slug = `${slug}-${a.id.replace(/\W/g, "").slice(-6).toLowerCase()}`;
    seen.add(slug);
    return slug === a.slug ? a : { ...a, slug, wpSlug: a.slug };
  });
});

export async function getAllArticles(): Promise<Article[]> {
  return loadArticles();
}

/** Количество анонсов: переменная окружения → настройка в WordPress → 10 */
export const getPerPage = cached("per-page", async () => ENV_PER_PAGE ?? (await source.perPageSetting()) ?? DEFAULT_PER_PAGE);

export function summary(a: Article): ArticleSummary {
  const { id, slug, title, excerpt, date, modified, cover } = a;
  return { id, slug, title, excerpt, date, modified, cover };
}

export function paginate<T>(items: T[], page: number, perPage: number): Paginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return { items: items.slice((page - 1) * perPage, page * perPage), page, perPage, total, totalPages };
}

/** Страница архива. null — если номер страницы вне диапазона (→ 404). */
export async function getArchivePage(page: number, rubricSlug?: string): Promise<Paginated<ArticleSummary> | null> {
  if (!Number.isInteger(page) || page < 1) return null;
  const [all, perPage] = await Promise.all([getAllArticles(), getPerPage()]);
  const list = rubricSlug ? all.filter((a) => a.categories.some((c) => c.slug === rubricSlug)) : all;
  const result = paginate(list.map(summary), page, perPage);
  if (page > result.totalPages) return null;
  return result;
}

export async function getArticle(slug: string) {
  const all = await getAllArticles();
  const i = all.findIndex((a) => a.slug === slug);
  if (i < 0) return null;
  return {
    article: all[i],
    // список отсортирован от новых к старым: «предыдущая» — более ранняя, «следующая» — более новая
    prev: all[i + 1] ? summary(all[i + 1]) : null,
    next: all[i - 1] ? summary(all[i - 1]) : null,
  };
}

/** Карта 301-редиректов внутри раздела: прежний адрес статьи → актуальный */
export const getRedirects = cached("redirects", async () => {
  const map = await source.redirects();
  const articles = await getAllArticles();
  const exists = new Set(articles.map((a) => a.slug));
  const byWpSlug = new Map(articles.map((a) => [a.wpSlug ?? a.slug, a.slug]));
  const result: Record<string, string> = {};
  for (const [from, to] of Object.entries(map)) {
    const target = byWpSlug.get(to) ?? (isLatinSlug(to) ? to : "");
    if (target && exists.has(target) && !exists.has(from) && from !== target) result[from] = target;
  }
  return result;
});

export const getSitePages = cached("site-pages", () => source.sitePages());

/** Рубрика раздела и подрубрики, в которых есть опубликованные статьи */
export const getRubrics = cached("rubrics", async () => {
  const all = await source.rubrics();
  return all.filter((r) => r.lastmod > "1970-01-01T00:00:00.000Z");
});
