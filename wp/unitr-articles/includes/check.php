<?php
/**
 * Инструменты → Проверка раздела «Статьи» и команда WP-CLI `wp unitr-articles check`.
 * Проверяет: WPGraphQL, ACF / WPGraphQL for ACF, рубрику, выполнение того же GraphQL-запроса,
 * что делает фронтенд, заполненность обложек/анонсов/SEO, настройки и вебхук.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Тот же запрос, что выполняет фронтенд (src/lib/content/graphql.ts) */
function unitr_articles_frontend_query() {
	return 'query UnitrArticles($category: String!, $after: String) {
		posts(first: 100, after: $after, where: { categoryName: $category, status: PUBLISH, orderby: [{ field: DATE, order: DESC }] }) {
			pageInfo { hasNextPage endCursor }
			nodes {
				id databaseId slug title excerpt content dateGmt modifiedGmt
				author { node { name } }
				featuredImage { node { sourceUrl altText mediaDetails { width height } } }
				categories { nodes { slug name } }
				unitrSeo { title description }
				unitrOldSlugs
			}
		}
		unitrArticlesSettings { perPage category frontendUrl }
	}';
}

/**
 * @return array<int, array{status: string, title: string, details: string}>
 */
function unitr_articles_run_checks() {
	$r   = array();
	$add = function ( $status, $title, $details = '' ) use ( &$r ) {
		$r[] = array( 'status' => $status, 'title' => $title, 'details' => $details );
	};

	// 1. Плагины
	$has_graphql = function_exists( 'graphql' ) && class_exists( 'WPGraphQL' );
	$add( $has_graphql ? 'ok' : 'error', 'WPGraphQL активен', $has_graphql ? 'Эндпоинт: ' . esc_url( home_url( '/graphql' ) ) : 'Установите и активируйте плагин WPGraphQL' );

	$has_acf = function_exists( 'acf_add_local_field_group' );
	$add( $has_acf ? 'ok' : 'info', 'ACF', $has_acf ? 'Поля SEO зарегистрированы группой ACF «SEO для раздела «Статьи»»' : 'ACF не активен — поля SEO выводятся собственным блоком в редакторе (это допустимо)' );
	if ( $has_acf ) {
		$has_wpgql_acf = class_exists( 'WPGraphQL\\Acf\\WPGraphQLAcf' ) || class_exists( 'WPGraphQL_ACF' ) || defined( 'WPGRAPHQL_FOR_ACF_VERSION' );
		$add( $has_wpgql_acf ? 'ok' : 'info', 'WPGraphQL for ACF', $has_wpgql_acf ? 'Группа полей доступна в GraphQL как Post.unitrSeoFields' : 'Не обязателен: фронтенд читает SEO через поле Post.unitrSeo этого плагина' );
	}

	// 2. Рубрика
	$term = get_term_by( 'slug', UNITR_ARTICLES_CATEGORY, 'category' );
	if ( $term ) {
		$children = get_term_children( (int) $term->term_id, 'category' );
		$add( 'ok', 'Рубрика ' . UNITR_ARTICLES_CATEGORY, sprintf( '«%s», опубликованных записей: %d, подрубрик: %d', $term->name, (int) $term->count, is_array( $children ) ? count( $children ) : 0 ) );
	} else {
		$add( 'error', 'Рубрика ' . UNITR_ARTICLES_CATEGORY, 'Не найдена. Деактивируйте и снова активируйте плагин — рубрика будет создана.' );
	}

	// 3. Запрос фронтенда
	if ( $has_graphql ) {
		$res = graphql(
			array(
				'query'     => unitr_articles_frontend_query(),
				'variables' => array( 'category' => UNITR_ARTICLES_CATEGORY ),
			)
		);
		if ( ! empty( $res['errors'] ) ) {
			$add( 'error', 'GraphQL-запрос фронтенда', implode( '; ', wp_list_pluck( $res['errors'], 'message' ) ) );
		} else {
			$nodes = $res['data']['posts']['nodes'] ?? array();
			$add( 'ok', 'GraphQL-запрос фронтенда', sprintf( 'Получено статей: %d (первые 100). Анонсов на странице: %d', count( $nodes ), (int) ( $res['data']['unitrArticlesSettings']['perPage'] ?? 0 ) ) );
			$non_latin = array();
			foreach ( $nodes as $n ) {
				if ( ! preg_match( '/^[a-z0-9-]+$/', urldecode( $n['slug'] ) ) ) {
					$non_latin[] = $n['title'];
				}
			}
			$add( $non_latin ? 'warn' : 'ok', 'Латинские адреса (ЧПУ)', $non_latin ? 'Нелатинский адрес у: ' . implode( '; ', array_slice( $non_latin, 0, 10 ) ) . '. Пересохраните записи — адрес будет построен транслитерацией.' : 'У всех статей латинские адреса' );
		}

		// Публичный (неавторизованный) доступ к GraphQL не обязателен: фронтенд ходит с токеном
		$add( 'info', 'Доступ фронтенда', 'Фронтенд обращается к ' . esc_url( home_url( '/graphql' ) ) . ' с сервера, с токеном (Application Password). Создайте пароль приложения: Пользователи → Профиль → Пароли приложений; значение «логин:пароль» укажите в WP_GRAPHQL_TOKEN на сервере сайта.' );
	}

	// 4. Заполненность статей
	if ( $term ) {
		$posts = get_posts(
			array(
				'post_type'      => 'post',
				'post_status'    => 'publish',
				'posts_per_page' => 500,
				'category__in'   => unitr_articles_category_ids(),
				'fields'         => 'ids',
			)
		);
		$problems = array();
		foreach ( $posts as $pid ) {
			$m = unitr_articles_missing( $pid );
			if ( $m ) {
				$problems[] = sprintf( '«%s» (ID %d): %s', get_the_title( $pid ), $pid, implode( ', ', $m ) );
			}
		}
		$add( $problems ? 'warn' : 'ok', 'Обложки, анонсы, SEO', $problems ? implode( "\n", array_slice( $problems, 0, 30 ) ) : 'У всех опубликованных статей заполнены обложка, анонс, SEO title и description' );
	}

	// 5. Настройки и вебхук
	$front  = unitr_articles_frontend_url();
	$secret = unitr_articles_secret();
	$add( $front ? 'ok' : 'error', 'Адрес сайта', $front ? $front : 'Не задан (Настройки → Раздел «Статьи» или UNITR_FRONTEND_URL)' );
	$add( $secret ? 'ok' : 'warn', 'Секрет вебхука', $secret ? 'Задан' : 'Не задан — сайт обновится только по истечении кеша (≤ 15 минут)' );
	$add( function_exists( 'wp_remote_post' ) ? 'ok' : 'error', 'Отправка вебхука', 'Срабатывает при публикации, изменении, снятии с публикации, удалении статей и изменении рубрик' );
	return $r;
}

add_action(
	'admin_menu',
	function () {
		add_management_page( 'Проверка раздела «Статьи»', 'Проверка раздела «Статьи»', 'manage_options', 'unitr-articles-check', 'unitr_articles_render_check' );
	}
);

function unitr_articles_render_check() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$webhook_result = null;
	if ( isset( $_POST['unitr_test_webhook'] ) && check_admin_referer( 'unitr_test_webhook' ) ) {
		$GLOBALS['unitr_articles_revalidate_reasons'] = array( 'manual-test' );
		$res = unitr_articles_send_revalidate( true );
		$webhook_result = is_wp_error( $res )
			? array( 'error', $res->get_error_message() )
			: array( 200 === (int) wp_remote_retrieve_response_code( $res ) ? 'ok' : 'error', 'HTTP ' . wp_remote_retrieve_response_code( $res ) . ': ' . wp_remote_retrieve_body( $res ) );
	}
	$icons = array( 'ok' => '✅', 'warn' => '⚠️', 'error' => '❌', 'info' => 'ℹ️' );
	?>
	<div class="wrap">
		<h1>Проверка раздела «Статьи»</h1>
		<table class="widefat striped" style="max-width:1100px">
			<tbody>
			<?php foreach ( unitr_articles_run_checks() as $c ) : ?>
				<tr>
					<td style="width:28px"><?php echo esc_html( $icons[ $c['status'] ] ); ?></td>
					<td style="width:260px"><strong><?php echo esc_html( $c['title'] ); ?></strong></td>
					<td><?php echo nl2br( esc_html( $c['details'] ) ); ?></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>
		<h2>Вебхук ревалидации</h2>
		<form method="post">
			<?php wp_nonce_field( 'unitr_test_webhook' ); ?>
			<p>Отправить тестовый запрос на <code><?php echo esc_html( unitr_articles_frontend_url() . '/api/revalidate/' ); ?></code> — сайт сбросит кеш раздела и карты сайта.</p>
			<?php submit_button( 'Отправить тестовый вебхук', 'secondary', 'unitr_test_webhook', false ); ?>
		</form>
		<?php if ( $webhook_result ) : ?>
			<p><?php echo esc_html( $icons[ $webhook_result[0] ] . ' ' . $webhook_result[1] ); ?></p>
		<?php endif; ?>
	</div>
	<?php
}

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	/**
	 * wp unitr-articles check   — проверка раздела (код возврата 1 при ошибках)
	 * wp unitr-articles setup   — создать рубрику и настройки по умолчанию
	 * wp unitr-articles webhook — отправить тестовый вебхук
	 */
	WP_CLI::add_command(
		'unitr-articles',
		new class() {
			public function check() {
				$failed = false;
				foreach ( unitr_articles_run_checks() as $c ) {
					WP_CLI::log( sprintf( '[%s] %s — %s', strtoupper( $c['status'] ), $c['title'], str_replace( "\n", ' | ', $c['details'] ) ) );
					$failed = $failed || 'error' === $c['status'];
				}
				$failed ? WP_CLI::error( 'Есть ошибки' ) : WP_CLI::success( 'Раздел «Статьи» настроен' );
			}

			public function setup() {
				unitr_articles_activate();
				WP_CLI::success( 'Рубрика ' . UNITR_ARTICLES_CATEGORY . ' (ID ' . unitr_articles_ensure_category() . ') и настройки готовы' );
			}

			public function webhook() {
				$GLOBALS['unitr_articles_revalidate_reasons'] = array( 'wp-cli' );
				$res = unitr_articles_send_revalidate( true );
				if ( is_wp_error( $res ) ) {
					WP_CLI::error( $res->get_error_message() );
				}
				WP_CLI::log( 'HTTP ' . wp_remote_retrieve_response_code( $res ) . ' ' . wp_remote_retrieve_body( $res ) );
			}
		}
	);
}
