import { BASE_PATH } from "@/lib/config";
import { absoluteUrl, ARTICLES_PATH } from "@/lib/paths";

/**
 * /robots.txt: адрес карты сайта и явное разрешение индексации раздела /articles/.
 * Запретов для раздела нет (закрыт только служебный /api/).
 */
export const dynamic = "force-static";

export function GET() {
  const body = [
    "User-agent: *",
    `Allow: ${BASE_PATH}${ARTICLES_PATH}`,
    `Disallow: ${BASE_PATH}/api/`,
    "",
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
