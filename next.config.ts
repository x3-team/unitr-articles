import type { NextConfig } from "next";

/**
 * Один код — два режима сборки:
 *  - боевой (по умолчанию): SSR + ISR на Node.js (`next start` / standalone), middleware с 301-редиректами,
 *    вебхук ревалидации, BFF-эндпоинт; данные — GraphQL WordPress (manage.unitr.ru), токен только на сервере;
 *  - STATIC_EXPORT=1: статический пререндер всех страниц для GitHub Pages (демо). Файлы *.server.ts(x)
 *    (middleware, API-маршруты) в этот режим не попадают, т.к. Pages не исполняет серверный код.
 */
const isStaticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.BASE_PATH || "";
const isDemoContent = (process.env.CONTENT_SOURCE || "mock") === "mock";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : "standalone",
  basePath: basePath || undefined,
  // Если основной сайт тоже использует /_next/, статику раздела можно вынести в отдельный префикс (см. docs/DEPLOY.md)
  assetPrefix: process.env.ASSET_PREFIX || undefined,
  trailingSlash: true,
  poweredByHeader: false,
  // слеш в конце адреса нормализует middleware кодом 301 (встроенный редирект Next.js отдаёт 308)
  skipTrailingSlashRedirect: !isStaticExport,
  reactStrictMode: true,
  // детерминированный buildId: при неизменных данных повторная сборка демо даёт тот же результат (без лишних публикаций)
  generateBuildId: async () => process.env.BUILD_ID || process.env.GITHUB_SHA?.slice(0, 12) || null,
  // *.demo.tsx — главная и заглушки страниц основного сайта, только для демо-данных (CONTENT_SOURCE=mock):
  // на бою эти адреса обслуживает существующий сайт unitr.ru
  pageExtensions: [
    ...(isStaticExport ? ["static.ts"] : ["server.tsx", "server.ts"]),
    ...(isDemoContent ? ["demo.tsx"] : []),
    "tsx",
    "ts",
  ],
  images: { unoptimized: true },
  env: {
    // basePath нужен шаблонам для путей к статике из /public; это не секрет
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  ...(isStaticExport
    ? {}
    : {
        async headers() {
          return [
            {
              // Явно разрешаем индексацию раздела (ТЗ, задача 4): никаких noindex в заголовках
              source: "/articles/:path*",
              headers: [{ key: "X-Robots-Tag", value: "all" }],
            },
          ];
        },
      }),
};

export default nextConfig;
