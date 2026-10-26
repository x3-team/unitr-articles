import Link from "next/link";
import type { Crumb } from "@/lib/seo";

/** Хлебные крошки (видимая часть; микроразметка BreadcrumbList — JSON-LD на странице) */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Хлебные крошки">
      <ol>
        {items.map((c, i) => (
          <li key={c.path}>
            {i < items.length - 1 ? <Link href={c.path}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
