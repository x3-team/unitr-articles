import { notFound } from "next/navigation";
import { ArchiveView } from "@/components/ArchiveView";
import { getArchivePage, getRubrics } from "@/lib/content";
import { pageMetadata } from "@/lib/meta";
import { archivePath } from "@/lib/paths";
import { ARTICLES_CRUMB, HOME_CRUMB } from "@/lib/seo";
import { ARCHIVE_DESCRIPTION, ARCHIVE_LEAD } from "@/lib/archive-copy";
import { staticParams } from "@/lib/static-params";

export const revalidate = 300;

type Params = Promise<{ page: string }>;

/** Только «чистые» номера ≥ 2: /articles/page/1/ и /articles/page/02/ — 404 (на бою — 301 из middleware) */
function parsePage(raw: string) {
  return /^[1-9]\d*$/.test(raw) && raw !== "1" ? Number(raw) : NaN;
}

export async function generateStaticParams() {
  const first = await getArchivePage(1);
  const total = first?.totalPages ?? 1;
  return staticParams(Array.from({ length: Math.max(0, total - 1) }, (_, i) => ({ page: String(i + 2) })), { page: "1" });
}

export async function generateMetadata({ params }: { params: Params }) {
  const page = parsePage((await params).page);
  return pageMetadata({
    title: `Статьи — страница ${page} | Юнит-Ресурс`,
    description: `${ARCHIVE_DESCRIPTION} Страница ${page}.`,
    path: archivePath(page),
  });
}

export default async function ArticlesPageN({ params }: { params: Params }) {
  const page = parsePage((await params).page);
  const [data, rubrics] = await Promise.all([getArchivePage(page), getRubrics()]);
  if (!data) notFound();
  const path = archivePath(page);
  return (
    <ArchiveView
      data={data}
      crumbs={[HOME_CRUMB, ARTICLES_CRUMB, { name: `Страница ${page}`, path }]}
      path={path}
      heading="Статьи"
      subheading={`Страница ${page}`}
      lead={ARCHIVE_LEAD}
      description={ARCHIVE_DESCRIPTION}
      rubrics={rubrics}
      pageHref={archivePath}
    />
  );
}
