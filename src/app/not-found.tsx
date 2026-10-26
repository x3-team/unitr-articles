import Link from "next/link";
import { Shell } from "@/components/Shell";
import { ARTICLES_PATH } from "@/lib/paths";

/**
 * Страница ошибки 404. На боевом сервере отдаётся с HTTP-кодом 404 (notFound() в шаблонах),
 * на GitHub Pages — 404.html, который хостинг тоже отдаёт с кодом 404.
 */
export default function NotFound() {
  return (
    <Shell active="articles">
      <title>Страница не найдена — 404 | Юнит-Ресурс</title>
      <section className="hero hero--error">
        <div className="container">
          <p className="error__code">404</p>
          <h1 className="hero__title hero__title--sm">Страница не найдена</h1>
          <p className="hero__lead">
            Возможно, статья была перемещена или снята с публикации. Посмотрите все материалы в разделе «Статьи».
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
