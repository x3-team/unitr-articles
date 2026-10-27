<?php
/**
 * Тестовые статьи раздела «Статьи» в WordPress (manage.unitr.ru), рубрика poleznye-stati.
 * Запуск: DEMO_MODE=seed|remove|status DEMO_DIR=~/tmp/unitr-demo wp eval-file wp-demo-content.php
 * (из deploy/hosting/wp-demo-content.sh, workflow .github/workflows/wp-demo-content.yml).
 *
 * Каждая тестовая статья помечена мета-полем _unitr_demo=1 и меткой test-unitr-demo (видна в «Записи → Метки»):
 * DEMO_MODE=remove удаляет только такие записи и их обложки. Повторный seed обновляет статьи, а не дублирует.
 * Остальные записи, рубрики и настройки не меняются.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit( 1 );
}
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

$mode     = getenv( 'DEMO_MODE' ) ?: 'status';
$dir      = rtrim( (string) getenv( 'DEMO_DIR' ), '/' );
$category = getenv( 'DEMO_CATEGORY' ) ?: 'poleznye-stati';
$tag      = 'test-unitr-demo';

$demo_posts = function () {
	return get_posts(
		array(
			'post_type'      => 'post',
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'meta_key'       => '_unitr_demo',
			'meta_value'     => '1',
		)
	);
};

$summary = function ( $category ) use ( $demo_posts ) {
	$term   = get_term_by( 'slug', $category, 'category' );
	$counts = array();
	foreach ( array( 'publish', 'draft' ) as $status ) {
		$counts[ $status ] = $term ? count(
			get_posts(
				array(
					'post_type'      => 'post',
					'post_status'    => $status,
					'posts_per_page' => -1,
					'fields'         => 'ids',
					'cat'            => $term->term_id,
				)
			)
		) : 0;
	}
	$demo = $demo_posts();
	WP_CLI::log( sprintf( 'Рубрика %s: опубликовано %d, черновиков %d; из них тестовых: %d', $category, $counts['publish'], $counts['draft'], count( $demo ) ) );
	foreach ( $demo as $p ) {
		WP_CLI::log( sprintf( '  [%s] %s — %s', $p->post_status, urldecode( $p->post_name ), get_post_thumbnail_id( $p ) ? 'обложка есть' : 'БЕЗ обложки' ) );
	}
};

if ( 'remove' === $mode ) {
	$n = 0;
	foreach ( $demo_posts() as $p ) {
		$thumb = get_post_thumbnail_id( $p );
		if ( $thumb && get_post_meta( $thumb, '_unitr_demo', true ) ) {
			wp_delete_attachment( $thumb, true );
		}
		wp_delete_post( $p->ID, true );
		++$n;
	}
	$t = get_term_by( 'slug', $tag, 'post_tag' );
	if ( $t ) {
		wp_delete_term( $t->term_id, 'post_tag' );
	}
	WP_CLI::success( "Удалено тестовых статей: $n" );
	$summary( $category );
	return;
}

if ( 'seed' !== $mode ) {
	$summary( $category );
	return;
}

$term = get_term_by( 'slug', $category, 'category' );
if ( ! $term ) {
	WP_CLI::error( "Нет рубрики $category — сначала активировать плагин раздела" );
}
$items = json_decode( (string) file_get_contents( "$dir/articles.json" ), true );
if ( ! is_array( $items ) || ! $items ) {
	WP_CLI::error( "Нет $dir/articles.json" );
}

// автор — как у уже опубликованной статьи рубрики, иначе первый администратор
$existing = get_posts( array( 'post_type' => 'post', 'posts_per_page' => 1, 'cat' => $term->term_id, 'meta_key' => '_unitr_demo', 'meta_compare' => 'NOT EXISTS' ) );
$admins   = get_users( array( 'role' => 'administrator', 'number' => 1, 'orderby' => 'ID' ) );
$author   = $existing ? (int) $existing[0]->post_author : ( $admins ? (int) $admins[0]->ID : 1 );

$by_key = array();
foreach ( $demo_posts() as $p ) {
	$by_key[ get_post_meta( $p->ID, '_unitr_demo_key', true ) ] = $p;
}

global $wpdb;
foreach ( $items as $item ) {
	$gmt  = gmdate( 'Y-m-d H:i:s', strtotime( $item['date'] ) );
	$mgmt = gmdate( 'Y-m-d H:i:s', strtotime( $item['modified'] ) );
	$old  = $by_key[ $item['key'] ] ?? null;
	$data = array(
		'post_type'     => 'post',
		'post_status'   => $item['status'],
		'post_title'    => $item['title'],
		'post_excerpt'  => $item['excerpt'],
		'post_content'  => $item['content'],
		'post_author'   => $author,
		'post_date'     => get_date_from_gmt( $gmt ),
		'post_date_gmt' => $gmt,
		'post_category' => array( $term->term_id ),
		'tags_input'    => array( $tag ),
		'meta_input'    => array(
			'_unitr_demo'           => '1',
			'_unitr_demo_key'       => $item['key'],
			'unitr_seo_title'       => $item['seo_title'],
			'unitr_seo_description' => $item['seo_description'],
		),
	);
	if ( '' !== $item['slug'] ) {
		$data['post_name'] = $item['slug'];
	} elseif ( ! $old ) {
		// ярлык строит WordPress из кириллического заголовка, плагин раздела переводит его в латиницу
		$data['post_name'] = sanitize_title( $item['title'] );
	}
	if ( $old ) {
		$data['ID'] = $old->ID;
	}
	// wp_update_post сохраняет поля записи, которые не переданы (в т.ч. уже переведённый в латиницу ярлык)
	$id = $old ? wp_update_post( wp_slash( $data ), true ) : wp_insert_post( wp_slash( $data ), true );
	if ( is_wp_error( $id ) ) {
		WP_CLI::warning( $item['key'] . ': ' . $id->get_error_message() );
		continue;
	}
	// дата изменения — из демо-контента (wp_insert_post ставит текущую)
	$wpdb->update( $wpdb->posts, array( 'post_modified_gmt' => $mgmt, 'post_modified' => get_date_from_gmt( $mgmt ) ), array( 'ID' => $id ) );
	clean_post_cache( $id );

	if ( ! get_post_thumbnail_id( $id ) ) {
		$src = "$dir/covers/" . basename( $item['cover'] );
		$tmp = wp_tempnam( $item['cover'] );
		copy( $src, $tmp );
		$att = media_handle_sideload( array( 'name' => $item['key'] . '.jpg', 'tmp_name' => $tmp ), $id, $item['title'] );
		if ( is_wp_error( $att ) ) {
			@unlink( $tmp );
			WP_CLI::warning( $item['key'] . ': обложка — ' . $att->get_error_message() );
		} else {
			update_post_meta( $att, '_unitr_demo', '1' );
			update_post_meta( $att, '_wp_attachment_image_alt', $item['title'] );
			set_post_thumbnail( $id, $att );
		}
	}
}
WP_CLI::success( 'Тестовые статьи загружены (' . count( $items ) . ')' );
$summary( $category );
