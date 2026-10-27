/*
 * Пункт «Статьи» в шапке SPA unitr.ru (ТЗ, п. 2) — без пересборки SPA.
 * Подключается в index.html сайта блоком «unitr-articles» (scripts/merge-spa-index.mjs при выкладке раздела).
 *
 * Рядом с каждой ссылкой «Конфигураторы» (десктоп и мобильное меню) ставится ссылка «Статьи» → /articles/
 * с теми же классами оформления. Шапка SPA перерисовывается при переходах и открытии меню — пункт
 * восстанавливается при каждом изменении DOM. Обычная ссылка: переход в раздел — полной загрузкой страницы,
 * HTML раздела отдаёт веб-сервер (SSR/пререндер), а не SPA.
 * Запасная навигация из исходного HTML (data-unitr-prenav, для роботов без JS) убирается после отрисовки шапки.
 */
(function () {
  var HREF = "/articles/";
  var MARK = "data-unitr-articles";

  function text(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }
  function isLink(a, path, label) {
    return text(a) === label && a.host === location.host && a.pathname.replace(/\/$/, "") === path;
  }

  function sync() {
    var links = document.querySelectorAll("a[href]");
    var configs = [];
    var catalogs = [];
    for (var i = 0; i < links.length; i++) {
      if (links[i].hasAttribute(MARK) || links[i].closest("[data-unitr-prenav]")) continue;
      if (isLink(links[i], "/configurators", "Конфигураторы")) configs.push(links[i]);
      else if (isLink(links[i], "/catalog", "Каталог")) catalogs.push(links[i]);
    }
    // пункт, оставшийся без соседа после перерисовки шапки, убираем (новый поставится рядом с новым «Конфигураторы»)
    var own = document.querySelectorAll("a[" + MARK + "]");
    for (var o = 0; o < own.length; o++) {
      var prev = own[o].previousElementSibling;
      if (!prev || configs.indexOf(prev) < 0) own[o].parentNode.removeChild(own[o]);
    }
    var onConfigurators = /^\/configurators(\/|$)/.test(location.pathname);
    configs.forEach(function (cfg) {
      var next = cfg.nextElementSibling;
      var item = next && next.hasAttribute(MARK) ? next : null;
      // оформление — как у соседнего пункта; на страницах конфигураторов «Конфигураторы» может быть
      // выделен как активный, тогда берём оформление «Каталог» из того же меню
      var source = cfg;
      if (onConfigurators) {
        for (var j = 0; j < catalogs.length; j++) if (catalogs[j].parentNode === cfg.parentNode) source = catalogs[j];
      }
      if (!item) {
        item = document.createElement("a");
        item.setAttribute(MARK, "");
        item.setAttribute("href", HREF);
        item.textContent = "Статьи";
        cfg.parentNode.insertBefore(item, cfg.nextSibling);
      }
      if (item.className !== source.className) item.className = source.className;
    });
    if (configs.length) {
      var pre = document.querySelectorAll("[data-unitr-prenav]");
      for (var k = 0; k < pre.length; k++) pre[k].parentNode.removeChild(pre[k]);
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
