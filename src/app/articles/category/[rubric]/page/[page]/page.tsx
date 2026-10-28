import { notFound } from "next/navigation";
import { ArchiveView } from "@/components/ArchiveView";
import { ARTICLES_CATEGORY } from "@/lib/config";
import { getArchivePage, getRubrics } from "@/lib/content";
import { archiveImage, pageMetadata } from "@/lib/meta";
import { rubricPath } from "@/lib/paths";
import { ARTICLES_CRUMB, HOME_CRUMB } from "@/lib/seo";
import { ARCHIVE_LEAD } from "@/lib/archive-copy";
import { staticParams } from "@/lib/static-params";

export const revalidate = 300;

type Params = Promise<{ rubric: string; page: string }>;

const parsePage = (raw: string) => (/^[1-9]\d*$/.test(raw) && raw !== "1" ? Number(raw) : NaN);

export async function generateStaticParams() {
  const out: { rubric: string; page: string }[] = [];
  for (const r of (await getRubrics()).filter((x) => x.slug !== ARTICLES_CATEGORY)) {
    const first = await getArchivePage(1, r.slug);
    for (let p = 2; p <= (first?.totalPages ?? 1); p++) out.push({ rubric: r.slug, page: String(p) });
  }
  return staticParams(out, { rubric: "_", page: "1" });
}

async function findRubric(slug: string) {
  return (await getRubrics()).find((r) => r.slug === slug && r.slug !== ARTICLES_CATEGORY) || null;
}

export async function generateMetadata({ params }: { params: Params }) {
  const p = await params;
  const r = await findRubric(p.rubric);
  const page = parsePage(p.page);
  if (!r) return {};
  const data = Number.isNaN(page) ? null : await getArchivePage(page, r.slug);
  return pageMetadata({
    title: `${r.name} — статьи, страница ${page} | Юнит-Ресурс`,
    description: `Статьи рубрики «${r.name}». Страница ${page}.`,
    path: rubricPath(r.slug, page),
    image: archiveImage(data?.items),
  });
}

export default async function RubricPageN({ params }: { params: Params }) {
  const p = await params;
  const r = await findRubric(p.rubric);
  if (!r) notFound();
  const page = parsePage(p.page);
  const [data, rubrics] = await Promise.all([getArchivePage(page, r.slug), getRubrics()]);
  if (!data) notFound();
  return (
    <ArchiveView
      data={data}
      crumbs={[HOME_CRUMB, ARTICLES_CRUMB, { name: r.name, path: rubricPath(r.slug) }, { name: `Страница ${page}`, path: rubricPath(r.slug, page) }]}
      path={rubricPath(r.slug, page)}
      heading={r.name}
      subheading={`Страница ${page}`}
      lead={ARCHIVE_LEAD}
      description={`Статьи рубрики «${r.name}». Страница ${page}.`}
      rubrics={rubrics}
      activeRubric={r.slug}
      pageHref={(n) => rubricPath(r.slug, n)}
    />
  );
}
