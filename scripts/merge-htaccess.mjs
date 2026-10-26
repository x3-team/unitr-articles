#!/usr/bin/env node
// Вставляет блок раздела «Статьи» в корневой .htaccess сайта (как это делает WordPress со своим блоком):
// содержимое между «# BEGIN unitr-articles» и «# END unitr-articles» заменяется, а если блока ещё нет —
// он ставится в начало файла, чтобы 301 со старых адресов сработали раньше правил SPA. Остальное не меняется.
//
//   node scripts/merge-htaccess.mjs <текущий .htaccess (может отсутствовать)> <блок> <результат>
import fs from "node:fs";

const [current, blockFile, outFile] = process.argv.slice(2);
if (!blockFile || !outFile) {
  console.error("Использование: merge-htaccess.mjs <текущий .htaccess> <unitr-articles.htaccess> <результат>");
  process.exit(2);
}
const block = fs.readFileSync(blockFile, "utf8").trimEnd() + "\n";
const text = current && fs.existsSync(current) ? fs.readFileSync(current, "utf8") : "";
const re = /# BEGIN unitr-articles[\s\S]*?# END unitr-articles\r?\n?/;
const merged = re.test(text) ? text.replace(re, block) : `${block}\n${text}`;
fs.writeFileSync(outFile, merged);
console.log(re.test(text) ? "Блок unitr-articles обновлён" : "Блок unitr-articles добавлен в начало файла");
