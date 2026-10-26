import "server-only";
import { ARTICLES_CATEGORY } from "./config";
import { getAllArticles, getPerPage, getRubrics, getSitePages } from "./content";
import { buildEntries, splitEntries } from "./sitemap";

export async function getSitemapSections() {
  const [articles, perPage, rubrics, sitePages] = await Promise.all([
    getAllArticles(),
    getPerPage(),
    getRubrics(),
    getSitePages(),
  ]);
  return splitEntries(buildEntries({ sitePages, articles, rubrics, perPage, rootRubricSlug: ARTICLES_CATEGORY }));
}
