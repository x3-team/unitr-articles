<?php
/**
 * Вебхук мгновенной ревалидации фронтенда (ТЗ, задача 3).
 * Вызывается при публикации, изменении, снятии с публикации, удалении статьи рубрики,
 * при изменении рубрик и настроек раздела. Один запрос на HTTP-запрос админки (в конце, на shutdown).
 * Если вебхук не дошёл — кеш фронтенда истечёт сам не позже чем через 15 минут.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$GLOBALS['unitr_articles_revalidate_reasons'] = array();

function unitr_articles_queue_revalidate( $reason ) {
	if ( empty( $GLOBALS['unitr_articles_revalidate_reasons'] ) ) {
		add_action( 'shutdown', 'unitr_articles_send_revalidate' );
	}
	$GLOBALS['unitr_articles_revalidate_reasons'][] = $reason;
}

/**
 * @param bool $blocking true — дождаться ответа (для кнопки проверки)
 * @return array|WP_Error
 */
function unitr_articles_send_revalidate( $blocking = false ) {
	$front  = unitr_articles_frontend_url();
	$secret = unitr_articles_secret();
	if ( ! $front || ! $secret ) {
		return new WP_Error( 'unitr_not_configured', 'Не заданы адрес сайта или секрет вебхука' );
	}
	$reasons = $GLOBALS['unitr_articles_revalidate_reasons'];
	$GLOBALS['unitr_articles_revalidate_reasons'] = array();
	return wp_remote_post(
		$front . '/api/revalidate/',
		array(
			'timeout'  => $blocking ? 10 : 3,
			'blocking' => (bool) $blocking,
			'headers'  => array(
				'Content-Type'        => 'application/json',
				'X-Revalidate-Secret' => $secret,
			),
			'body'     => wp_json_encode( array( 'reasons' => $reasons ) ),
		)
	);
}

/* Смена статуса: публикация, снятие с публикации, перенос в корзину */
add_action(
	'transition_post_status',
	function ( $new, $old, $post ) {
		if ( 'post' !== $post->post_type || ( 'publish' !== $new && 'publish' !== $old ) ) {
			return;
		}
		if ( unitr_articles_is_article( $post ) || 'publish' !== $new ) {
			unitr_articles_queue_revalidate( "status:{$post->ID}:{$old}->{$new}" );
		}
	},
	10,
	3
);

/* Изменение опубликованной статьи (текст, адрес, обложка, рубрики) */
add_action(
	'post_updated',
	function ( $post_id, $after, $before ) {
		if ( 'post' !== $after->post_type || 'publish' !== $after->post_status ) {
			return;
		}
		unitr_articles_queue_revalidate( "update:{$post_id}" );
	},
	10,
	3
);

/* Изменение рубрик записи (может добавить/убрать её из раздела) и мета-полей SEO / обложки */
add_action(
	'set_object_terms',
	function ( $object_id, $terms, $tt_ids, $taxonomy ) {
		if ( 'category' === $taxonomy && 'publish' === get_post_status( $object_id ) ) {
			unitr_articles_queue_revalidate( "terms:{$object_id}" );
		}
	},
	10,
	4
);

foreach ( array( 'updated_post_meta', 'added_post_meta', 'deleted_post_meta' ) as $unitr_hook ) {
	add_action(
		$unitr_hook,
		function ( $meta_id, $object_id, $meta_key ) {
			if ( in_array( $meta_key, array( '_thumbnail_id', UNITR_SEO_TITLE_KEY, UNITR_SEO_DESC_KEY, '_yoast_wpseo_title', '_yoast_wpseo_metadesc' ), true )
				&& 'publish' === get_post_status( $object_id ) && unitr_articles_is_article( $object_id ) ) {
				unitr_articles_queue_revalidate( "meta:{$object_id}:{$meta_key}" );
			}
		},
		10,
		3
	);
}

add_action(
	'before_delete_post',
	function ( $post_id ) {
		if ( unitr_articles_is_article( $post_id ) ) {
			unitr_articles_queue_revalidate( "delete:{$post_id}" );
		}
	}
);

/* Рубрики: новая подрубрика, переименование, удаление */
foreach ( array( 'created_category', 'edited_category', 'delete_category' ) as $unitr_hook ) {
	add_action(
		$unitr_hook,
		function ( $term_id ) {
			unitr_articles_queue_revalidate( "category:{$term_id}" );
		}
	);
}
