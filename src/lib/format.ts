const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const TZ = "Europe/Moscow";

function parts(iso: string) {
  const f = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "numeric", month: "numeric", year: "numeric" });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { day: Number(p.day), month: Number(p.month), year: Number(p.year) };
}

/** Для карточки по макету: «17» + «дек / 2024» */
export function dateParts(iso: string) {
  const { day, month, year } = parts(iso);
  return { day: String(day), month: MONTHS_SHORT[month - 1], year: String(year) };
}

/** 05.02.2025 — как на странице новости в макете */
export function dateNumeric(iso: string) {
  const { day, month, year } = parts(iso);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

export function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length).replace(/[\s,.;:—-]+$/, "")}…`;
}
