<?php
/**
 * Самопроверка WordPress (manage.unitr.ru) для раздела «Статьи» и сценарий ручных пунктов Прил. № 4 на тестовых статьях.
 * Запуск: DEMO_MODE=check|apply|revert|dispatch wp eval-file wp-stand-scenario.php (deploy/hosting/wp-demo-content.sh,
 * .github/workflows/wp-demo-content.yml). В лог (публичный) выводятся только счётчики, ярлыки тестовых статей и PASS/FAIL.
 *
 *   check    — только чтение: плагины, рубрика, настройки, у каждой статьи рубрики обложка / excerpt / SEO-поля /
 *              латинский ЧПУ / H2 в тексте, ответ GraphQL (как его запрашивает сборка) и что черновики в нём не видны.
 *   apply    — сценарий на тестовых статьях (метка test-unitr-demo): анонсов на странице 10 → 5; одна статья снята
 *              с публикации; у другой изменён адрес; третья перенесена в новую подрубрику. Ожидания для проверки
 *              стенда печатаются строкой SCENARIO {json}. Прежние значения сохраняются в опции unitr_demo_scenario.
 *   revert   — вернуть всё как было до apply.
 *   dispatch — сохранить в настройках плагина репозиторий и токен GitHub (из stdin) для мгновенной пересборки.
 *   frontend — адрес сайта (FRONTEND_URL, по умолчанию https://unitr.ru) в настройках раздела и в wp-config.php.
 *   rest     — только чтение: кто закрывает REST API и доступны ли пароли приложений (плагины, фильтры, .htaccess).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}

require_once ABSPATH . 'wp-admin/includes/plugin.php';

$mode     = getenv( 'DEMO_MODE' ) ?: 'check';
$category = getenv( 'DEMO_CATEGORY' ) ?: 'poleznye-stati';
$opt      = defined( 'UNITR_ARTICLES_OPTION' ) ? UNITR_ARTICLES_OPTION : 'unitr_articles_settings';
$sub_slug = 'test-unitr-demo-podrubrika';

$out = function ( $ok, $name, $details = '' ) {
	WP_CLI::log( sprintf( '%s %s%s', $ok ? 'PASS' : 'FAIL', $name, '' !== $details ? " — $details" : '' ) );
};
$demo = function ( $status = 'any' ) {
	return get_posts(
		array(
			'post_type'      => 'post',
			'post_status'    => $status,
			'posts_per_page' => -1,
			'meta_key'       => '_unitr_demo',
			'meta_value'     => '1',
			'orderby'        => 'date',
			'order'          => 'DESC',
		)
	);
};
$by_key = function ( $key ) use ( $demo ) {
	foreach ( $demo() as $p ) {
		if ( get_post_meta( $p->ID, '_unitr_demo_key', true ) === $key ) {
			return $p;
		}
	}
	return null;
};

if ( 'rest' === $mode ) {
	// где объявлен обработчик фильтра (файл относительно wp-content и строка) — без кода
	$where = function ( $cb ) {
		try {
			if ( is_string( $cb ) && false !== strpos( $cb, '::' ) ) {
				$cb = explode( '::', $cb );
			}
			$r = is_array( $cb ) ? new ReflectionMethod( $cb[0], $cb[1] ) : new ReflectionFunction( $cb );
			$name = is_array( $cb ) ? ( is_object( $cb[0] ) ? get_class( $cb[0] ) : $cb[0] ) . '::' . $cb[1] : ( $cb instanceof Closure ? 'closure' : (string) $cb );
			return $name . ' @ ' . str_replace( WP_CONTENT_DIR . '/', '', (string) $r->getFileName() ) . ':' . $r->getStartLine();
		} catch ( Throwable $e ) {
			return 'не определить';
		}
	};
	$hooks = function ( $tag ) use ( $where ) {
		global $wp_filter;
		$list = array();
		if ( isset( $wp_filter[ $tag ] ) ) {
			foreach ( $wp_filter[ $tag ]->callbacks as $prio => $cbs ) {
				foreach ( $cbs as $cb ) {
					$list[] = "[$prio] " . $where( $cb['function'] );
				}
			}
		}
		return $list;
	};
	WP_CLI::log( 'WordPress ' . get_bloginfo( 'version' ) . ', тема: ' . wp_get_theme()->get( 'Name' ) . ' (' . get_stylesheet() . ')' );
	WP_CLI::log( 'Активные плагины: ' . implode( ', ', array_map( 'dirname', (array) get_option( 'active_plugins', array() ) ) ) );
	$mu = function_exists( 'get_mu_plugins' ) ? array_keys( get_mu_plugins() ) : array();
	WP_CLI::log( 'MU-плагины: ' . ( $mu ? implode( ', ', $mu ) : 'нет' ) );
	// в WP-CLI нет HTTPS, поэтому поддержка паролей приложений проверяется как для веб-запроса по https
	$_SERVER['HTTPS'] = 'on';
	WP_CLI::log( 'Пароли приложений (как для запроса по HTTPS): поддерживаются — ' . ( wp_is_application_passwords_supported() ? 'да' : 'нет' ) . ', доступны — ' . ( wp_is_application_passwords_available() ? 'да' : 'нет' ) );
	WP_CLI::log( 'Константа WP_ENVIRONMENT_TYPE: ' . wp_get_environment_type() );
	foreach ( array( 'rest_authentication_errors', 'wp_is_application_passwords_available', 'application_password_is_api_request', 'determine_current_user', 'rest_endpoints', 'rest_pre_dispatch', 'rest_enabled', 'rest_jsonp_enabled', 'authenticate' ) as $tag ) {
		$l = $hooks( $tag );
		WP_CLI::log( "Фильтр $tag: " . ( $l ? '' : 'нет обработчиков' ) );
		foreach ( $l as $line ) {
			WP_CLI::log( "  $line" );
		}
	}
	// упоминания в коде плагинов и темы (только пути файлов)
	$needles = array( 'rest_authentication_errors', 'rest_not_logged_in', 'wp_is_application_passwords_available', 'application_password' );
	$found   = array();
	foreach ( array( WP_PLUGIN_DIR, WPMU_PLUGIN_DIR, get_theme_root() ) as $root ) {
		if ( ! is_dir( $root ) ) {
			continue;
		}
		$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $root, FilesystemIterator::SKIP_DOTS ) );
		foreach ( $it as $f ) {
			if ( 'php' !== $f->getExtension() || $f->getSize() > 2000000 || preg_match( '#/(vendor|node_modules|tests?)/#', $f->getPathname() ) ) {
				continue;
			}
			$c = file_get_contents( $f->getPathname() );
			foreach ( $needles as $n ) {
				if ( false !== strpos( $c, $n ) ) {
					$found[ str_replace( WP_CONTENT_DIR . '/', '', $f->getPathname() ) ][] = $n;
				}
			}
		}
	}
	WP_CLI::log( 'Код с упоминанием REST-авторизации / паролей приложений:' );
	foreach ( $found as $file => $ns ) {
		WP_CLI::log( "  $file: " . implode( ', ', array_unique( $ns ) ) );
	}
	// передаётся ли заголовок Authorization в PHP (без него Basic Auth паролей приложений не работает)
	$ht = ABSPATH . '.htaccess';
	if ( is_readable( $ht ) ) {
		$h = file_get_contents( $ht );
		WP_CLI::log( '.htaccess WordPress: HTTP_AUTHORIZATION — ' . ( preg_match( '/HTTP_AUTHORIZATION/i', $h ) ? 'пробрасывается' : 'не упоминается' ) . '; RewriteEngine — ' . ( preg_match( '/RewriteEngine\s+On/i', $h ) ? 'да' : 'нет' ) );
	}
	// ответ REST изнутри WordPress: анонимно (как его видит внешний запрос без авторизации)
	wp_set_current_user( 0 );
	$err = apply_filters( 'rest_authentication_errors', null );
	WP_CLI::log( 'rest_authentication_errors для анонима: ' . ( is_wp_error( $err ) ? $err->get_error_code() . ' (' . (int) ( $err->get_error_data()['status'] ?? 0 ) . ')' : var_export( $err, true ) ) );
	return;
}

if ( 'show' === $mode ) {
	// текст статьи — для подготовки отрывка и SEO-полей (опубликованная статья, сведения публичные)
	$p = get_post( (int) getenv( 'POST_ID' ) );
	if ( ! $p ) {
		WP_CLI::error( 'Нет записи ' . getenv( 'POST_ID' ) );
	}
	WP_CLI::log( "ID {$p->ID} [{$p->post_status}] " . urldecode( $p->post_name ) . ' — ' . $p->post_title );
	WP_CLI::log( 'Рубрики: ' . implode( ', ', wp_get_post_categories( $p->ID, array( 'fields' => 'slugs' ) ) ) . '; обложка: ' . ( get_post_thumbnail_id( $p ) ? 'есть' : 'нет' ) );
	WP_CLI::log( 'Отрывок: ' . ( $p->post_excerpt ?: '—' ) );
	WP_CLI::log( 'SEO title: ' . ( get_post_meta( $p->ID, 'unitr_seo_title', true ) ?: '—' ) . '; description: ' . ( get_post_meta( $p->ID, 'unitr_seo_description', true ) ?: '—' ) );
	preg_match_all( '/<h([23])[^>]*>(.*?)<\/h\1>/is', $p->post_content, $m, PREG_SET_ORDER );
	foreach ( $m as $h ) {
		WP_CLI::log( str_repeat( '  ', (int) $h[1] - 2 ) . 'H' . $h[1] . ': ' . wp_strip_all_tags( $h[2] ) );
	}
	$text = trim( preg_replace( '/\s+/u', ' ', wp_strip_all_tags( strip_shortcodes( $p->post_content ) ) ) );
	WP_CLI::log( 'Текст (' . mb_strlen( $text ) . ' симв.): ' . mb_substr( $text, 0, 1500 ) );
	return;
}

if ( 'seo-fill' === $mode ) {
	// отрывок и SEO-поля из seo-fill.json {"ID": {"excerpt","seo_title","seo_description"}}; заполняются только пустые
	$data  = json_decode( (string) file_get_contents( getenv( 'DEMO_DIR' ) . '/seo-fill.json' ), true );
	$force = 'yes' === getenv( 'SEO_FORCE' );
	foreach ( (array) $data as $id => $f ) {
		$p = get_post( (int) $id );
		if ( ! $p || ! $f ) {
			continue;
		}
		$done = array();
		if ( ! empty( $f['excerpt'] ) && ( $force || '' === trim( $p->post_excerpt ) ) ) {
			wp_update_post( wp_slash( array( 'ID' => $p->ID, 'post_excerpt' => $f['excerpt'] ) ) );
			$done[] = 'отрывок';
		}
		foreach ( array( 'seo_title' => 'unitr_seo_title', 'seo_description' => 'unitr_seo_description' ) as $k => $meta ) {
			if ( ! empty( $f[ $k ] ) && ( $force || '' === trim( (string) get_post_meta( $p->ID, $meta, true ) ) ) ) {
				update_post_meta( $p->ID, $meta, sanitize_text_field( $f[ $k ] ) );
				$done[] = $meta;
			}
		}
		$missing = function_exists( 'unitr_articles_missing' ) ? unitr_articles_missing( $p->ID ) : array();
		$out( ! $missing, "ID {$p->ID} " . urldecode( $p->post_name ), ( $done ? 'заполнено: ' . implode( ', ', $done ) . '; ' : 'без изменений; ' ) . ( $missing ? 'не хватает: ' . implode( ', ', $missing ) : 'всё заполнено' ) );
	}
	return;
}

if ( 'touch' === $mode ) {
	// замер автообновления: пересохранить опубликованную статью без изменения текста (меняется только дата изменения);
	// плагин отправляет событие в GitHub, как при правке статьи в админке
	$p = get_post( (int) getenv( 'POST_ID' ) );
	if ( ! $p || 'publish' !== $p->post_status ) {
		WP_CLI::error( 'Нет опубликованной записи ' . getenv( 'POST_ID' ) );
	}
	sleep( 1 );
	$r = wp_update_post( array( 'ID' => $p->ID ), true );
	if ( is_wp_error( $r ) ) {
		WP_CLI::error( $r->get_error_message() );
	}
	clean_post_cache( $p->ID );
	$p = get_post( $p->ID );
	// событие уходит на shutdown — отправить сразу и дождаться ответа GitHub
	$res  = function_exists( 'unitr_articles_send_revalidate' ) ? unitr_articles_send_revalidate( true ) : null;
	remove_action( 'shutdown', 'unitr_articles_send_revalidate' );
	$code = is_wp_error( $res ) || ! $res ? 0 : (int) wp_remote_retrieve_response_code( $res );
	$out( 204 === $code, 'Событие из WordPress принято GitHub', 'HTTP ' . $code );
	WP_CLI::log( 'TOUCH ' . wp_json_encode( array( 'slug' => urldecode( $p->post_name ), 'modified' => gmdate( 'Y-m-d\TH:i:s', strtotime( $p->post_modified_gmt ) ) ) ) );
	return;
}

if ( 'frontend' === $mode ) {
	// адрес сайта в настройках раздела (и в wp-config.php, если там задана константа UNITR_FRONTEND_URL)
	$url = untrailingslashit( getenv( 'FRONTEND_URL' ) ?: 'https://unitr.ru' );
	if ( defined( 'UNITR_FRONTEND_URL' ) ) {
		$cfg = file_exists( ABSPATH . 'wp-config.php' ) ? ABSPATH . 'wp-config.php' : dirname( ABSPATH ) . '/wp-config.php';
		$src = (string) file_get_contents( $cfg );
		$new = preg_replace( '/(define\(\s*[\'"]UNITR_FRONTEND_URL[\'"]\s*,\s*)([\'"])[^\'"]*\2/', '${1}${2}' . $url . '${2}', $src, 1, $n );
		if ( 1 !== $n ) {
			WP_CLI::error( 'UNITR_FRONTEND_URL задана не строкой в wp-config.php — поправить вручную' );
		}
		// копия — вне каталога сайта (в ней пароль БД)
		$bak_dir = ( getenv( 'HOME' ) ?: dirname( ABSPATH, 2 ) ) . '/backups';
		wp_mkdir_p( $bak_dir );
		$bak = $bak_dir . '/wp-config-' . gmdate( 'Ymd-His' ) . '.php';
		if ( $new !== $src ) {
			copy( $cfg, $bak ) && file_put_contents( $cfg, $new );
		}
		$out( false !== strpos( (string) file_get_contents( $cfg ), $url ), "UNITR_FRONTEND_URL в wp-config.php: $url", $new !== $src ? 'прежний wp-config.php — ~/backups/' . basename( $bak ) : 'уже было' );
	}
	$o                 = (array) get_option( $opt, array() );
	$o['frontend_url'] = $url;
	update_option( $opt, $o );
	$o = (array) get_option( $opt, array() );
	$out( ( $o['frontend_url'] ?? '' ) === $url, "Адрес сайта в настройках раздела: $url" );
	$out( true, 'Ссылки «Просмотреть» ведут на сайт', empty( $o['rewrite_links'] ) ? 'выключено — ссылки на WordPress' : "включено — $url/articles/<адрес>/" );
	$github = function_exists( 'unitr_articles_github_repo' ) && unitr_articles_github_repo() && unitr_articles_github_token();
	$out( $github, 'Обновление сайта при изменениях — GitHub Actions', $github ? unitr_articles_github_repo() : 'не настроено: нужен секрет WP_DISPATCH_TOKEN и action=dispatch-setup' );
	$out( true, 'Секрет вебхука /api/revalidate/', function_exists( 'unitr_articles_secret' ) && unitr_articles_secret() ? 'задан' : 'не задан (сайт статический, без Node.js — не используется)' );
	return;
}

if ( 'dispatch' === $mode ) {
	$token = trim( (string) stream_get_contents( STDIN ) );
	$repo  = getenv( 'DISPATCH_REPO' ) ?: 'x3-team/unitr-articles';
	if ( '' === $token ) {
		WP_CLI::error( 'Токен не передан' );
	}
	$o                 = (array) get_option( $opt, array() );
	$o['github_repo']  = $repo;
	$o['github_token'] = $token;
	update_option( $opt, $o );
	$o = (array) get_option( $opt, array() );
	$out( ( $o['github_repo'] ?? '' ) === $repo && '' !== ( $o['github_token'] ?? '' ), "Пересборка по событию из WordPress: репозиторий $repo, токен сохранён" );
	// проверка: GitHub принимает событие (204) — запустится пересборка стенда
	$res = function_exists( 'unitr_articles_send_github_dispatch' ) ? unitr_articles_send_github_dispatch( array( 'setup' ), true ) : null;
	$code = is_wp_error( $res ) || ! $res ? 0 : (int) wp_remote_retrieve_response_code( $res );
	$out( 204 === $code, 'GitHub принял событие wp-content-changed', 'HTTP ' . $code );
	return;
}

if ( 'apply' === $mode || 'revert' === $mode ) {
	$items = $demo( 'publish' );
	$state = get_option( 'unitr_demo_scenario' );

	if ( 'apply' === $mode ) {
		if ( $state ) {
			WP_CLI::error( 'Сценарий уже применён — сначала revert' );
		}
		if ( count( $items ) < 4 ) {
			WP_CLI::error( 'Нужно минимум 4 опубликованные тестовые статьи (action=seed)' );
		}
		$settings = (array) get_option( $opt, array() );
		$a        = $items[1]; // снимается с публикации
		$b        = $items[2]; // меняет адрес
		$c        = $items[3]; // переносится в подрубрику
		$state    = array(
			'per_page' => $settings['per_page'] ?? 10,
			'draft'    => get_post_meta( $a->ID, '_unitr_demo_key', true ),
			'renamed'  => get_post_meta( $b->ID, '_unitr_demo_key', true ),
			'old_slug' => $b->post_name,
			'moved'    => get_post_meta( $c->ID, '_unitr_demo_key', true ),
			'applied'  => time(),
		);
		update_option( 'unitr_demo_scenario', $state, false );

		$settings['per_page'] = 5;
		update_option( $opt, $settings );
		wp_update_post( array( 'ID' => $a->ID, 'post_status' => 'draft' ) );
		wp_update_post( array( 'ID' => $b->ID, 'post_name' => $b->post_name . '-novyj-adres' ) );
		$parent = get_term_by( 'slug', $category, 'category' );
		$sub    = get_term_by( 'slug', $sub_slug, 'category' );
		$sub_id = $sub ? (int) $sub->term_id : (int) wp_insert_term( 'Тестовая подрубрика', 'category', array( 'slug' => $sub_slug, 'parent' => $parent->term_id ) )['term_id'];
		wp_set_post_categories( $c->ID, array( $parent->term_id, $sub_id ) );

		$published = count( $demo( 'publish' ) ) + count( get_posts( array( 'post_type' => 'post', 'post_status' => 'publish', 'posts_per_page' => -1, 'fields' => 'ids', 'category_name' => $category, 'meta_key' => '_unitr_demo', 'meta_compare' => 'NOT EXISTS' ) ) );
		WP_CLI::log(
			'SCENARIO ' . wp_json_encode(
				array(
					'perPage'   => 5,
					'published' => $published,
					'draftSlug' => get_post( $a->ID )->post_name,
					'oldSlug'   => $state['old_slug'],
					'newSlug'   => get_post( $b->ID )->post_name,
					'rubric'    => $sub_slug,
					'inRubric'  => get_post( $c->ID )->post_name,
					'applied'   => $state['applied'],
				),
				JSON_UNESCAPED_UNICODE
			)
		);
		WP_CLI::success( 'Сценарий применён' );
		return;
	}

	if ( ! $state ) {
		WP_CLI::success( 'Сценарий не применялся — возвращать нечего' );
		return;
	}
	$settings             = (array) get_option( $opt, array() );
	$settings['per_page'] = (int) $state['per_page'];
	update_option( $opt, $settings );
	$a = $by_key( $state['draft'] );
	if ( $a ) {
		wp_update_post( array( 'ID' => $a->ID, 'post_status' => 'publish' ) );
	}
	$b = $by_key( $state['renamed'] );
	if ( $b ) {
		wp_update_post( array( 'ID' => $b->ID, 'post_name' => $state['old_slug'] ) );
		delete_post_meta( $b->ID, '_wp_old_slug' );
	}
	$c      = $by_key( $state['moved'] );
	$parent = get_term_by( 'slug', $category, 'category' );
	if ( $c ) {
		wp_set_post_categories( $c->ID, array( $parent->term_id ) );
	}
	$sub = get_term_by( 'slug', $sub_slug, 'category' );
	if ( $sub ) {
		wp_delete_term( $sub->term_id, 'category' );
	}
	delete_option( 'unitr_demo_scenario' );
	WP_CLI::success( 'Сценарий отменён: настройки, статьи и рубрики как до проверки' );
	return;
}

/* ---------- check: только чтение ---------- */
WP_CLI::log( 'WordPress ' . get_bloginfo( 'version' ) . ', PHP ' . PHP_VERSION );
$active = (array) get_option( 'active_plugins', array() );
foreach ( array( 'unitr-articles/unitr-articles.php' => 'Плагин раздела unitr-articles', 'wp-graphql/wp-graphql.php' => 'WPGraphQL' ) as $file => $name ) {
	$data = file_exists( WP_PLUGIN_DIR . "/$file" ) ? get_plugin_data( WP_PLUGIN_DIR . "/$file", false, false ) : array();
	$out( in_array( $file, $active, true ), $name . ' активен', $data['Version'] ?? 'нет' );
}
$translit_plugins = array_values( preg_grep( '/cyr|translit|rus-?to-?lat/i', $active ) );
$out( true, 'Плагины транслитерации адресов', $translit_plugins ? implode( ', ', $translit_plugins ) : 'нет — ЧПУ статей строит плагин раздела' );
if ( function_exists( 'unitr_articles_slugify' ) ) {
	$sample = unitr_articles_slugify( 'Щёточный ввод для шкафа ЦОД: хомуты и йод' );
	$out( 'schetochnyy-vvod-dlya-shkafa-cod-homuty-i-yod' === $sample, 'ЧПУ по схеме Яндекса', $sample );
	// адрес, который WordPress (с Cyr-To-Lat — по его таблице) строит для записей вне раздела; статьям плагин ставит адрес по схеме Яндекса
	$out( true, 'Адрес записей вне раздела (WordPress / Cyr-To-Lat)', urldecode( sanitize_title( 'Щёточный ввод для шкафа ЦОД: хомуты и йод' ) ) );
}
$out( function_exists( 'acf' ), 'ACF', function_exists( 'acf_get_local_field_group' ) && acf_get_local_field_group( 'group_unitr_article_seo' ) ? 'группа SEO-полей статьи зарегистрирована' : 'группа SEO не найдена — поля в своём блоке плагина' );

$term = get_term_by( 'slug', $category, 'category' );
$out( (bool) $term, "Рубрика $category", $term ? "«{$term->name}», ID {$term->term_id}" : 'нет' );
$s = (array) get_option( $opt, array() );
$out( (int) ( $s['per_page'] ?? 10 ) >= 1, 'Настройка «Анонсов на странице»', (string) ( $s['per_page'] ?? 10 ) );
$out( true, 'Адрес сайта в настройках', (string) ( $s['frontend_url'] ?? '' ) );
$gh = function_exists( 'unitr_articles_github_repo' ) && unitr_articles_github_repo() && unitr_articles_github_token();
$out( $gh, 'Пересборка по событию из WordPress (GitHub)', $gh ? 'настроена' : 'не настроена — обновление только по расписанию' );

$posts = get_posts( array( 'post_type' => 'post', 'post_status' => 'publish', 'posts_per_page' => -1, 'category_name' => $category ) );
$drafts = get_posts( array( 'post_type' => 'post', 'post_status' => array( 'draft', 'pending', 'private' ), 'posts_per_page' => -1, 'fields' => 'ids', 'category_name' => $category ) );
WP_CLI::log( sprintf( 'Статей в рубрике: опубликовано %d, не опубликовано %d', count( $posts ), count( $drafts ) ) );
$crit = array(
	'обложка'        => function ( $p ) { return (bool) get_post_thumbnail_id( $p ); },
	'excerpt'        => function ( $p ) { return '' !== trim( $p->post_excerpt ); },
	'SEO title'      => function ( $p ) { return '' !== trim( (string) get_post_meta( $p->ID, 'unitr_seo_title', true ) ); },
	'SEO description' => function ( $p ) { return '' !== trim( (string) get_post_meta( $p->ID, 'unitr_seo_description', true ) ); },
	'ЧПУ латиницей'   => function ( $p ) { return (bool) preg_match( '/^[a-z0-9-]+$/', urldecode( $p->post_name ) ); },
	'H2 в тексте'     => function ( $p ) { return false !== stripos( $p->post_content, '<h2' ); },
);
foreach ( $crit as $name => $fn ) {
	$bad = array();
	foreach ( $posts as $p ) {
		if ( ! $fn( $p ) ) {
			$bad[] = urldecode( $p->post_name );
		}
	}
	// у не тестовых статей (заведены редакцией) пустые поля — замечание, а не ошибка раздела: сайт подставит заголовок / начало текста
	$out( ! $bad, "Статьи рубрики: $name", $bad ? 'нет у: ' . implode( ', ', array_slice( $bad, 0, 5 ) ) : count( $posts ) . ' из ' . count( $posts ) );
}

if ( function_exists( 'graphql' ) ) {
	$q = 'query($c:String){ unitrArticlesSettings { perPage category } posts(first: 100, where: {categoryName: $c, status: PUBLISH}) { nodes { slug unitrSeo { title description } featuredImage { node { sourceUrl } } } } }';
	$r = graphql( array( 'query' => $q, 'variables' => array( 'c' => $category ) ) );
	$n = $r['data']['posts']['nodes'] ?? array();
	$out( empty( $r['errors'] ), 'GraphQL: запрос сборки без ошибок', empty( $r['errors'] ) ? '' : $r['errors'][0]['message'] );
	$out( count( $n ) === count( $posts ), 'GraphQL: все опубликованные статьи рубрики', count( $n ) . ' из ' . count( $posts ) );
	$out( isset( $r['data']['unitrArticlesSettings']['perPage'] ), 'GraphQL: настройки раздела (unitrArticlesSettings)', wp_json_encode( $r['data']['unitrArticlesSettings'] ?? null ) );
	$seo = count( array_filter( $n, function ( $x ) { return ! empty( $x['unitrSeo']['title'] ); } ) );
	$img = count( array_filter( $n, function ( $x ) { return ! empty( $x['featuredImage']['node']['sourceUrl'] ); } ) );
	$out( $seo > 0 && $img > 0, 'GraphQL: SEO-поля и обложки', "SEO: $seo, обложки: $img из " . count( $n ) );
	wp_set_current_user( 0 );
	$anon = graphql( array( 'query' => 'query($c:String){ posts(first: 100, where: {categoryName: $c, stati: [DRAFT, PENDING, PRIVATE]}) { nodes { slug } } }', 'variables' => array( 'c' => $category ) ) );
	$out( empty( $anon['data']['posts']['nodes'] ), 'GraphQL без авторизации: черновики не видны', count( $anon['data']['posts']['nodes'] ?? array() ) . ' шт.' );
} else {
	$out( false, 'GraphQL', 'функция graphql() недоступна' );
}

$res = WP_CLI::runcommand( 'unitr-articles check', array( 'return' => 'all', 'exit_error' => false, 'launch' => true ) );
foreach ( explode( "\n", trim( (string) $res->stdout . "\n" . (string) $res->stderr ) ) as $line ) {
	if ( '' !== trim( $line ) ) {
		WP_CLI::log( '  wp unitr-articles check: ' . preg_replace( '/(github_pat_|ghp_)\w+/', '$1***', $line ) );
	}
}
