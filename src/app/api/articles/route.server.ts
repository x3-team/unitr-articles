import { getArchivePage, getArticle } from "@/lib/content";

/**
 * BFF-эндпоинт для клиентского кода основного сайта (если SPA нужно показать, например, блок
 * последних статей): данные из WordPress идут через сервер, токен в браузер не передаётся.
 *   GET /api/articles/?page=2            — страница анонсов
 *   GET /api/articles/?slug=<адрес>      — статья
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const slug = sp.get("slug");
  if (slug) {
    const found = await getArticle(slug);
    return found
      ? Response.json(found, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } })
      : Response.json({ error: "not_found" }, { status: 404 });
  }
  const page = Number.parseInt(sp.get("page") || "1", 10);
  const data = await getArchivePage(page, sp.get("rubric") || undefined);
  return data
    ? Response.json(data, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } })
    : Response.json({ error: "not_found" }, { status: 404 });
}
