import assert from "node:assert/strict";
import { test } from "node:test";
import { isLatinSlug, latinSlug, slugify } from "../src/lib/slugify";

test("ЧПУ на латинице из заголовка", () => {
  assert.equal(
    slugify("Как выбрать серверный шкаф: 7 параметров, которые важно проверить до заказа"),
    "kak-vybrat-servernyy-shkaf-7-parametrov-kotorye-vazhno-proverit-do-zakaza",
  );
  // схема Яндекса: ё → e, й → y, х → h, ц → c, щ → sch, ъ и ь опускаются
  assert.equal(slugify("Щёточные «вводы» и ИБП — 2N"), "schetochnye-vvody-i-ibp-2n");
  assert.equal(slugify("Цена: 100% ёлка!"), "cena-100-elka");
  assert.equal(slugify("Шкафы ЦОД 42U/48U/52U"), "shkafy-cod-42u-48u-52u");
  assert.equal(slugify("Объём хранилища и подъезд"), "obem-hranilischa-i-podezd");
});

test("ограничение длины по границе слова", () => {
  const s = slugify("очень ".repeat(30) + "длинный заголовок", 40);
  assert.ok(s.length <= 40);
  assert.ok(!s.endsWith("-"));
});

test("латинский адрес", () => {
  assert.equal(isLatinSlug("kak-vybrat"), true);
  assert.equal(isLatinSlug("%d0%ba%d0%b0%d0%ba"), false);
  assert.equal(isLatinSlug("как"), false);
});

test("латинский ЧПУ для обрезанного WordPress кириллического адреса — из полного заголовка", () => {
  const title = "Как выбрать серверный шкаф: 7 параметров, которые важно проверить до заказа";
  // как sanitize_title в WordPress: %-кодировка обрезается до 200 байт по границе символа
  let encoded = "";
  for (const ch of "как-выбрать-серверный-шкаф-7-параметров-которые-важно-проверить-до-заказа") {
    const e = encodeURIComponent(ch);
    if (encoded.length + e.length > 200) break;
    encoded += e;
  }
  assert.equal(latinSlug(encoded, title), slugify(title));
  assert.equal(latinSlug(decodeURIComponent(encoded), title), slugify(title));
  // короткий адрес, введённый вручную, сохраняется, даже если он — начало заголовка
  assert.equal(latinSlug("медь-или-оптика", "Медь или оптика в новом здании"), "med-ili-optika");
  assert.equal(latinSlug("шкафы-выбор", title), "shkafy-vybor");
  assert.equal(latinSlug("statya-1", title), "statya-1");
});
