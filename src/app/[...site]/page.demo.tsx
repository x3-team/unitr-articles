import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import type { Section } from "@/components/Header";
import { Shell } from "@/components/Shell";
import { MOCK_SITE_PAGES } from "@/content/mock/site-pages";
import { CONTENT_SOURCE } from "@/lib/config";
import { pageMetadata } from "@/lib/meta";
import { ARTICLES_PATH } from "@/lib/paths";
import { HOME_CRUMB } from "@/lib/seo";

/**
 * Заглушки страниц основного сайта (каталог, конфигураторы) — только для демо, чтобы ссылки меню
 * и адреса из sitemap.xml открывались. На боевом сервере эти адреса обслуживает существующий сайт.
 */
export const dynamicParams = false;

const TITLES: Record<string, string> = {
  "/catalog/": "Каталог",
  "/catalog/elektrotehnicheskie-resheniya/": "Электротехнические решения",
  "/catalog/telekommunikaczionnye-shkafy/": "Телекоммуникационные шкафы",
  "/catalog/kabelnaya-produkcziya/": "Кабельная продукция",
  "/catalog/aksessuary/": "Аксессуары",
  "/configurators/": "Конфигураторы",
  "/configurators/server-cabinet/": "Конфигуратор серверных шкафов",
  "/configurators/pdu/": "Конфигуратор PDU",
};

type Params = Promise<{ site: string[] }>;

export function generateStaticParams() {
  if (CONTENT_SOURCE !== "mock") return [];
  return MOCK_SITE_PAGES.filter((p) => p.path !== "/").map((p) => ({ site: p.path.split("/").filter(Boolean) }));
}

const toPath = (parts: string[]) => `/${parts.join("/")}/`;

export async function generateMetadata({ params }: { params: Params }) {
  const path = toPath((await params).site);
  const title = TITLES[path];
  if (!title) return {};
  return pageMetadata({ title: `${title} | Юнит-Ресурс`, description: `${title} — Юнит-Ресурс.`, path });
}

export default async function SiteStub({ params }: { params: Params }) {
  const parts = (await params).site;
  const path = toPath(parts);
  const title = TITLES[path];
  if (CONTENT_SOURCE !== "mock" || !title) notFound();
  const active: Section = parts[0] === "catalog" ? "catalog" : "configurators";
  const crumbs = [HOME_CRUMB];
  if (parts.length > 1) crumbs.push({ name: TITLES[`/${parts[0]}/`], path: `/${parts[0]}/` });
  crumbs.push({ name: title, path });
  return (
    <Shell active={active}>
      <section className="hero">
        <div className="container">
          <Breadcrumbs items={crumbs} />
          <h1 className="hero__title hero__title--sm">{title}</h1>
          <p className="hero__lead">
            Заглушка страницы существующего сайта unitr.ru — в демо раздела «Статьи» нужна только для проверки меню
            и карты сайта.
          </p>
          <p>
            <Link className="button" href={ARTICLES_PATH}>
              Перейти к статьям
            </Link>
          </p>
        </div>
      </section>
    </Shell>
  );
}
