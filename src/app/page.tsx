import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/ArticleCard";
import { Shell } from "@/components/Shell";
import { CONTENT_SOURCE } from "@/lib/config";
import { getArchivePage } from "@/lib/content";
import { pageMetadata } from "@/lib/meta";
import { ARTICLES_PATH } from "@/lib/paths";

/**
 * Главная — только для демо на GitHub Pages (на боевом сервере её отдаёт существующий сайт unitr.ru,
 * а это приложение обслуживает /articles/, /sitemap.xml, /robots.txt и старые адреса раздела).
 */
export const revalidate = 300;

export function generateMetadata() {
  return pageMetadata({
    title: "Юнит-Ресурс — телекоммуникационное оборудование",
    description: "Разрабатываем и производим телекоммуникационные шкафы, PDU и кабельную продукцию.",
    path: "/",
  });
}

export default async function Home() {
  if (CONTENT_SOURCE !== "mock") notFound();
  const latest = await getArchivePage(1);
  return (
    <Shell active={null}>
      <section className="hero hero--home">
        <div className="container">
          <p className="demo-note">Демо-стенд раздела «Статьи». Главная, каталог и конфигураторы — заглушки существующего сайта.</p>
          <h1 className="hero__title">Разрабатываем телекоммуникационное оборудование</h1>
        </div>
      </section>
      <section className="container archive">
        <div className="section-head">
          <h2>Статьи</h2>
          <Link href={ARTICLES_PATH} className="section-head__more">
            Все статьи →
          </Link>
        </div>
        <div className="grid">
          {latest?.items.slice(0, 4).map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      </section>
    </Shell>
  );
}
