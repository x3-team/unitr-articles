<?php
/**
 * Проверка WP-плагина в настоящем WordPress (без WPGraphQL): запускается tests/wp/run-wp-smoke.mjs
 * через WordPress Playground после активации плагина. Пишет результаты в файл, путь — первый аргумент
 * или константа UNITR_SMOKE_OUT.
 */

$results = array();
$ok      = function ( $cond, $msg, $extra = '' ) use ( &$results ) {
	$results[] = ( $cond ? '✅ ' : '❌ ' ) . $msg . ( $cond || '' === $extra ? '' : ' — ' . ( is_string( $extra ) ? $extra : wp_json_encode( $extra, JSON_UNESCAPED_UNICODE ) ) );
};

// все исходящие HTTP-запросы перехватываются и записываются
$requests = array();
add_filter(
	'pre_http_request',
	function ( $pre, $args, $url ) use ( &$requests ) {
		$requests[] = array( 'url' => $url, 'args' => $args );
		return array( 'headers' => array(), 'body' => 'ok', 'response' => array( 'code' => false !== strpos( $url, 'api.github.com' ) ? 204 : 200, 'message' => 'OK' ), 'cookies' => array() );
	},
	10,
	3
);

wp_set_current_user( 1 );

$ok( is_plugin_active( 'unitr-articles/unitr-articles.php' ), 'Плагин активирован в WordPress ' . get_bloginfo( 'version' ) );

// 1. Рубрика и настройки по умолчанию
$term = get_term_by( 'slug', 'poleznye-stati', 'category' );
$ok( $term && 'Полезные статьи' === $term->name, 'Рубрика «Полезные статьи» (poleznye-stati) создана при активации' );
$opts = get_option( UNITR_ARTICLES_OPTION );
$ok( 10 === (int) $opts['per_page'] && 'https://unitr.ru' === $opts['frontend_url'] && strlen( $opts['secret'] ) >= 32, 'Настройки по умолчанию: 10 анонсов, https://unitr.ru, секрет вебхука сгенерирован', $opts );
$ok( empty( $opts['rewrite_links'] ), 'Ссылки «Просмотреть» на сайт выключены до запуска раздела' );
$ok( post_type_supports( 'post', 'excerpt' ) && post_type_supports( 'post', 'thumbnail' ), 'У записей есть «Отрывок» и «Изображение записи»' );

// 2. Латинский ЧПУ из кириллического заголовка
$sub = wp_insert_term( 'Шкафы', 'category', array( 'slug' => 'shkafy', 'parent' => $term->term_id ) );
$GLOBALS['unitr_articles_revalidate_reasons'] = array();
$id  = wp_insert_post(
	array(
		'post_title'    => 'Как выбрать серверный шкаф: 7 параметров',
		'post_content'  => '<h2>Раздел</h2><p>Текст</p>',
		'post_excerpt'  => 'Анонс статьи',
		'post_status'   => 'publish',
		'post_category' => array( $sub['term_id'] ),
	)
);
$slug = get_post_field( 'post_name', $id );
$ok( 'kak-vybrat-servernyy-shkaf-7-parametrov' === $slug, 'Кириллический заголовок → латинский ЧПУ', $slug );
$ok( unitr_articles_is_article( $id ), 'Запись подрубрики относится к разделу «Статьи»' );
$id3 = wp_insert_post( array( 'post_title' => 'Заземление шкафа', 'post_status' => 'publish', 'post_name' => 'Заземление-ТШ', 'post_category' => array( $term->term_id ) ) );
$ok( 'zazemlenie-tsh' === get_post_field( 'post_name', $id3 ), 'Кириллический адрес статьи, введённый вручную, переводится в латиницу', get_post_field( 'post_name', $id3 ) );
$id2 = wp_insert_post( array( 'post_title' => 'Новости компании', 'post_status' => 'publish', 'post_name' => 'Новости' ) );
$ok( 'новости' === urldecode( get_post_field( 'post_name', $id2 ) ), 'Адреса записей вне раздела не меняются (их может использовать основной сайт)', urldecode( get_post_field( 'post_name', $id2 ) ) );
$ok( ! unitr_articles_is_article( $id2 ), 'Запись вне рубрики не относится к разделу' );
// блочный редактор: запись публикуется, рубрика сохраняется следующим шагом
$id4 = wp_insert_post( array( 'post_title' => 'Холодный коридор в серверной: как организовать', 'post_status' => 'publish' ) );
wp_set_post_categories( $id4, array( $term->term_id ) );
wp_update_post( array( 'ID' => $id4 ) );
$ok( 'holodnyj-koridor-v-servernoj-kak-organizovat' === get_post_field( 'post_name', $id4 ), 'Рубрика, сохранённая после публикации (блочный редактор): адрес латинский при следующем сохранении', get_post_field( 'post_name', $id4 ) );

// 3. Очередь вебхука: публикация статьи
$reasons = $GLOBALS['unitr_articles_revalidate_reasons'];
$ok( (bool) preg_grep( '/^status:' . $id . ':new->publish$/', $reasons ), 'Публикация статьи ставит в очередь обновление сайта', $reasons );

// 4. SEO-поля и запасные источники
update_post_meta( $id, '_yoast_wpseo_metadesc', 'Описание из Yoast' );
$seo = unitr_articles_seo( $id );
$ok( '' === $seo['title'] && 'Описание из Yoast' === $seo['description'], 'SEO: пустые поля раздела → значения Yoast', $seo );
update_post_meta( $id, UNITR_SEO_TITLE_KEY, 'SEO-заголовок статьи' );
update_post_meta( $id, UNITR_SEO_DESC_KEY, 'SEO-описание статьи' );
update_post_meta( $id, '_yoast_wpseo_title', '%%title%% %%sep%% %%sitename%%' );
$seo = unitr_articles_seo( $id );
$ok( 'SEO-заголовок статьи' === $seo['title'] && 'SEO-описание статьи' === $seo['description'], 'SEO: поля раздела имеют приоритет', $seo );
$missing = unitr_articles_missing( $id );
$ok( in_array( 'обложка', array_map( 'mb_strtolower', $missing ), true ) || (bool) preg_grep( '/обложк/u', $missing ), 'Проверка заполненности: без обложки статья помечается', $missing );

// 5. Отправка вебхука на сайт (Node.js-вариант)
$requests = array();
$GLOBALS['unitr_articles_revalidate_reasons'] = array( 'test' );
$res = unitr_articles_send_revalidate( true );
$front = array_values( array_filter( $requests, fn( $r ) => 'https://unitr.ru/api/revalidate/' === $r['url'] ) );
$ok( 1 === count( $front ) && $opts['secret'] === $front[0]['args']['headers']['X-Revalidate-Secret'], 'Вебхук: POST https://unitr.ru/api/revalidate/ с секретом', array_column( $requests, 'url' ) );
$ok( 1 === count( $requests ), 'Без настроек GitHub запрос в GitHub не отправляется' );

// 6. Настройки: сохранение через форму (sanitize)
update_option( UNITR_ARTICLES_OPTION, array( 'per_page' => '500', 'frontend_url' => 'https://unitr.ru/', 'secret' => 's3cret', 'rewrite_links' => '1', 'github_repo' => 'x3-team/unitr-articles', 'github_token' => 'github_pat_TEST' ) );
$ok( 100 === unitr_articles_per_page(), 'Количество анонсов ограничено 1…100', unitr_articles_per_page() );
update_option( UNITR_ARTICLES_OPTION, array_merge( get_option( UNITR_ARTICLES_OPTION ), array( 'per_page' => '12', 'github_token' => '' ) ) );
$ok( 12 === unitr_articles_per_page() && 'github_pat_TEST' === unitr_articles_github_token(), 'Пустое поле токена не стирает сохранённый токен; количество анонсов меняется без кода' );
$ok( 'https://unitr.ru' === unitr_articles_frontend_url(), 'Адрес сайта без слеша в конце', unitr_articles_frontend_url() );

// 7. Пересборка в GitHub Actions (статический вариант)
$requests = array();
$GLOBALS['unitr_articles_revalidate_reasons'] = array( 'status:1:draft->publish' );
unitr_articles_send_revalidate( true );
$gh = array_values( array_filter( $requests, fn( $r ) => 'https://api.github.com/repos/x3-team/unitr-articles/dispatches' === $r['url'] ) );
$body = $gh ? json_decode( $gh[0]['args']['body'], true ) : null;
$ok( $gh && 'Bearer github_pat_TEST' === $gh[0]['args']['headers']['Authorization'] && 'wp-content-changed' === $body['event_type'], 'GitHub: repository_dispatch «wp-content-changed» с токеном', array_column( $requests, 'url' ) );
$ok( 2 === count( $requests ), 'При обоих способах уходят оба запроса (сайт и GitHub)' );

// 8. Ссылка «Просмотреть» на сайт
clean_post_cache( $id );
$ok( 'https://unitr.ru/articles/kak-vybrat-servernyy-shkaf-7-parametrov/' === get_permalink( $id ), 'Ссылка «Просмотреть» ведёт на unitr.ru/articles/<адрес>/', get_permalink( $id ) );
$ok( false === strpos( get_permalink( $id2 ), 'unitr.ru/articles' ), 'Записи вне раздела ссылаются как раньше' );

// 9. Снятие с публикации и изменение рубрик ставят обновление в очередь
$GLOBALS['unitr_articles_revalidate_reasons'] = array();
wp_update_post( array( 'ID' => $id, 'post_status' => 'draft' ) );
$ok( (bool) preg_grep( '/^status:' . $id . ':publish->draft$/', $GLOBALS['unitr_articles_revalidate_reasons'] ), 'Снятие с публикации ставит в очередь обновление сайта', $GLOBALS['unitr_articles_revalidate_reasons'] );
$GLOBALS['unitr_articles_revalidate_reasons'] = array();
wp_insert_term( 'Электропитание', 'category', array( 'parent' => $term->term_id ) );
$ok( (bool) preg_grep( '/^category:/', $GLOBALS['unitr_articles_revalidate_reasons'] ), 'Новая подрубрика ставит в очередь обновление сайта' );

// 10. Страницы админки и проверка без фатальных ошибок
$checks = unitr_articles_run_checks();
$flat   = wp_json_encode( $checks, JSON_UNESCAPED_UNICODE );
$ok( is_array( $checks ) && false !== mb_strpos( $flat, 'WPGraphQL' ), 'Инструменты → Проверка: выполняется, отсутствие WPGraphQL отмечено', $flat );
ob_start();
unitr_articles_render_settings();
$html = ob_get_clean();
$ok( false !== strpos( $html, 'Анонсов на странице' ) && false !== strpos( $html, 'Репозиторий GitHub' ) && false === strpos( $html, 'github_pat_TEST' ), 'Настройки → Раздел «Статьи»: страница выводится, токен в HTML не попадает' );
ob_start();
unitr_articles_render_check();
$html = ob_get_clean();
$ok( false !== strpos( $html, 'Проверка раздела' ), 'Инструменты → Проверка раздела «Статьи»: страница выводится' );

$out = defined( 'UNITR_SMOKE_OUT' ) ? UNITR_SMOKE_OUT : '/smoke/result.txt';
file_put_contents( $out, implode( "\n", $results ) . "\n" );
echo implode( "\n", $results ) . "\n";
