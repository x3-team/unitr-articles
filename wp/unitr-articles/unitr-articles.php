<?php
/**
 * Plugin Name: Юнит-Ресурс — раздел «Статьи»
 * Description: Подготовка WordPress (manage.unitr.ru) для раздела /articles/ сайта unitr.ru: рубрика poleznye-stati, SEO-поля статьи, латинские ЧПУ, поля WPGraphQL (unitrSeo, unitrOldSlugs, unitrArticlesSettings), вебхук ревалидации фронтенда и страница проверки.
 * Version: 1.3.2
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

define( 'UNITR_ARTICLES_VERSION', '1.3.2' );
define( 'UNITR_ARTICLES_CATEGORY', 'poleznye-stati' );
define( 'UNITR_ARTICLES_CATEGORY_NAME', 'Полезные статьи' );
define( 'UNITR_ARTICLES_OPTION', 'unitr_articles_settings' );

require_once __DIR__ . '/includes/translit.php';
require_once __DIR__ . '/includes/settings.php';
require_once __DIR__ . '/includes/fields.php';
require_once __DIR__ . '/includes/graphql.php';
require_once __DIR__ . '/includes/webhook.php';
require_once __DIR__ . '/includes/check.php';
require_once __DIR__ . '/includes/rest-auth.php';

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
				'rewrite_links'  => 0, // включить после запуска раздела на unitr.ru, иначе «Просмотреть» ведёт на ещё несуществующий адрес
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
 * Латинские ЧПУ статей (ТЗ, п. 1.2) по схеме транслитерации Яндекса. Ярлык, введённый вручную латиницей,
 * не меняется; кириллический (из заголовка или введённый вручную) переводится в латиницу.
 * Cyr-To-Lat (если стоит) строит адреса всех записей по своей таблице: адрес статьи, который он построил
 * из заголовка, заменяется адресом по схеме Яндекса. Записи вне раздела остаются как у Cyr-To-Lat.
 * ---------------------------------------------------------------------- */

/*
 * Только для статей раздела: записи других рубрик (новости и т.п.) не трогаем — их адреса может использовать
 * основной сайт. wp_after_insert_post срабатывает после сохранения рубрик (в т.ч. из блочного редактора,
 * где рубрики сохраняются отдельным шагом), поэтому принадлежность к разделу уже известна.
 */
add_action(
	'wp_after_insert_post',
	function ( $post_id, $post ) {
		if ( 'post' !== $post->post_type || in_array( $post->post_status, array( 'auto-draft', 'inherit', 'trash' ), true ) ) {
			return;
		}
		$slug = urldecode( (string) $post->post_name );
		if ( '' === $slug || ! unitr_articles_is_article( $post ) ) {
			return;
		}
		if ( preg_match( '/^[a-z0-9-]+$/', $slug ) ) {
			// латинский адрес: меняем, только если это адрес из заголовка по чужой таблице (Cyr-To-Lat), а не ярлык,
			// введённый вручную (с суффиксом WordPress -2, -3… для повторов)
			$auto = sanitize_title( $post->post_title );
			if ( $auto !== $slug && ! preg_match( '/^' . preg_quote( $auto, '/' ) . '-\d+$/', $slug ) ) {
				return;
			}
			$latin = unitr_articles_slugify( $post->post_title );
			if ( '' === $latin || $latin === $slug || 0 === strpos( $slug, $latin . '-' ) ) {
				return;
			}
		} else {
			$latin = unitr_articles_latin_slug( $slug, $post->post_title );
		}
		if ( '' === $latin ) {
			return;
		}
		$latin = wp_unique_post_slug( $latin, $post_id, $post->post_status, $post->post_type, (int) $post->post_parent );
		// напрямую в таблицу: повторное сохранение записи запустило бы все хуки ещё раз
		global $wpdb;
		$wpdb->update( $wpdb->posts, array( 'post_name' => $latin ), array( 'ID' => $post_id ) );
		// опубликованная статья уже могла открываться по прежнему адресу — он отдаст 301 на новый
		if ( 'publish' === $post->post_status && $slug !== $latin && preg_match( '/^[a-z0-9-]+$/', $slug ) ) {
			add_post_meta( $post_id, '_wp_old_slug', $slug );
		}
		clean_post_cache( $post_id );
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
