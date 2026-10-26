<?php
/**
 * Plugin Name: Юнит-Ресурс — раздел «Статьи»
 * Description: Подготовка WordPress (manage.unitr.ru) для раздела /articles/ сайта unitr.ru: рубрика poleznye-stati, SEO-поля статьи, латинские ЧПУ, поля WPGraphQL (unitrSeo, unitrOldSlugs, unitrArticlesSettings), вебхук ревалидации фронтенда и страница проверки.
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: X3 Team
 * Text Domain: unitr-articles
 *
 * Настройки можно задать в wp-config.php (имеют приоритет над настройками в админке):
 *   define( 'UNITR_FRONTEND_URL', 'https://unitr.ru' );
 *   define( 'UNITR_REVALIDATE_SECRET', '...' );   // то же значение, что REVALIDATE_SECRET у фронтенда
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'UNITR_ARTICLES_VERSION', '1.0.0' );
define( 'UNITR_ARTICLES_CATEGORY', 'poleznye-stati' );
define( 'UNITR_ARTICLES_CATEGORY_NAME', 'Полезные статьи' );
define( 'UNITR_ARTICLES_OPTION', 'unitr_articles_settings' );

require_once __DIR__ . '/includes/translit.php';
require_once __DIR__ . '/includes/settings.php';
require_once __DIR__ . '/includes/fields.php';
require_once __DIR__ . '/includes/graphql.php';
require_once __DIR__ . '/includes/webhook.php';
require_once __DIR__ . '/includes/check.php';

/* -------------------------------------------------------------------------
 * Активация: рубрика и настройки по умолчанию
 * ---------------------------------------------------------------------- */

register_activation_hook( __FILE__, 'unitr_articles_activate' );

function unitr_articles_activate() {
	unitr_articles_ensure_category();
	if ( false === get_option( UNITR_ARTICLES_OPTION ) ) {
		add_option(
			UNITR_ARTICLES_OPTION,
			array(
				'per_page'       => 10,
				'frontend_url'   => 'https://unitr.ru',
				'secret'         => wp_generate_password( 40, false ),
				'rewrite_links'  => 1,
			)
		);
	}
}

/** Создаёт рубрику «Полезные статьи» (poleznye-stati), если её нет. Возвращает term_id. */
function unitr_articles_ensure_category() {
	$term = get_term_by( 'slug', UNITR_ARTICLES_CATEGORY, 'category' );
	if ( $term ) {
		return (int) $term->term_id;
	}
	$res = wp_insert_term( UNITR_ARTICLES_CATEGORY_NAME, 'category', array( 'slug' => UNITR_ARTICLES_CATEGORY ) );
	return is_wp_error( $res ) ? 0 : (int) $res['term_id'];
}

/** ID рубрики раздела и всех её подрубрик */
function unitr_articles_category_ids() {
	$root = get_term_by( 'slug', UNITR_ARTICLES_CATEGORY, 'category' );
	if ( ! $root ) {
		return array();
	}
	$children = get_term_children( (int) $root->term_id, 'category' );
	return array_merge( array( (int) $root->term_id ), is_wp_error( $children ) ? array() : array_map( 'intval', $children ) );
}

/** Относится ли запись к разделу «Статьи» */
function unitr_articles_is_article( $post ) {
	$post = get_post( $post );
	if ( ! $post || 'post' !== $post->post_type ) {
		return false;
	}
	$ids = unitr_articles_category_ids();
	if ( ! $ids ) {
		return false;
	}
	$cats = wp_get_post_categories( $post->ID, array( 'fields' => 'ids' ) );
	return (bool) array_intersect( $ids, array_map( 'intval', $cats ) );
}

/* -------------------------------------------------------------------------
 * Обложка и анонс: поддержка миниатюр и excerpt для записей
 * ---------------------------------------------------------------------- */

add_action(
	'after_setup_theme',
	function () {
		add_theme_support( 'post-thumbnails', array( 'post' ) );
		add_post_type_support( 'post', array( 'excerpt', 'thumbnail', 'author' ) );
		// Размер обложки для Open Graph / Schema.org (1200×630)
		add_image_size( 'unitr-og', 1200, 630, true );
	},
	20
);

/* -------------------------------------------------------------------------
 * Латинские ЧПУ статей (ТЗ, п. 1.2). Если установлен Cyr-To-Lat — работает он.
 * ---------------------------------------------------------------------- */

add_filter(
	'wp_insert_post_data',
	function ( $data, $postarr ) {
		if ( 'post' !== $data['post_type'] || in_array( $data['post_status'], array( 'auto-draft', 'inherit' ), true ) ) {
			return $data;
		}
		$slug = urldecode( (string) $data['post_name'] );
		if ( '' !== $slug && preg_match( '/^[a-z0-9-]+$/', $slug ) ) {
			return $data;
		}
		$source = '' !== $slug ? $slug : (string) $data['post_title'];
		$latin  = unitr_articles_slugify( $source );
		if ( '' === $latin ) {
			return $data;
		}
		$post_id           = isset( $postarr['ID'] ) ? (int) $postarr['ID'] : 0;
		$data['post_name'] = wp_unique_post_slug( $latin, $post_id, $data['post_status'], $data['post_type'], (int) $data['post_parent'] );
		return $data;
	},
	20,
	2
);

/* -------------------------------------------------------------------------
 * Ссылки «Просмотреть запись» в админке ведут на фронтенд: https://unitr.ru/articles/<slug>/
 * ---------------------------------------------------------------------- */

add_filter(
	'post_link',
	function ( $link, $post ) {
		if ( ! unitr_articles_setting( 'rewrite_links' ) || 'publish' !== $post->post_status || ! unitr_articles_is_article( $post ) ) {
			return $link;
		}
		$front = unitr_articles_frontend_url();
		return $front ? $front . '/articles/' . $post->post_name . '/' : $link;
	},
	20,
	2
);

/* Ссылка на настройки в списке плагинов */
add_filter(
	'plugin_action_links_' . plugin_basename( __FILE__ ),
	function ( $links ) {
		array_unshift(
			$links,
			'<a href="' . esc_url( admin_url( 'options-general.php?page=unitr-articles' ) ) . '">Настройки</a>',
			'<a href="' . esc_url( admin_url( 'tools.php?page=unitr-articles-check' ) ) . '">Проверка</a>'
		);
		return $links;
	}
);
