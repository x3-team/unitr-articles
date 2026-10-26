import Link from "next/link";
import type { ArticleSummary } from "@/lib/content/types";
import { dateParts, truncate } from "@/lib/format";
import { articlePath, imgSrc } from "@/lib/paths";

/** Анонс статьи по карточке «Новости предприятия» из макета + обложка (требование ТЗ, п. 1.1) */
export function ArticleCard({ article, eager = false }: { article: ArticleSummary; eager?: boolean }) {
  const d = dateParts(article.date);
  const href = articlePath(article.slug);
  return (
    <article className="card">
      <Link href={href} className="card__link">
        {article.cover && (
          <span className="card__cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc(article.cover.url)}
              alt={article.cover.alt}
              width={article.cover.width}
              height={article.cover.height}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
            />
          </span>
        )}
        <span className="card__body">
          <h2 className="card__title">{article.title}</h2>
          <span className="card__excerpt">{truncate(article.excerpt, 180)}</span>
        </span>
        <span className="card__date">
          <time dateTime={article.date}>
            <span className="card__day">{d.day}</span>
            <span className="card__my">
              {d.month}
              <br />
              {d.year}
            </span>
          </time>
        </span>
      </Link>
    </article>
  );
}
