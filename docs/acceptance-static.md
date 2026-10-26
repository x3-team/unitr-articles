# Проверка критериев приёмки — http://localhost:8095

Режим: **боевой статический (Apache)** · 2026-10-26T20:31:28.624Z · проверок: 54, не пройдено: 0


## 1.1 Страница архива /articles/

| | Проверка | Детали |
|---|---|---|
| ✅ | /articles/ открывается (HTTP 200) | HTTP 200 |
| ✅ | H1 «Статьи» в исходном HTML | ["Статьи"] |
| ✅ | 10 анонсов на первой странице | анонсов: 10 |
| ✅ | Заголовки статей со ссылками (без JS) | ссылок на статьи: 10 |
| ✅ | Анонс: обложка, excerpt, дата |  |
| ✅ | canonical /articles/ → на себя | http://localhost:8095/articles/ |
| ✅ | Пагинация: номера страниц и «Следующая» |  |
| ✅ | <link rel=next> на /articles/page/2/ | http://localhost:8095/articles/page/2/ |
| ✅ | Собственный title, отличный от главной | «Статьи о телекоммуникационном оборудовании — полезные материалы \| Юнит-Ресурс» vs главная «Юнит-Ресурс — главная» |
| ✅ | Собственный meta description, отличный от главной | Полезные статьи инженеров Юнит-Ресурс: выбор серверных и телекоммуникационных шкафов, PDU и ИБП, кабельные системы, охлаждение и проектирование серверных. |
| ✅ | Хлебные крошки в HTML + Schema.org BreadcrumbList | Главная › Статьи |
| ✅ | /articles/page/2/: 200 и canonical на себя | HTTP 200, canonical http://localhost:8095/articles/page/2/ |
| ✅ | /articles/page/2/: title и description уникальны | Статьи — страница 2 \| Юнит-Ресурс |
| ✅ | /articles/page/2/: «Предыдущая» и rel=prev | http://localhost:8095/articles/ |
| ✅ | /articles/page/2/: H1 «Статьи» |  |
| ✅ | Последняя страница без пустых мест (анонсов: 3) |  |
| ✅ | Страница пагинации за пределами (/page/3/) → 404 | HTTP 404 |

## 1.2 Страница статьи /articles/<slug>/

| | Проверка | Детали |
|---|---|---|
| ✅ | Все статьи (13): 200, полный текст и H2/H3 в HTML, title, description, canonical на себя, Article, Open Graph, крошки, пред./след., латинский ЧПУ | OK: 13 |
| ✅ | Пример Article (первая статья) | headline: Статья для проверки Apache 13; datePublished: 2026-01-14T00:00:00.000Z; dateModified: 2026-01-14T00:00:00.000Z; author: Инженер Юнит-Ресурс; image: https://manage.unitr.ru/wp-content/uploads/cover-13.jpg; og:image: https://manage.unitr.ru/wp-content/uploads/cover-13.jpg |

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
| ✅ | Кеш HTML архива ≤ 900 с (Cache-Control) | public, max-age=300, must-revalidate |
| ✅ | Кеш sitemap.xml ≤ 900 с | public, max-age=300, must-revalidate |
| ✅ | Обновление: пересборка и выкладка каждые 10 минут (.github/workflows/deploy-static.yml) |  |
| ✅ | Снятая с публикации (черновик) отсутствует в разделе |  |

## 4 Карта сайта и индексация

| | Проверка | Детали |
|---|---|---|
| ✅ | /sitemap.xml → HTTP 200 | HTTP 200 |
| ✅ | Content-Type: application/xml | application/xml |
| ✅ | В карте: главная |  |
| ✅ | В карте: страницы каталога | 1 адресов |
| ✅ | В карте: раздел /articles/ |  |
| ✅ | В карте: все статьи (13) |  |
| ✅ | В карте: страницы пагинации | 1 стр. |
| ✅ | <lastmod> у каждого адреса | 18/18 |
| ✅ | Черновик отсутствует в карте |  |
| ✅ | В карте только существующие адреса (выборочно 5) |  |
| ✅ | /robots.txt → 200 | http://localhost:8095/robots.txt: HTTP 200 |
| ✅ | robots.txt: адрес карты сайта | Sitemap: http://localhost:8095/sitemap.xml |
| ✅ | robots.txt: явное Allow для /articles/ |  |
| ✅ | robots.txt: нет запретов для /articles/ | Disallow: /api/, /search |
| ✅ | Нет noindex (meta robots и X-Robots-Tag) на страницах раздела | all / index, follow; all / index, follow; all / index, follow; all / index, follow |

## 5 Маршрутизация, ошибки, безопасность

| | Проверка | Детали |
|---|---|---|
| ✅ | /articles/takoj-stati-net-xyz/ → 404 со страницей ошибки | HTTP 404 |
| ✅ | /articles/page/0/ → 404 со страницей ошибки | HTTP 404 |
| ✅ | /articles/category/nesushhestvuyushhaya/ → 404 со страницей ошибки | HTTP 404 |
| ✅ | /blog → 301 /articles/ | HTTP 301 → http://localhost:8095/articles/ |
| ✅ | /blog/ → 301 /articles/ | HTTP 301 → http://localhost:8095/articles/ |
| ✅ | /poleznye-stati → 301 /articles/ | HTTP 301 → http://localhost:8095/articles/ |
| ✅ | /poleznye-stati/ → 301 /articles/ | HTTP 301 → http://localhost:8095/articles/ |
| ✅ | /blog/statya-13/ → 301 на статью (адрес сохраняется) | HTTP 301 → http://localhost:8095/articles/statya-13/ |
| ✅ | /poleznye-stati/statya-13 → 301 на статью (адрес сохраняется) | HTTP 301 → http://localhost:8095/articles/statya-13/ |
| ✅ | /articles (без слеша) → 301 /articles/ | HTTP 301 → http://localhost:8095/articles/ |
| ✅ | /articles/page/1/ → 301 /articles/ (нет дубля) | HTTP 301 → http://localhost:8095/articles/ |
| ✅ | GraphQL-токен и адрес WP не попадают в клиентский код (проверено JS-файлов: 7) | чисто |
