import { notFound } from "next/navigation";
import { ArchiveView } from "@/components/ArchiveView";
import { getArchivePage, getRubrics } from "@/lib/content";
import { archiveImage, pageMetadata } from "@/lib/meta";
import { ARTICLES_PATH, archivePath } from "@/lib/paths";
import { ARTICLES_CRUMB, HOME_CRUMB } from "@/lib/seo";
import { ARCHIVE_DESCRIPTION, ARCHIVE_LEAD, ARCHIVE_TITLE } from "@/lib/archive-copy";

/** ISR: HTML перегенерируется каждые 5 минут (с учётом кеша данных — не позже 10 минут, ≤ 15 по ТЗ) и сразу — по вебхуку */
export const revalidate = 300;

export async function generateMetadata() {
  const data = await getArchivePage(1);
  return pageMetadata({ title: ARCHIVE_TITLE, description: ARCHIVE_DESCRIPTION, path: ARTICLES_PATH, image: archiveImage(data?.items) });
}

export default async function ArticlesPage() {
  const [data, rubrics] = await Promise.all([getArchivePage(1), getRubrics()]);
  if (!data) notFound();
  return (
    <ArchiveView
      data={data}
      crumbs={[HOME_CRUMB, ARTICLES_CRUMB]}
      path={ARTICLES_PATH}
      heading="Статьи"
      lead={ARCHIVE_LEAD}
      description={ARCHIVE_DESCRIPTION}
      rubrics={rubrics}
      pageHref={archivePath}
    />
  );
}
