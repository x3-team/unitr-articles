import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanContentHtml, decodeEntities, demoteH1, stripTags } from "../src/lib/content/wp-text";

test("excerpt WordPress → чистый текст", () => {
  assert.equal(stripTags("<p>Текст &laquo;в кавычках&raquo; и&nbsp;пробел [&hellip;]</p>\n"), "Текст «в кавычках» и пробел…");
  assert.equal(decodeEntities("A &#8212; B &amp; C &#x2014; D"), "A — B & C — D");
});

test("H1 из текста WordPress → H2 (на странице один H1 — заголовок статьи)", () => {
  assert.equal(demoteH1('<h1 class="wp-block-heading">Раздел</h1><p>текст</p><H1>Ещё</H1><h10>'), '<h2 class="wp-block-heading">Раздел</h2><p>текст</p><h2>Ещё</h2><h10>');
});

test("текст статьи — вставленная целиком HTML-страница: без её стилей, обёрток и повтора заголовка и обложки", () => {
  const html = `<style>body{background:#f5f7fa}.container{max-width:860px;padding:40px 20px}</style>
<div class="container">
  <article>
    <img src="https://manage.unitr.ru/wp-content/uploads/2026/07/shkaf.jpg" alt="">
    <header>
      <h1>Серверные шкафы для ЦОД: 42U, 48U или 52U?</h1>
      <p class="lead">Руководство для инженеров</p>
    </header>
    <section><h2>Что такое юнит</h2><p>Текст <div class="note">примечание</div></p></section>
    <div class="cta-box"><h3>Консультация</h3></div>
  </article>
</div>`;
  const out = cleanContentHtml(html, {
    title: "Серверные шкафы для ЦОД: 42U, 48U или 52U?",
    coverUrl: "https://manage.unitr.ru/wp-content/uploads/2026/07/shkaf-1024x683.jpg",
  });
  assert.doesNotMatch(out, /<style|class="container"|<article|<header|<img|<h1/i);
  assert.match(out, /^<p class="lead">Руководство для инженеров<\/p>/);
  assert.match(out, /<section><h2>Что такое юнит<\/h2><p>Текст <div class="note">примечание<\/div><\/p><\/section>/);
  assert.match(out, /<div class="cta-box"><h3>Консультация<\/h3><\/div>\s*$/);
});

test("обычный текст из редактора WordPress не меняется (кроме H1 → H2)", () => {
  const html = '<p>Вступление</p>\n<h2 class="wp-block-heading">Раздел</h2>\n<figure class="wp-block-image"><img src="/a.jpg" alt=""></figure>';
  assert.equal(cleanContentHtml(html, { title: "Другой заголовок", coverUrl: "/b.jpg" }), html);
});
