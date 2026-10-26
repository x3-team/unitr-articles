# Проверка критериев приёмки — http://localhost:3100

Режим: **боевой (Node.js SSR)** · 2026-10-26T20:34:45.643Z · проверок: 54, не пройдено: 0


## 1.1 Страница архива /articles/

| | Проверка | Детали |
|---|---|---|
| ✅ | /articles/ открывается (HTTP 200) | HTTP 200 |
| ✅ | H1 «Статьи» в исходном HTML | ["Статьи"] |
| ✅ | 10 анонсов на первой странице | анонсов: 10 |
| ✅ | Заголовки статей со ссылками (без JS) | ссылок на статьи: 10 |
| ✅ | Анонс: обложка, excerpt, дата |  |
| ✅ | canonical /articles/ → на себя | http://localhost:3100/articles/ |
| ✅ | Пагинация: номера страниц и «Следующая» |  |
| ✅ | <link rel=next> на /articles/page/2/ | http://localhost:3100/articles/page/2/ |
| ✅ | Собственный title, отличный от главной | «Статьи о телекоммуникационном оборудовании — полезные материалы \| Юнит-Ресурс» vs главная «Юнит-Ресурс — главная» |
| ✅ | Собственный meta description, отличный от главной | Полезные статьи инженеров Юнит-Ресурс: выбор серверных и телекоммуникационных шкафов, PDU и ИБП, кабельные системы, охлаждение и проектирование серверных. |
| ✅ | Хлебные крошки в HTML + Schema.org BreadcrumbList | Главная › Статьи |
| ✅ | /articles/page/2/: 200 и canonical на себя | HTTP 200, canonical http://localhost:3100/articles/page/2/ |
| ✅ | /articles/page/2/: title и description уникальны | Статьи — страница 2 \| Юнит-Ресурс |
| ✅ | /articles/page/2/: «Предыдущая» и rel=prev | http://localhost:3100/articles/ |
| ✅ | /articles/page/2/: H1 «Статьи» |  |
| ✅ | Последняя страница без пустых мест (анонсов: 2) |  |
| ✅ | Страница пагинации за пределами (/page/3/) → 404 | HTTP 404 |

## 1.2 Страница статьи /articles/<slug>/

| | Проверка | Детали |
|---|---|---|
| ✅ | Все статьи (12): 200, полный текст и H2/H3 в HTML, title, description, canonical на себя, Article, Open Graph, крошки, пред./след., латинский ЧПУ | OK: 12 |
| ✅ | Пример Article (первая статья) | headline: Патч-панели: категория и экранирование; datePublished: 2026-01-13T00:00:00.000Z; dateModified: 2026-01-13T00:00:00.000Z; author: Инженер Юнит-Ресурс; image: https://manage.unitr.ru/wp-content/uploads/cover-12.jpg; og:image: https://manage.unitr.ru/wp-content/uploads/cover-12.jpg |

## 2 Пункт «Статьи» в меню

| | Проверка | Детали |
|---|---|---|
| ✅ | Десктоп: «Статьи» рядом с «Каталог» и «Конфигураторы», ссылка в серверном HTML |  |
| ✅ | Мобильное меню: ссылка «Статьи» в серверном HTML (открывается без JS) |  |
| ✅ | Активный пункт выделен в разделе (aria-current + is-active) |  |
| ✅ | Пункт активен и на странице статьи |  |

## 3 Автообновление и кеш (≤ 15 минут)

| | Проверка | Детали |
|---|---|---|
| ✅ | Кеш HTML архива ≤ 900 с (Cache-Control) | s-maxage=300, stale-while-revalidate=31535700 |
| ✅ | Кеш sitemap.xml ≤ 900 с | s-maxage=300, stale-while-revalidate=31535700 |
| ✅ | Вебхук ревалидации существует и защищён секретом (без секрета → 401) | HTTP 401 |
| ✅ | Снятая с публикации (черновик) отсутствует в разделе |  |

## 4 Карта сайта и индексация

| | Проверка | Детали |
|---|---|---|
| ✅ | /sitemap.xml → HTTP 200 | HTTP 200 |
| ✅ | Content-Type: application/xml | application/xml; charset=utf-8 |
| ✅ | В карте: главная |  |
| ✅ | В карте: страницы каталога | 1 адресов |
| ✅ | В карте: раздел /articles/ |  |
| ✅ | В карте: все статьи (12) |  |
| ✅ | В карте: страницы пагинации | 1 стр. |
| ✅ | <lastmod> у каждого адреса | 18/18 |
| ✅ | Черновик отсутствует в карте |  |
| ✅ | В карте только существующие адреса (выборочно 5) |  |
| ✅ | /robots.txt → 200 | http://localhost:3100/robots.txt: HTTP 200 |
| ✅ | robots.txt: адрес карты сайта | Sitemap: http://localhost:3100/sitemap.xml |
| ✅ | robots.txt: явное Allow для /articles/ |  |
| ✅ | robots.txt: нет запретов для /articles/ | Disallow: /api/ |
| ✅ | Нет noindex (meta robots и X-Robots-Tag) на страницах раздела | all / index, follow; all / index, follow; all / index, follow; all / index, follow |

## 5 Маршрутизация, ошибки, безопасность

| | Проверка | Детали |
|---|---|---|
| ✅ | /articles/takoj-stati-net-xyz/ → 404 со страницей ошибки | HTTP 404 |
| ✅ | /articles/page/0/ → 404 со страницей ошибки | HTTP 404 |
| ✅ | /articles/category/nesushhestvuyushhaya/ → 404 со страницей ошибки | HTTP 404 |
| ✅ | /blog → 301 /articles/ | HTTP 301 → http://localhost:3100/articles/ |
| ✅ | /blog/ → 301 /articles/ | HTTP 301 → http://localhost:3100/articles/ |
| ✅ | /poleznye-stati → 301 /articles/ | HTTP 301 → http://localhost:3100/articles/ |
| ✅ | /poleznye-stati/ → 301 /articles/ | HTTP 301 → http://localhost:3100/articles/ |
| ✅ | /blog/statya-12/ → 301 на статью (адрес сохраняется) | HTTP 301 → http://localhost:3100/articles/statya-12/ |
| ✅ | /poleznye-stati/statya-12 → 301 на статью (адрес сохраняется) | HTTP 301 → http://localhost:3100/articles/statya-12/ |
| ✅ | /articles (без слеша) → 301 /articles/ | HTTP 301 → http://localhost:3100/articles/ |
| ✅ | /articles/page/1/ → 301 /articles/ (нет дубля) | HTTP 301 → http://localhost:3100/articles/ |
| ✅ | GraphQL-токен и адрес WP не попадают в клиентский код (проверено JS-файлов: 7) | чисто |
