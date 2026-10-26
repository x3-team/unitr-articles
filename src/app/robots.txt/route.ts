import { BASE_PATH } from "@/lib/config";
import { absoluteUrl, ARTICLES_PATH } from "@/lib/paths";

/**
 * /robots.txt: адрес карты сайта и явное разрешение индексации раздела /articles/.
 * Запретов для раздела нет (закрыт только служебный /api/).
 */
export const dynamic = "force-static";

/**
 * На боевом сервере этот файл заменяет robots.txt основного сайта, поэтому его собственные правила
 * переносятся в ROBOTS_EXTRA (строки через \n, без «User-agent» и «Sitemap»). Disallow для адресов раздела
 * отбрасываются (ТЗ, задача 4); общие правила вроде «Disallow: /search» сохраняются, а раздел остаётся открыт
 * явным Allow: /articles/ (более длинное правило имеет приоритет).
 */
function extraRules(): string[] {
  return (process.env.ROBOTS_EXTRA || "")
    .split(/\\n|\n/)
    .map((l) => l.trim())
    .filter((l) => /^(dis)?allow\s*:/i.test(l) || /^(clean-param|crawl-delay)\s*:/i.test(l))
    .filter((l) => {
      const m = /^disallow\s*:\s*(\S*)/i.exec(l);
      return !m || !m[1].startsWith(ARTICLES_PATH.slice(0, -1));
    });
}

export function GET() {
  const body = [
    "User-agent: *",
    `Allow: ${BASE_PATH}${ARTICLES_PATH}`,
    `Disallow: ${BASE_PATH}/api/`,
    ...extraRules(),
    "",
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
