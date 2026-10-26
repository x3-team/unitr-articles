import { ORGANIZATION, SITE_NAME } from "./config";
import { absoluteUrl, ARTICLES_PATH, articlePath, MEDIA_PATH } from "./paths";
import type { Article } from "./content/types";

export interface Crumb {
  name: string;
  path: string;
}

export const HOME_CRUMB: Crumb = { name: "Главная", path: "/" };
export const ARTICLES_CRUMB: Crumb = { name: "Статьи", path: ARTICLES_PATH };

export function breadcrumbLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

const publisher = () => ({
  "@type": "Organization",
  name: ORGANIZATION.name,
  alternateName: SITE_NAME,
  url: absoluteUrl("/"),
  logo: { "@type": "ImageObject", url: absoluteUrl(`${MEDIA_PATH}logo-unitr.png`), width: 512, height: 512 },
});

export function articleLd(a: Article, description: string) {
  const url = absoluteUrl(articlePath(a.slug));
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    headline: a.title.slice(0, 110),
    description,
    datePublished: a.date,
    dateModified: a.modified,
    author: { "@type": "Person", name: a.author.name },
    publisher: publisher(),
    ...(a.cover
      ? { image: { "@type": "ImageObject", url: a.cover.url, width: a.cover.width, height: a.cover.height } }
      : {}),
    articleSection: "Статьи",
    inLanguage: "ru-RU",
  };
}

export function collectionLd(opts: { path: string; name: string; description: string; items: { slug: string; title: string }[]; offset: number }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: absoluteUrl(opts.path),
    name: opts.name,
    description: opts.description,
    inLanguage: "ru-RU",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: opts.items.map((it, i) => ({
        "@type": "ListItem",
        position: opts.offset + i + 1,
        url: absoluteUrl(articlePath(it.slug)),
        name: it.title,
      })),
    },
  };
}

/** Безопасная вставка JSON-LD в <script> (экранируем «</» ) */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
