/** Очистка текстовых полей WordPress (заголовок, excerpt) от HTML и сущностей */

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#039;": "'", "&#39;": "'",
  "&nbsp;": " ", "&laquo;": "«", "&raquo;": "»", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&[a-z]+;|&#0?39;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e);
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().replace(/\s*\[…\]$/, "…");
}

/** H1 на странице статьи — только заголовок статьи; заголовки первого уровня из текста WordPress становятся H2 */
export function demoteH1(html: string): string {
  return html.replace(/<(\/?)h1(?=[\s>])/gi, "<$1h2");
}

/** Снять обёртку: открывающий тег (по регулярному выражению) и парный ему закрывающий, содержимое остаётся */
function unwrap(html: string, open: RegExp, tag: string): string {
  let out = html;
  for (let guard = 0; guard < 50; guard++) {
    const m = open.exec(out);
    if (!m) break;
    const start = m.index;
    const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
    tagRe.lastIndex = start + m[0].length;
    let depth = 1;
    let closeLen = 0;
    for (let t = tagRe.exec(out); t; t = depth > 0 ? tagRe.exec(out) : null) {
      depth += t[1] ? -1 : 1;
      closeLen = t[0].length;
    }
    if (depth > 0) {
      out = out.slice(0, start) + out.slice(start + m[0].length); // нет пары — убрать только открывающий
      continue;
    }
    const end = tagRe.lastIndex;
    out = out.slice(0, start) + out.slice(start + m[0].length, end - closeLen) + out.slice(end);
  }
  return out;
}

const textOf = (html: string) => stripTags(html).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const fileKey = (src: string) =>
  (src.split(/[?#]/)[0].split("/").pop() || "").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/-(\d+x\d+|scaled)$/, "");

/**
 * Текст статьи из WordPress → HTML страницы статьи. В редактор могут вставить целую HTML-страницу: свои <style>
 * (body, .container, article, h2, p…) переопределили бы вёрстку сайта — ширину колонок, шапку, подвал, а обёртки
 * .container / <article> со своими отступами сужают текст. Остаётся только содержимое; повтор заголовка статьи
 * и обложки в начале текста убирается (они уже есть на странице).
 */
export function cleanContentHtml(html: string, opts: { title: string; coverUrl?: string | null }): string {
  let s = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  s = s
    .replace(/<(style|script|noscript|template|title)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(link|meta|base)\b[^>]*>/gi, "")
    .replace(/<\/?(html|head|body|article|main|header|footer)\b[^>]*>/gi, "");
  s = unwrap(s, /<div\b[^>]*\bclass\s*=\s*["'](?:container|wrapper|wrap|page)["'][^>]*>/i, "div");
  s = demoteH1(s);

  // начало текста: повтор заголовка статьи и обложки
  const title = textOf(opts.title);
  const lead = /^\s*<h2\b[^>]*>([\s\S]*?)<\/h2>/i;
  const leadImg = /^\s*(?:<figure\b[^>]*>\s*)?<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>(?:\s*<figcaption\b[\s\S]*?<\/figcaption>)?(?:\s*<\/figure>)?/i;
  for (let i = 0; i < 3; i++) {
    const img = leadImg.exec(s);
    if (img && opts.coverUrl && fileKey(img[1]) === fileKey(opts.coverUrl)) {
      s = s.slice(img[0].length);
      continue;
    }
    const h = lead.exec(s);
    if (h && title && textOf(h[1]) === title) {
      s = s.slice(h[0].length);
      continue;
    }
    break;
  }
  return s.trim();
}
