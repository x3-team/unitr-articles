// Имитация WordPress + WPGraphQL + плагина unitr-articles для сквозного теста фронтенда.
// Отвечает на те же запросы, что шлёт src/lib/content/graphql.ts, требует Authorization
// и даёт «админке» теста менять данные: публиковать, снимать с публикации, менять адрес, per_page.
import http from "node:http";

export function createFakeWp({ token, port }) {
  const state = {
    perPage: 10,
    unauthorized: 0,
    requests: 0,
    category: { slug: "poleznye-stati", name: "Полезные статьи", children: [{ slug: "shkafy", name: "Шкафы" }] },
    posts: [],
  };
  let id = 0;
  const addPost = (p) => {
    id++;
    const date = p.date || new Date(Date.UTC(2026, 0, 1) + id * 86400000).toISOString();
    state.posts.push({
      databaseId: id,
      id: Buffer.from(`post:${id}`).toString("base64"),
      slug: p.slug,
      title: p.title,
      excerpt: `<p>${p.excerpt || "Краткое описание статьи &laquo;" + p.title + "&raquo; [&hellip;]"}</p>\n`,
      content: p.content || `<p>Вступление статьи «${p.title}». ${"Текст статьи с подробностями. ".repeat(12)}</p><h2>Первый раздел</h2><p>${"Содержимое раздела. ".repeat(10)}</p><h3>Подраздел</h3><p>Ещё текст.</p>`,
      dateGmt: date.replace("Z", "").replace(/\.\d+$/, ""),
      modifiedGmt: (p.modified || date).replace("Z", "").replace(/\.\d+$/, ""),
      status: p.status || "publish",
      author: { node: { name: p.author || "Инженер Юнит-Ресурс" } },
      featuredImage: { node: { sourceUrl: `https://manage.unitr.ru/wp-content/uploads/cover-${id}.jpg`, altText: "", mediaDetails: { width: 1200, height: 630 } } },
      categories: { nodes: [{ slug: "poleznye-stati", name: "Полезные статьи" }, ...(p.sub ? [{ slug: "shkafy", name: "Шкафы" }] : [])] },
      unitrSeo: { title: p.seoTitle || null, description: p.seoDescription || null },
      unitrOldSlugs: p.oldSlugs || [],
    });
    return state.posts[state.posts.length - 1];
  };

  const published = () =>
    state.posts.filter((p) => p.status === "publish").sort((a, b) => b.dateGmt.localeCompare(a.dateGmt));

  function answer(query, variables) {
    const data = {};
    if (/posts\(/.test(query)) {
      const all = published();
      const start = variables.after ? Number(variables.after) : 0;
      const nodes = all.slice(start, start + 100);
      data.posts = {
        pageInfo: { hasNextPage: start + 100 < all.length, endCursor: String(start + 100) },
        nodes,
      };
    }
    if (/unitrArticlesSettings/.test(query)) data.unitrArticlesSettings = { perPage: state.perPage, category: "poleznye-stati", frontendUrl: "" };
    if (/pages\(/.test(query))
      data.pages = { nodes: [{ uri: "/", modifiedGmt: "2026-10-01T00:00:00" }, { uri: "/catalog/", modifiedGmt: "2026-10-02T00:00:00" }] };
    if (/category\(id/.test(query)) data.category = { ...state.category, children: { nodes: state.category.children } };
    return { data };
  }

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url === "/home") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end('<html><head><title>Юнит-Ресурс — главная</title><meta name="description" content="Главная страница unitr.ru"></head><body></body></html>');
      }
      if (req.url.startsWith("/graphql")) {
        state.requests++;
        if (req.headers.authorization !== `Basic ${Buffer.from(token).toString("base64")}`) {
          state.unauthorized++;
          res.writeHead(401, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ errors: [{ message: "unauthorized" }] }));
        }
        const { query, variables = {} } = JSON.parse(body || "{}");
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(answer(query, variables)));
      }
      res.writeHead(404);
      res.end();
    });
  });

  return {
    state,
    addPost,
    publish: (p) => addPost(p),
    unpublish: (slug) => {
      const p = state.posts.find((x) => x.slug === slug);
      p.status = "draft";
    },
    rename: (slug, newSlug) => {
      const p = state.posts.find((x) => x.slug === slug);
      p.unitrOldSlugs = [...p.unitrOldSlugs, slug];
      p.slug = newSlug;
      p.modifiedGmt = new Date().toISOString().replace("Z", "").replace(/\.\d+$/, "");
    },
    addRubric: (slug, name) => state.category.children.push({ slug, name }),
    tagPost: (slug, rubric) => state.posts.find((x) => x.slug === slug).categories.nodes.push(rubric),
    listen: () => new Promise((r) => server.listen(port, "127.0.0.1", r)),
    close: () => new Promise((r) => server.close(r)),
  };
}
