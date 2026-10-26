import { getRedirects } from "@/lib/content";
import { ARTICLES_PATH, articlePath, LEGACY_PREFIXES } from "@/lib/paths";
import { getAllArticles } from "@/lib/content";

/**
 * Только для статического демо: список переадресаций, по которому scripts/postexport.mjs создаёт
 * HTML-страницы перехода (GitHub Pages не умеет отдавать 301). На боевом сервере те же правила
 * выполняет src/middleware.server.ts с HTTP 301.
 */
export const dynamic = "force-static";

export async function GET() {
  const [articles, oldSlugs] = await Promise.all([getAllArticles(), getRedirects()]);
  const rules: { from: string; to: string }[] = [];
  for (const prefix of LEGACY_PREFIXES) {
    rules.push({ from: `${prefix}/`, to: ARTICLES_PATH });
    for (const a of articles) rules.push({ from: `${prefix}/${a.slug}/`, to: articlePath(a.slug) });
    for (const [old, slug] of Object.entries(oldSlugs)) rules.push({ from: `${prefix}/${old}/`, to: articlePath(slug) });
  }
  for (const [old, slug] of Object.entries(oldSlugs)) rules.push({ from: articlePath(old), to: articlePath(slug) });
  return Response.json(rules);
}
