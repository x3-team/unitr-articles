import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Shell } from "@/components/Shell";
import { getAllArticles, getArticle } from "@/lib/content";
import { dateNumeric, truncate } from "@/lib/format";
import { pageMetadata } from "@/lib/meta";
import { ARTICLES_PATH, articlePath, imgSrc } from "@/lib/paths";
import { articleLd, ARTICLES_CRUMB, breadcrumbLd, HOME_CRUMB, jsonLd } from "@/lib/seo";

/** ISR (5 минут + 5 минут кеш данных ≤ 15 минут); новые статьи рендерятся на сервере при первом обращении (dynamicParams) */
export const revalidate = 300;

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return (await getAllArticles()).map((a) => ({ slug: a.slug }));
}

function seoOf(a: { title: string; excerpt: string; seo: { title: string; description: string } }) {
  return {
    // title/description — из полей WordPress, заполняемых Заказчиком; если пусто — из заголовка и анонса
    title: a.seo.title || `${a.title} | Юнит-Ресурс`,
    description: a.seo.description || truncate(a.excerpt, 160),
  };
}

export async function generateMetadata({ params }: { params: Params }) {
  const found = await getArticle((await params).slug);
  if (!found) return {};
  const a = found.article;
  const seo = seoOf(a);
  return pageMetadata({
    title: seo.title,
    description: seo.description,
    path: articlePath(a.slug),
    type: "article",
    image: a.cover,
    article: { publishedTime: a.date, modifiedTime: a.modified, authors: [a.author.name], section: "Статьи" },
  });
}

export default async function ArticlePage({ params }: { params: Params }) {
  const found = await getArticle((await params).slug);
  if (!found) notFound();
  const { article: a, prev, next } = found;
  const seo = seoOf(a);
  const crumbs = [HOME_CRUMB, ARTICLES_CRUMB, { name: a.title, path: articlePath(a.slug) }];
  const related = (await getAllArticles())
    .filter((x) => x.slug !== a.slug)
    .map((x) => ({ x, score: x.categories.filter((c) => a.categories.some((ac) => ac.slug === c.slug)).length }))
    .sort((p, q) => q.score - p.score || q.x.date.localeCompare(p.x.date))
    .slice(0, 3)
    .map(({ x }) => x);

  return (
    <Shell active="articles">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleLd(a, seo.description))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd(crumbs))} />
      <article>
        <header className="post-hero">
          <div className="container">
            <Breadcrumbs items={crumbs} />
            <Link href={ARTICLES_PATH} className="back">
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M12 5l-5 5 5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              К статьям
            </Link>
            <h1 className="post-hero__title">{a.title}</h1>
            <p className="post-hero__meta">
              <time dateTime={a.date}>{dateNumeric(a.date)}</time>
              {a.modified.slice(0, 10) !== a.date.slice(0, 10) && (
                <>
                  {" · обновлено "}
                  <time dateTime={a.modified}>{dateNumeric(a.modified)}</time>
                </>
              )}
              {" · "}
              <span>{a.author.name}</span>
            </p>
          </div>
        </header>
        <div className="container post">
          <div className="post__main">
            {a.cover && (
              <figure className="post__cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc(a.cover.url)} alt={a.cover.alt} width={a.cover.width} height={a.cover.height} fetchPriority="high" />
              </figure>
            )}
            <div className="prose" dangerouslySetInnerHTML={{ __html: a.contentHtml }} />
            <nav className="post-nav" aria-label="Другие статьи">
              {prev ? (
                <Link href={articlePath(prev.slug)} className="post-nav__item" rel="prev">
                  <span className="post-nav__label">← Предыдущая статья</span>
                  <span className="post-nav__title">{prev.title}</span>
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link href={articlePath(next.slug)} className="post-nav__item post-nav__item--next" rel="next">
                  <span className="post-nav__label">Следующая статья →</span>
                  <span className="post-nav__title">{next.title}</span>
                </Link>
              ) : (
                <span />
              )}
            </nav>
          </div>
          <aside className="post__aside" aria-label="Может быть интересно">
            <p className="aside__title">Может быть интересно</p>
            <ul>
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={articlePath(r.slug)} className="aside__item">
                    <span className="aside__item-title">{r.title}</span>
                    <span className="aside__item-excerpt">{truncate(r.excerpt, 110)}</span>
                    <time dateTime={r.date}>{dateNumeric(r.date)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </article>
    </Shell>
  );
}
