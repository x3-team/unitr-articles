import Link from "next/link";
import { ORGANIZATION } from "@/lib/config";
import { ARTICLES_PATH } from "@/lib/paths";
import { Logo } from "./Logo";

export type Section = "catalog" | "configurators" | "articles" | null;

/**
 * Основное меню (ТЗ, задача 2): пункт «Статьи» рядом с «Каталог» и «Конфигураторы».
 * Ссылки отдаются в серверном HTML и в десктопной, и в мобильной версии; мобильное меню
 * открывается без JavaScript (чекбокс + CSS). Активный пункт выделен цветом и aria-current.
 */
const NAV: { key: Exclude<Section, null>; label: string; href: string }[] = [
  { key: "catalog", label: "Каталог", href: "/catalog/" },
  { key: "configurators", label: "Конфигураторы", href: "/configurators/" },
  { key: "articles", label: "Статьи", href: ARTICLES_PATH },
];

export function Header({ active }: { active: Section }) {
  const tel = ORGANIZATION.phone.replace(/[^\d+]/g, "");
  return (
    <header className="header">
      <input type="checkbox" id="menu-toggle" className="header__toggle" aria-hidden="true" tabIndex={-1} />
      <div className="header__bar">
        <Link href="/" className="header__logo" aria-label="Юнит-Ресурс — на главную">
          <Logo />
        </Link>
        <nav className="header__nav" aria-label="Основное меню">
          <ul>
            {NAV.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={`header__link${active === item.key ? " is-active" : ""}`}
                  aria-current={active === item.key ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <a className="header__phone" href={`tel:${tel}`}>
          {ORGANIZATION.phone}
        </a>
        <a className="header__cta" href={`mailto:${ORGANIZATION.email}`}>
          Связаться с нами
          <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true">
            <path d="M0 5h10.5M6.5 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </a>
        <label htmlFor="menu-toggle" className="header__burger" aria-label="Открыть меню">
          <span />
          <span />
          <span />
        </label>
      </div>
      <nav className="mobile-menu" aria-label="Мобильное меню">
        <ul>
          {NAV.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className={`mobile-menu__link${active === item.key ? " is-active" : ""}`}
                aria-current={active === item.key ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <a className="mobile-menu__phone" href={`tel:${tel}`}>
          {ORGANIZATION.phone}
        </a>
      </nav>
    </header>
  );
}
