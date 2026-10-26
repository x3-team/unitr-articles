import type { SitePage } from "@/lib/content/types";

/**
 * Страницы основного сайта unitr.ru вне раздела «Статьи» (главная, каталог, конфигураторы),
 * которые должны попасть в sitemap.xml. Структура — по макету «Юнит-Ресурс / ТЗ к CMS секциям».
 * На боевом сервере список берётся из WordPress (страницы и записи каталога, см. graphql.ts),
 * а для разделов SPA, которых нет в WordPress, — из SITE_STATIC_PAGES.
 */
export const MOCK_SITE_PAGES: SitePage[] = [
  { path: "/", lastmod: "2026-10-20T09:00:00.000Z" },
  { path: "/catalog/", lastmod: "2026-10-15T09:00:00.000Z" },
  { path: "/catalog/elektrotehnicheskie-resheniya/", lastmod: "2026-10-01T09:00:00.000Z" },
  { path: "/catalog/telekommunikaczionnye-shkafy/", lastmod: "2026-10-12T09:00:00.000Z" },
  { path: "/catalog/kabelnaya-produkcziya/", lastmod: "2026-09-28T09:00:00.000Z" },
  { path: "/catalog/aksessuary/", lastmod: "2026-09-20T09:00:00.000Z" },
  { path: "/configurators/", lastmod: "2026-10-10T09:00:00.000Z" },
  { path: "/configurators/server-cabinet/", lastmod: "2026-10-10T09:00:00.000Z" },
  { path: "/configurators/pdu/", lastmod: "2026-10-10T09:00:00.000Z" },
];
