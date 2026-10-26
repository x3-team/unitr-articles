// Локальная эмуляция GitHub Pages для проверки статического экспорта:
// /unitr-articles/<path> → out/<path>; каталог без слеша → 301 на адрес со слешем;
// несуществующий адрес → out/404.html с кодом 404; Cache-Control: max-age=600 (как у Pages).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] || "out");
const BASE = process.env.BASE_PATH || "/unitr-articles";
const PORT = Number(process.env.PORT || 8090);
const TYPES = { ".html": "text/html; charset=utf-8", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff" };

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let p = decodeURIComponent(url.pathname);
    const send = (code, file, extra = {}) => {
      res.writeHead(code, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "max-age=600", ...extra });
      res.end(fs.readFileSync(file));
    };
    if (!p.startsWith(`${BASE}/`) && p !== BASE) return send(404, path.join(ROOT, "404.html"));
    p = p.slice(BASE.length) || "/";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) return send(404, path.join(ROOT, "404.html"));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!p.endsWith("/")) {
        res.writeHead(301, { Location: `${BASE}${p}/${url.search}` });
        return res.end();
      }
      if (fs.existsSync(path.join(file, "index.html"))) return send(200, path.join(file, "index.html"));
    } else if (fs.existsSync(file)) return send(200, file);
    else if (fs.existsSync(`${file}.html`)) return send(200, `${file}.html`);
    return send(404, path.join(ROOT, "404.html"));
  })
  .listen(PORT, () => console.log(`Pages-эмуляция: http://localhost:${PORT}${BASE}/`));
