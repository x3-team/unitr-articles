import Link from "next/link";
import { ORGANIZATION } from "@/lib/config";
import { ARTICLES_PATH } from "@/lib/paths";
import { Logo } from "./Logo";

export function Footer() {
  const tel = ORGANIZATION.phone.replace(/[^\d+]/g, "");
  return (
    <footer className="footer">
      <div className="footer__grid">
        <div className="footer__logo">
          <Logo size={28} />
        </div>
        <div className="footer__col">
          <p className="footer__label">Контактные данные</p>
          <a href={`tel:${tel}`}>{ORGANIZATION.phone}</a>
          <a href={`mailto:${ORGANIZATION.email}`}>{ORGANIZATION.email}</a>
          <p className="footer__label footer__label--gap">Адрес</p>
          <p>{ORGANIZATION.address}</p>
        </div>
        <div className="footer__col">
          <p className="footer__label">Навигация</p>
          <Link href="/configurators/server-cabinet/">Конфигуратор серверных шкафов</Link>
          <Link href="/configurators/pdu/">Конфигуратор PDU</Link>
          <Link href="/catalog/elektrotehnicheskie-resheniya/">Электротехнические решения</Link>
          <Link href="/catalog/telekommunikaczionnye-shkafy/">Телекоммуникационные шкафы</Link>
          <Link href="/catalog/kabelnaya-produkcziya/">Кабельная продукция</Link>
          <Link href="/catalog/aksessuary/">Аксессуары</Link>
          <Link href={ARTICLES_PATH}>Статьи</Link>
        </div>
        <div className="footer__col">
          <p className="footer__label">Документация</p>
          <span>Политика конфиденциальности</span>
          <span>Менеджмент качества</span>
          <span>Результаты специальной оценки условий труда</span>
        </div>
      </div>
      <div className="footer__bottom">
        <span>ЮНИТ-РЕСУРС © {new Date().getFullYear()}</span>
        <span>
          Разработка раздела — <a href="https://x3team.ru">X3 Team</a>
        </span>
      </div>
    </footer>
  );
}
