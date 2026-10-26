import Link from "next/link";
import type { ArticleSummary, Paginated, Rubric } from "@/lib/content/types";
import { ARTICLES_CATEGORY } from "@/lib/config";
import { absoluteUrl, ARTICLES_PATH, rubricPath } from "@/lib/paths";
import { breadcrumbLd, collectionLd, jsonLd, type Crumb } from "@/lib/seo";
import { ArticleCard } from "./ArticleCard";
import { Breadcrumbs } from "./Breadcrumbs";
import { Pagination } from "./Pagination";
import { Shell } from "./Shell";

interface Props {
  data: Paginated<ArticleSummary>;
  crumbs: Crumb[];
  path: string;
  heading: string;
  subheading?: string;
  lead: string;
  description: string;
  rubrics: Rubric[];
  activeRubric?: string;
  pageHref: (n: number) => string;
}

export function ArchiveView({ data, crumbs, path, heading, subheading, lead, description, rubrics, activeRubric, pageHref }: Props) {
  const sub = rubrics.filter((r) => r.slug !== ARTICLES_CATEGORY);
  return (
    <Shell active="articles">
      {/* rel=prev/next — React 19 переносит <link> в <head> серверного HTML */}
      {data.page > 1 && <link rel="prev" href={absoluteUrl(pageHref(data.page - 1))} />}
      {data.page < data.totalPages && <link rel="next" href={absoluteUrl(pageHref(data.page + 1))} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd(crumbs))} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          collectionLd({
            path,
            name: subheading ? `${heading} — ${subheading}` : heading,
            description,
            items: data.items,
            offset: (data.page - 1) * data.perPage,
          }),
        )}
      />
      <section className="hero">
        <div className="container">
          <Breadcrumbs items={crumbs} />
          <h1 className="hero__title">{heading}</h1>
          {subheading && <p className="hero__sub">{subheading}</p>}
          <p className="hero__lead">{lead}</p>
          {sub.length > 0 && (
            <ul className="rubrics" aria-label="Рубрики">
              <li>
                <Link href={ARTICLES_PATH} className={`chip${!activeRubric ? " is-active" : ""}`}>
                  Все статьи
                </Link>
              </li>
              {sub.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={rubricPath(r.slug)}
                    className={`chip${activeRubric === r.slug ? " is-active" : ""}`}
                    aria-current={activeRubric === r.slug ? "page" : undefined}
                  >
                    {r.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section className="container archive" aria-label="Список статей">
        <div className="grid">
          {data.items.map((a, i) => (
            <ArticleCard key={a.id} article={a} eager={i < 4} />
          ))}
        </div>
        <Pagination page={data.page} totalPages={data.totalPages} href={pageHref} />
        <p className="archive__count">
          Показано {data.items.length} из {data.total} · страница {data.page} из {data.totalPages}
        </p>
      </section>
    </Shell>
  );
}
