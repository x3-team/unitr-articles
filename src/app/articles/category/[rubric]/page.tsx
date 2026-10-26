import { notFound } from "next/navigation";
import { ArchiveView } from "@/components/ArchiveView";
import { ARTICLES_CATEGORY } from "@/lib/config";
import { getArchivePage, getRubrics } from "@/lib/content";
import { pageMetadata } from "@/lib/meta";
import { rubricPath } from "@/lib/paths";
import { ARTICLES_CRUMB, HOME_CRUMB } from "@/lib/seo";
import { ARCHIVE_LEAD } from "@/lib/archive-copy";

/** Подрубрика раздела. Новые подрубрики WordPress появляются здесь и в sitemap.xml автоматически. */
export const revalidate = 300;

type Params = Promise<{ rubric: string }>;

export async function generateStaticParams() {
  return (await getRubrics()).filter((r) => r.slug !== ARTICLES_CATEGORY).map((r) => ({ rubric: r.slug }));
}

async function findRubric(slug: string) {
  return (await getRubrics()).find((r) => r.slug === slug && r.slug !== ARTICLES_CATEGORY) || null;
}

export async function generateMetadata({ params }: { params: Params }) {
  const r = await findRubric((await params).rubric);
  if (!r) return {};
  return pageMetadata({
    title: `${r.name} — статьи | Юнит-Ресурс`,
    description: `Статьи рубрики «${r.name}»: практические советы и разборы от инженеров Юнит-Ресурс.`,
    path: rubricPath(r.slug),
  });
}

export default async function RubricPage({ params }: { params: Params }) {
  const r = await findRubric((await params).rubric);
  if (!r) notFound();
  const [data, rubrics] = await Promise.all([getArchivePage(1, r.slug), getRubrics()]);
  if (!data) notFound();
  return (
    <ArchiveView
      data={data}
      crumbs={[HOME_CRUMB, ARTICLES_CRUMB, { name: r.name, path: rubricPath(r.slug) }]}
      path={rubricPath(r.slug)}
      heading={r.name}
      lead={ARCHIVE_LEAD}
      description={`Статьи рубрики «${r.name}»`}
      rubrics={rubrics}
      activeRubric={r.slug}
      pageHref={(n) => rubricPath(r.slug, n)}
    />
  );
}
