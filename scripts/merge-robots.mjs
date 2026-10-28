#!/usr/bin/env node
// robots.txt сайта с разделом «Статьи»: правила сайта сохраняются (группы User-agent, Clean-param, Host),
// в каждую группу добавляется «Allow: /articles/», запреты, закрывающие раздел, убираются, Sitemap — карта раздела.
//
//   node scripts/merge-robots.mjs <исходный robots.txt сайта> <robots.txt сборки> <результат>
// Нет исходного файла — берётся robots.txt сборки как есть.
import fs from "node:fs";

const [origFile, builtFile, outFile] = process.argv.slice(2);
const built = fs.readFileSync(builtFile, "utf8");
const orig = origFile && fs.existsSync(origFile) ? fs.readFileSync(origFile, "utf8").replace(/\r/g, "") : "";
if (!/^\s*user-agent\s*:/im.test(orig)) {
  fs.writeFileSync(outFile, built);
  process.exit(0);
}
const sitemap = built.split("\n").filter((l) => /^sitemap\s*:/i.test(l));
const blocksArticles = (l) => {
  const m = /^disallow\s*:\s*(\S+)/i.exec(l.trim());
  // «Disallow: /» не трогаем (раздел и так открыт более длинным «Allow: /articles/»), убираем запреты именно раздела
  const p = m ? m[1].replace(/\*$/, "") : "";
  return m && p.length > 1 && ("/articles/".startsWith(p) || p.startsWith("/articles"));
};
const out = [];
const lines = orig.split("\n");
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/^\s*sitemap\s*:/i.test(l) || blocksArticles(l) || /^\s*allow\s*:\s*\/articles\/?\s*$/i.test(l)) continue;
  out.push(l.trimEnd());
  // после последней строки User-agent группы — явное разрешение раздела
  if (/^\s*user-agent\s*:/i.test(l) && !/^\s*user-agent\s*:/i.test(lines[i + 1] || "")) out.push("Allow: /articles/");
}
while (out.length && out[out.length - 1] === "") out.pop();
fs.writeFileSync(outFile, [...out, "", ...sitemap, ""].join("\n"));
