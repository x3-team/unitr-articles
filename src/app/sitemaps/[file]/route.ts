import { renderUrlset } from "@/lib/sitemap";
import { getSitemapSections } from "@/lib/sitemap-data";

/** Секции карты сайта /sitemaps/N.xml (используются, когда /sitemap.xml превращается в sitemap index) */
export const dynamic = "force-static";
export const revalidate = 300;

export async function generateStaticParams() {
  const sections = await getSitemapSections();
  return sections.map((_, i) => ({ file: `${i + 1}.xml` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const m = /^(\d+)\.xml$/.exec((await params).file);
  const sections = await getSitemapSections();
  const section = m ? sections[Number(m[1]) - 1] : undefined;
  if (!section) return new Response("Not Found", { status: 404 });
  return new Response(renderUrlset(section), {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
