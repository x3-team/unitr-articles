import { Footer } from "./Footer";
import { Header, type Section } from "./Header";

export function Shell({ active, children }: { active: Section; children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="skip">
        Перейти к содержимому
      </a>
      <Header active={active} />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
