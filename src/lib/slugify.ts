/**
 * ЧПУ на латинице из заголовка статьи (транслитерация по ГОСТ 7.79-2000, система Б,
 * в упрощённом «веб»-варианте, как у плагина Cyr-To-Lat для WordPress).
 */
const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "j",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "cz", ч: "ch", ш: "sh", щ: "shh", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  і: "i", ї: "yi", є: "ye", ґ: "g",
};

export function slugify(input: string, maxLength = 80): string {
  const translit = input
    .toLowerCase()
    .replace(/[«»"'’“”]/g, "")
    .split("")
    .map((ch) => (ch in MAP ? MAP[ch] : ch))
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  const slug = translit
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  if (slug.length <= maxLength) return slug;
  // обрезаем по границе слова
  const cut = slug.slice(0, maxLength);
  return cut.includes("-") ? cut.slice(0, cut.lastIndexOf("-")) : cut;
}

/** Латинский ли адрес (WordPress без Cyr-To-Lat отдаёт %-кодированную кириллицу). */
export function isLatinSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug);
}
