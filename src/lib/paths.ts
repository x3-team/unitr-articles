import { BASE_PATH, SITE_URL } from "./config";

/** Маршруты раздела. Единственное место, где описана схема адресов. */
export const ARTICLES_PATH = "/articles/";

export function archivePath(page = 1): string {
  return page <= 1 ? ARTICLES_PATH : `${ARTICLES_PATH}page/${page}/`;
}

export function articlePath(slug: string): string {
  return `${ARTICLES_PATH}${slug}/`;
}

/** Абсолютный адрес для canonical, Open Graph, Schema.org и sitemap.xml. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Путь к файлу из /public с учётом basePath (для <img src>, иконок и т.п.). */
export function asset(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE_PATH}${path}`;
}

/** Подрубрики раздела. Корневая рубрика poleznye-stati — это сам раздел /articles/. */
export function rubricPath(slug: string, page = 1): string {
  const base = `${ARTICLES_PATH}category/${slug}/`;
  return page <= 1 ? base : `${base}page/${page}/`;
}

/** Старые и альтернативные адреса раздела (ТЗ, задача 5) — 301 на /articles/ с сохранением адреса статьи */
export const LEGACY_PREFIXES = ["/blog", "/poleznye-stati"] as const;

/** src для <img>: собственные файлы сайта — относительным путём (работает на любом домене), внешние — как есть */
export function imgSrc(url: string): string {
  return url.startsWith(`${SITE_URL}/`) ? `${BASE_PATH}${url.slice(SITE_URL.length)}` : url;
}
