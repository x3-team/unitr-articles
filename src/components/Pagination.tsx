import Link from "next/link";
import { pageList } from "@/lib/pagination";

const Arrow = ({ dir }: { dir: "left" | "right" }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
    <path d={dir === "left" ? "M12 5l-5 5 5 5" : "M8 5l5 5-5 5"} fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (n: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pager" aria-label="Страницы раздела">
      {page > 1 ? (
        <Link className="pager__step" href={href(page - 1)} rel="prev">
          <Arrow dir="left" />
          Предыдущая
        </Link>
      ) : (
        <span className="pager__step is-disabled" aria-disabled="true">
          <Arrow dir="left" />
          Предыдущая
        </span>
      )}
      <ol className="pager__pages">
        {pageList(page, totalPages).map((n, i) =>
          n === "gap" ? (
            <li key={`gap-${i}`} className="pager__gap">
              …
            </li>
          ) : (
            <li key={n}>
              {n === page ? (
                <span className="pager__num is-current" aria-current="page">
                  {n}
                </span>
              ) : (
                <Link className="pager__num" href={href(n)} aria-label={`Страница ${n}`}>
                  {n}
                </Link>
              )}
            </li>
          ),
        )}
      </ol>
      {page < totalPages ? (
        <Link className="pager__step" href={href(page + 1)} rel="next">
          Следующая
          <Arrow dir="right" />
        </Link>
      ) : (
        <span className="pager__step is-disabled" aria-disabled="true">
          Следующая
          <Arrow dir="right" />
        </span>
      )}
    </nav>
  );
}
