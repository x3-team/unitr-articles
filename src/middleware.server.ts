import { NextResponse, type NextRequest } from "next/server";
import { ARTICLES_PATH, LEGACY_PREFIXES } from "@/lib/paths";

/**
 * Серверная маршрутизация раздела (ТЗ, задача 5) — только в боевом режиме:
 *  1. /blog, /blog/, /poleznye-stati, /poleznye-stati/ → 301 /articles/;
 *     /blog/<slug>/ и /poleznye-stati/<slug>/ → 301 /articles/<slug>/ (адрес статьи сохраняется);
 *  2. прежний адрес статьи (slug изменили в WordPress) → 301 на актуальный;
 *  3. /articles/page/1/ → 301 /articles/ (дубль первой страницы);
 *  4. адрес без завершающего слеша → 301 на адрес со слешем (встроенный редирект Next.js — 308);
 *  5. /ARTICLES/ и другой регистр префикса раздела → 301 /articles/ (как в .htaccess статической выкладки).
 * Несуществующие адреса внутри /articles/ обрабатываются шаблонами: notFound() → HTTP 404.
 */

const REDIRECTS_TTL_MS = (Number(process.env.REDIRECTS_TTL_SECONDS) || 60) * 1000;
let redirectsCache: { at: number; map: Record<string, string> } | null = null;

async function oldSlugMap(req: NextRequest): Promise<Record<string, string>> {
  if (redirectsCache && Date.now() - redirectsCache.at < REDIRECTS_TTL_MS) return redirectsCache.map;
  try {
    // запрос к самому приложению напрямую, минуя nginx: снаружи /api/redirects/ не проксируется
    const origin = process.env.INTERNAL_ORIGIN || `http://127.0.0.1:${process.env.PORT || 3000}`;
    const res = await fetch(`${origin}/api/redirects/`, { headers: { "x-middleware-internal": "1" } });
    const map = res.ok ? ((await res.json()) as Record<string, string>) : {};
    redirectsCache = { at: Date.now(), map };
    return map;
  } catch {
    return redirectsCache?.map || {};
  }
}

function permanent(req: NextRequest, pathname: string) {
  // обычный URL, а не nextUrl.clone(): NextURL «запоминает» отсутствие слеша в исходном адресе и срезает его
  const url = new URL(pathname + req.nextUrl.search, req.url);
  return NextResponse.redirect(url, 301);
}

const withSlash = (p: string) => (p.endsWith("/") ? p : `${p}/`);

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 1. Старые адреса раздела
  for (const prefix of LEGACY_PREFIXES) {
    if (path === prefix || path === `${prefix}/`) return permanent(req, ARTICLES_PATH);
    if (path.startsWith(`${prefix}/`)) {
      const rest = withSlash(path.slice(prefix.length + 1));
      const [first] = rest.split("/");
      const map = await oldSlugMap(req);
      const target = map[first] ? `${map[first]}/` : rest;
      return permanent(req, `${ARTICLES_PATH}${target}`);
    }
  }

  // 5. Префикс раздела в другом регистре
  const anyCase = /^\/articles(\/.*)?$/i.exec(path);
  if (anyCase && !path.startsWith("/articles")) return permanent(req, withSlash(`/articles${anyCase[1] || ""}`));

  // 3. Дубль первой страницы пагинации
  const pageOne = /^(\/articles\/(?:category\/[^/]+\/)?)page\/1\/?$/.exec(path);
  if (pageOne) return permanent(req, pageOne[1]);

  // 4. Завершающий слеш
  if (!path.endsWith("/")) return permanent(req, `${path}/`);

  // 2. Изменённый адрес статьи
  const single = /^\/articles\/([^/]+)\/$/.exec(path);
  if (single && single[1] !== "page" && single[1] !== "category") {
    const map = await oldSlugMap(req);
    const target = map[decodeURIComponent(single[1])];
    if (target) return permanent(req, `${ARTICLES_PATH}${target}/`);
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  // всё, кроме служебных файлов Next.js, API и файлов с расширением (sitemap.xml, robots.txt, изображения)
  matcher: ["/((?!_next/|api/|.*\\.[A-Za-z0-9]+$).*)"],
};
