import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeEntities, stripTags } from "../src/lib/content/wp-text";

test("excerpt WordPress → чистый текст", () => {
  assert.equal(stripTags("<p>Текст &laquo;в кавычках&raquo; и&nbsp;пробел [&hellip;]</p>\n"), "Текст «в кавычках» и пробел…");
  assert.equal(decodeEntities("A &#8212; B &amp; C &#x2014; D"), "A — B & C — D");
});
