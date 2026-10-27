/*
 * Пункт «Статьи» в шапке SPA unitr.ru (ТЗ, п. 2) — без пересборки SPA.
 * Подключается в index.html сайта блоком «unitr-articles» (scripts/merge-spa-index.mjs при выкладке раздела).
 *
 * Десктоп: в шапке ссылка «Статьи» → /articles/ сразу после «Конфигураторы», с тем же оформлением.
 * Мобильная версия: в шапке нет «Каталог» / «Конфигураторы», меню (бургер) — список рубрик каталога и ссылок
 * конфигураторов; «Статьи» ставится отдельной группой после конфигураторов, с оформлением их ссылок.
 * Шапка SPA перерисовывается при переходах, открытии меню и смене ширины окна — пункт восстанавливается
 * при каждом изменении DOM. Обычная ссылка: переход в раздел — полной загрузкой страницы, HTML раздела
 * отдаёт веб-сервер (пререндер), а не SPA.
 * Запасная навигация из исходного HTML (data-unitr-prenav, для роботов без JS) убирается после отрисовки шапки.
 */
(function () {
  var HREF = "/articles/";
  var MARK = "data-unitr-articles";

  function text(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }
  function path(a) {
    return a.host === location.host ? a.pathname.replace(/\/$/, "") : "";
  }
  function headerLinks() {
    var out = [];
    var all = document.querySelectorAll("header a[href]");
    for (var i = 0; i < all.length; i++) if (!all[i].hasAttribute(MARK)) out.push(all[i]);
    return out;
  }
  function link(className) {
    var a = document.createElement("a");
    a.setAttribute("href", HREF);
    a.textContent = "Статьи";
    a.className = className;
    return a;
  }
  function remove(el) {
    if (el.parentNode) el.parentNode.removeChild(el);
  }

  function sync() {
    var configs = [];
    var catalogs = [];
    var groups = [];
    headerLinks().forEach(function (a) {
      var p = path(a);
      if (p === "/configurators" && text(a) === "Конфигураторы") configs.push(a);
      else if (p === "/catalog" && text(a) === "Каталог") catalogs.push(a);
      else if (p.indexOf("/configurators/") === 0 && groups.indexOf(a.parentNode) < 0) groups.push(a.parentNode);
    });
    var desktop = configs.length > 0;

    // десктоп: «Статьи» сразу после «Конфигураторы»
    var own = document.querySelectorAll("a[" + MARK + '="desktop"]');
    for (var i = 0; i < own.length; i++) if (configs.indexOf(own[i].previousElementSibling) < 0) remove(own[i]);
    var onConfigurators = /^\/configurators(\/|$)/.test(location.pathname);
    configs.forEach(function (cfg) {
      var next = cfg.nextElementSibling;
      var item = next && next.getAttribute(MARK) === "desktop" ? next : null;
      // на страницах конфигураторов «Конфигураторы» может быть выделен как активный — оформление берём у «Каталог»
      var source = cfg;
      if (onConfigurators) for (var j = 0; j < catalogs.length; j++) if (catalogs[j].parentNode === cfg.parentNode) source = catalogs[j];
      if (!item) {
        item = link(source.className);
        item.setAttribute(MARK, "desktop");
        cfg.parentNode.insertBefore(item, cfg.nextSibling);
      } else if (item.className !== source.className) item.className = source.className;
    });

    // мобильное меню: разделитель и группа «Статьи» после группы ссылок конфигураторов
    var blocks = document.querySelectorAll("[" + MARK + '="mobile"]');
    for (var k = 0; k < blocks.length; k++) {
      var prevEl = blocks[k].previousElementSibling;
      var anchor = prevEl && prevEl.getAttribute(MARK) === "mobile-sep" ? prevEl.previousElementSibling : null;
      if (desktop || groups.indexOf(anchor) < 0) {
        if (prevEl && prevEl.getAttribute(MARK) === "mobile-sep") remove(prevEl);
        remove(blocks[k]);
      }
    }
    if (!desktop) {
      groups.forEach(function (group) {
        var n1 = group.nextElementSibling;
        if (n1 && n1.getAttribute(MARK) === "mobile-sep") return;
        var sample = group.querySelector("a[href]");
        // разделитель — как между рубриками каталога и конфигураторами (пустой элемент перед группой)
        var before = group.previousElementSibling;
        var sep = before && !before.children.length && !text(before) ? before.cloneNode(false) : document.createElement("div");
        sep.setAttribute(MARK, "mobile-sep");
        var box = group.cloneNode(false);
        box.setAttribute(MARK, "mobile");
        box.appendChild(link(sample ? sample.className : ""));
        group.parentNode.insertBefore(box, group.nextSibling);
        group.parentNode.insertBefore(sep, box);
      });
    }

    if (configs.length || groups.length) {
      var pre = document.querySelectorAll("[data-unitr-prenav]");
      for (var m = 0; m < pre.length; m++) remove(pre[m]);
    }
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || setTimeout)(function () {
      scheduled = false;
      sync();
    });
  }

  function start() {
    sync();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
