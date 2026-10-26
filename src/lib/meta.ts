import type { Metadata } from "next";
import { SITE_LOCALE, SITE_NAME } from "./config";
import { absoluteUrl } from "./paths";

/** Общие метатеги: canonical на саму страницу, Open Graph, явное разрешение индексации */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: { url: string; width: number; height: number; alt: string } | null;
  article?: { publishedTime: string; modifiedTime: string; authors: string[]; section: string };
}): Metadata {
  const url = absoluteUrl(opts.path);
  const image = opts.image || { url: absoluteUrl("/og-default.jpg"), width: 1200, height: 630, alt: SITE_NAME };
  return {
    title: { absolute: opts.title },
    description: opts.description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: opts.type || "website",
      url,
      title: opts.title,
      description: opts.description,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      images: [image],
      ...(opts.article
        ? {
            publishedTime: opts.article.publishedTime,
            modifiedTime: opts.article.modifiedTime,
            authors: opts.article.authors,
            section: opts.article.section,
          }
        : {}),
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, images: [image.url] },
  };
}
