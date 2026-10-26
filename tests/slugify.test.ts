import assert from "node:assert/strict";
import { test } from "node:test";
import { isLatinSlug, slugify } from "../src/lib/slugify";

test("ЧПУ на латинице из заголовка", () => {
  assert.equal(
    slugify("Как выбрать серверный шкаф: 7 параметров, которые важно проверить до заказа"),
    "kak-vybrat-servernyj-shkaf-7-parametrov-kotorye-vazhno-proverit-do-zakaza",
  );
  assert.equal(slugify("Щёточные «вводы» и ИБП — 2N"), "shhyotochnye-vvody-i-ibp-2n");
  assert.equal(slugify("Цена: 100% ёлка!"), "czena-100-yolka");
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
