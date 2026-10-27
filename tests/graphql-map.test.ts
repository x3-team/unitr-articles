import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeEntities, demoteH1, stripTags } from "../src/lib/content/wp-text";

test("excerpt WordPress → чистый текст", () => {
  assert.equal(stripTags("<p>Текст &laquo;в кавычках&raquo; и&nbsp;пробел [&hellip;]</p>\n"), "Текст «в кавычках» и пробел…");
  assert.equal(decodeEntities("A &#8212; B &amp; C &#x2014; D"), "A — B & C — D");
});

test("H1 из текста WordPress → H2 (на странице один H1 — заголовок статьи)", () => {
  assert.equal(demoteH1('<h1 class="wp-block-heading">Раздел</h1><p>текст</p><H1>Ещё</H1><h10>'), '<h2 class="wp-block-heading">Раздел</h2><p>текст</p><h2>Ещё</h2><h10>');
});
