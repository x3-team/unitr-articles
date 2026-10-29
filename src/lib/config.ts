/**
 * Конфигурация раздела. Всё, что Заказчик может менять без переработки кода, задаётся
 * переменными окружения (см. .env.example) или настройками WordPress.
 */

function trimSlash(s: string) {
  return s.replace(/\/+$/, "");
}

/** Публичный адрес сайта (с basePath, если сайт живёт в подкаталоге — как демо на GitHub Pages). */
export const SITE_URL = trimSlash(process.env.SITE_URL || "https://unitr.ru");

/** Префикс для статики из /public (GitHub Pages публикует проект в подкаталоге). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const SITE_NAME = "Юнит-Ресурс";
export const SITE_LOCALE = "ru_RU";
export const ORGANIZATION = {
  name: "ООО «Юнит-Ресурс»",
  phone: "+7 (499) 444-1457",
  email: "info@ratep-inn.ru",
  address: "142201, Московская область, г. Серпухов, ул. Коншиных, д. 108",
};

export const CONTENT_SOURCE = (process.env.CONTENT_SOURCE || "mock") as "mock" | "graphql";

/** Рубрика WordPress, записи которой попадают в раздел «Статьи». */
export const ARTICLES_CATEGORY = process.env.ARTICLES_CATEGORY || "poleznye-stati";

/** Значение по умолчанию, если ни переменная окружения, ни WordPress не задают количество анонсов. */
export const DEFAULT_PER_PAGE = 10;

/** Переопределение количества анонсов на странице через окружение (необязательно). */
export const ENV_PER_PAGE = (() => {
  const n = Number.parseInt(process.env.ARTICLES_PER_PAGE || "", 10);
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : undefined;
})();

/**
 * Время жизни кеша данных, сек (по умолчанию 300).
 * Кеш двухуровневый: данные из WordPress (этот TTL) + HTML страниц (ISR, `revalidate = 300` в шаблонах).
 * Оба уровня работают по схеме stale-while-revalidate, поэтому худший случай устаревания —
 * сумма TTL: 300 + 300 = 10 минут < 15 минут по ТЗ. Значение ограничено 450 с, чтобы сумма не превысила 15 минут.
 * Вебхук из WordPress сбрасывает оба уровня сразу.
 */
export const REVALIDATE_SECONDS = Math.min(
  450,
  Math.max(30, Number.parseInt(process.env.REVALIDATE_SECONDS || "300", 10) || 300),
);

/** Тег кеша Next.js для мгновенного сброса по вебхуку из WordPress. */
export const CACHE_TAG = "articles";

/** Лимиты протокола Sitemaps: при превышении карта автоматически секционируется (sitemap index). */
export const SITEMAP_MAX_URLS = 50_000;
export const SITEMAP_MAX_BYTES = 50 * 1024 * 1024;
