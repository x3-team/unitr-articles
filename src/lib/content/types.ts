export interface Image {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  /** Краткое описание (excerpt), без HTML */
  excerpt: string;
  /** ISO 8601 */
  date: string;
  /** ISO 8601 */
  modified: string;
  cover: Image | null;
}

export interface Article extends ArticleSummary {
  /** Полный текст статьи, HTML из WordPress (подзаголовки H2/H3) */
  contentHtml: string;
  author: { name: string };
  /** SEO-поля, заполняемые Заказчиком в WordPress. Пустые — подставляются заголовок/excerpt. */
  seo: { title: string; description: string };
  categories: { slug: string; name: string }[];
  /** Адрес записи в WordPress как есть (может быть %-кодированной кириллицей), если он отличается от ЧПУ сайта */
  wpSlug?: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

/** Страница сайта вне раздела «Статьи» (главная, каталог…) — для sitemap.xml. */
export interface SitePage {
  path: string;
  lastmod: string;
}

export interface Rubric {
  slug: string;
  name: string;
  /** Адрес рубрики на сайте, если у неё есть своя страница */
  path?: string;
  lastmod: string;
}

/**
 * Источник данных. Реализации: mock (демо) и graphql (WordPress manage.unitr.ru).
 * Все вызовы выполняются только на сервере (Server Components / Route Handlers / middleware).
 */
export interface ContentSource {
  /** Опубликованные статьи рубрики (включая подрубрики), новые сверху. Снятые с публикации сюда не попадают. */
  listArticles(): Promise<Article[]>;
  /** Количество анонсов на странице из настроек CMS (если задано) */
  perPageSetting(): Promise<number | undefined>;
  /** Старые адреса статей: старый slug → актуальный slug (для 301) */
  redirects(): Promise<Record<string, string>>;
  /** Страницы сайта вне раздела, которые должны попасть в sitemap.xml */
  sitePages(): Promise<SitePage[]>;
  /** Рубрика раздела и её подрубрики */
  rubrics(): Promise<Rubric[]>;
}
