import { absoluteUrl } from "@/lib/paths";
import { renderIndex, renderUrlset, SECTION_PATH, sectionLastmod } from "@/lib/sitemap";
import { getSitemapSections } from "@/lib/sitemap-data";

/**
 * /sitemap.xml (ТЗ, задача 4): генерируется из данных WordPress, обновляется не реже раза в 10 минут (два уровня кеша по 5 минут)
 * (и сразу по вебхуку публикации), HTTP 200, Content-Type: application/xml.
 * При превышении 50 000 адресов или 50 МБ отдаётся индекс (sitemapindex) со ссылками на /sitemaps/N.xml.
 */
export const dynamic = "force-static";
export const revalidate = 300;

export async function GET() {
  const sections = await getSitemapSections();
  const xml =
    sections.length === 1
      ? renderUrlset(sections[0])
      : renderIndex(sections.map((s, i) => ({ loc: absoluteUrl(SECTION_PATH(i + 1)), lastmod: sectionLastmod(s) })));
  return new Response(xml, { status: 200, headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
