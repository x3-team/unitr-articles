import "server-only";
import { ARTICLES_CATEGORY, SITE_NAME } from "../config";
import type { Article, ContentSource, Rubric, SitePage } from "./types";
import { cleanContentHtml, decodeEntities, stripTags } from "./wp-text";

/**
 * Источник данных — WordPress (manage.unitr.ru) через WPGraphQL.
 *
 * Безопасность (ТЗ, задача 5): запрос выполняется только на сервере Next.js (BFF).
 * URL и токен читаются из переменных окружения без префикса NEXT_PUBLIC_, поэтому
 * не попадают в клиентский JS; модуль помечен `server-only` — импорт из клиентского
 * компонента приведёт к ошибке сборки.
 *
 * Поля unitrSeo / unitrOldSlugs / unitrArticlesSettings добавляет WP-плагин из каталога wp/.
 * Если плагин ещё не установлен, используется базовый запрос без них (с теми же данными, кроме SEO-полей).
 */

const ENDPOINT = process.env.WP_GRAPHQL_URL || "https://manage.unitr.ru/graphql";
const TOKEN = process.env.WP_GRAPHQL_TOKEN || "";
const AUTH = (process.env.WP_GRAPHQL_AUTH || "basic").toLowerCase();

function authHeader(): Record<string, string> {
  if (!TOKEN) return {};
  if (AUTH === "bearer") return { Authorization: `Bearer ${TOKEN}` };
  // Application Password: "user:xxxx xxxx xxxx"
  return { Authorization: `Basic ${Buffer.from(TOKEN).toString("base64")}` };
}

export class GraphQLError extends Error {}

export async function wpQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  // shared-хостинг WordPress иногда не отвечает или отвечает 5xx/429 — до 4 попыток с паузой
  let res: Response | undefined;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeader() },
        body: JSON.stringify({ query, variables }),
        // кешированием управляет слой content/index.ts (unstable_cache с TTL ≤ 15 мин и тегом для вебхука)
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok || (res.status < 500 && res.status !== 429) || attempt >= 4) break;
    } catch (e) {
      if (attempt >= 4) throw e;
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  if (!res.ok) throw new GraphQLError(`WPGraphQL HTTP ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new GraphQLError(json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new GraphQLError("WPGraphQL: пустой ответ");
  return json.data;
}

const POST_FIELDS = `
  id
  databaseId
  slug
  title
  excerpt
  content
  dateGmt
  modifiedGmt
  author { node { name } }
  featuredImage { node { sourceUrl altText mediaDetails { width height } } }
  categories { nodes { slug name } }
`;
const PLUGIN_FIELDS = `
  unitrSeo { title description }
  unitrOldSlugs
`;

const postsQuery = (withPlugin: boolean) => `
  query UnitrArticles($category: String!, $after: String) {
    posts(
      first: 100
      after: $after
      where: { categoryName: $category, status: PUBLISH, orderby: [{ field: DATE, order: DESC }] }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes { ${POST_FIELDS} ${withPlugin ? PLUGIN_FIELDS : ""} }
    }
  }
`;

interface WpPost {
  id: string;
  databaseId: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  dateGmt: string;
  modifiedGmt: string;
  author?: { node?: { name?: string } } | null;
  featuredImage?: {
    node?: { sourceUrl?: string; altText?: string; mediaDetails?: { width?: number; height?: number } };
  } | null;
  categories?: { nodes: { slug: string; name: string }[] } | null;
  unitrSeo?: { title?: string | null; description?: string | null } | null;
  unitrOldSlugs?: string[] | null;
}

const gmt = (s: string) => new Date(s.endsWith("Z") ? s : `${s}Z`).toISOString();

/**
 * Автор статьи. Служебные учётные записи WordPress (MainAdmin, admin, editor… — латиница без пробела
 * или со словом admin) не показываются: автором подписывается компания.
 */
export function authorOf(name: string | undefined | null): Article["author"] {
  const n = (name || "").trim();
  if (!n || /admin|root|wordpress/i.test(n) || /^[\w.@-]+$/.test(n)) return { name: SITE_NAME, organization: true };
  return { name: n };
}

export function mapPost(p: WpPost): Article {
  const img = p.featuredImage?.node;
  return {
    id: p.id,
    slug: decodeURIComponent(p.slug),
    title: decodeEntities(p.title || ""),
    excerpt: stripTags(p.excerpt || ""),
    date: gmt(p.dateGmt),
    modified: gmt(p.modifiedGmt || p.dateGmt),
    cover: img?.sourceUrl
      ? {
          url: img.sourceUrl,
          width: img.mediaDetails?.width || 1200,
          height: img.mediaDetails?.height || 630,
          alt: img.altText || decodeEntities(p.title || ""),
        }
      : null,
    contentHtml: cleanContentHtml(p.content || "", { title: decodeEntities(p.title || ""), coverUrl: img?.sourceUrl }),
    author: authorOf(p.author?.node?.name),
    seo: { title: p.unitrSeo?.title || "", description: p.unitrSeo?.description || "" },
    categories: p.categories?.nodes || [],
  };
}

let pluginAvailable = true;

async function fetchAllPosts(): Promise<WpPost[]> {
  const all: WpPost[] = [];
  let after: string | null = null;
  for (let guard = 0; guard < 200; guard++) {
    type R = { posts: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: WpPost[] } };
    let data: R;
    try {
      data = await wpQuery<R>(postsQuery(pluginAvailable), { category: ARTICLES_CATEGORY, after });
    } catch (e) {
      if (pluginAvailable && e instanceof GraphQLError && /unitr/i.test(e.message)) {
        console.warn("[articles] WP-плагин unitr-articles не найден, используется базовый запрос:", e.message);
        pluginAvailable = false;
        continue;
      }
      throw e;
    }
    all.push(...data.posts.nodes);
    if (!data.posts.pageInfo.hasNextPage) break;
    after = data.posts.pageInfo.endCursor;
  }
  return all;
}

export const graphqlSource: ContentSource = {
  async listArticles() {
    return (await fetchAllPosts()).map(mapPost);
  },

  async perPageSetting() {
    try {
      const d = await wpQuery<{ unitrArticlesSettings?: { perPage?: number } }>(
        `query { unitrArticlesSettings { perPage } }`,
      );
      return d.unitrArticlesSettings?.perPage || undefined;
    } catch {
      // без плагина — штатная настройка WordPress «На страницах блога отображать не более»
      try {
        const d = await wpQuery<{ allSettings?: { readingSettingsPostsPerPage?: number } }>(
          `query { allSettings { readingSettingsPostsPerPage } }`,
        );
        return d.allSettings?.readingSettingsPostsPerPage || undefined;
      } catch {
        return undefined;
      }
    }
  },

  async redirects() {
    const map: Record<string, string> = {};
    if (!pluginAvailable) return map;
    for (const p of await fetchAllPosts()) {
      for (const old of p.unitrOldSlugs || []) map[decodeURIComponent(old)] = decodeURIComponent(p.slug);
    }
    return map;
  },

  async sitePages() {
    const pages: SitePage[] = [];
    // Страницы WordPress (каталог и пр.), если они публикуются на основном сайте по тем же адресам.
    // SITE_PAGES_SOURCE=static — страницы сайта берутся только из SITE_STATIC_PAGES (исходная карта сайта SPA)
    if (process.env.SITE_PAGES_SOURCE !== "static") try {
      const d = await wpQuery<{ pages: { nodes: { uri: string; modifiedGmt: string }[] } }>(
        `query { pages(first: 500, where: { status: PUBLISH }) { nodes { uri modifiedGmt } } }`,
      );
      for (const n of d.pages.nodes) pages.push({ path: n.uri, lastmod: gmt(n.modifiedGmt) });
    } catch (e) {
      console.warn("[sitemap] не удалось получить страницы WordPress:", (e as Error).message);
    }
    // Разделы SPA, которых нет в WordPress: SITE_STATIC_PAGES='[{"path":"/","lastmod":"2026-10-01"}]'
    try {
      const extra = JSON.parse(process.env.SITE_STATIC_PAGES || "[]") as SitePage[];
      for (const p of extra) if (!pages.some((x) => x.path === p.path)) pages.push(p);
    } catch {
      console.warn("[sitemap] SITE_STATIC_PAGES: некорректный JSON");
    }
    if (!pages.some((p) => p.path === "/")) pages.unshift({ path: "/", lastmod: new Date().toISOString() });
    return pages;
  },

  async rubrics() {
    const d = await wpQuery<{
      category: { slug: string; name: string; children: { nodes: { slug: string; name: string }[] } } | null;
    }>(
      `query($slug: ID!) { category(id: $slug, idType: SLUG) { slug name children(first: 100) { nodes { slug name } } } }`,
      { slug: ARTICLES_CATEGORY },
    );
    if (!d.category) return [];
    const posts = (await fetchAllPosts()).map(mapPost);
    const all = [{ slug: d.category.slug, name: d.category.name }, ...d.category.children.nodes];
    return all.map((r): Rubric => ({
      slug: decodeURIComponent(r.slug),
      name: decodeEntities(r.name),
      lastmod: posts
        .filter((a) => a.categories.some((c) => c.slug === r.slug))
        .reduce((m, a) => (a.modified > m ? a.modified : m), "1970-01-01T00:00:00.000Z"),
    }));
  },
};
