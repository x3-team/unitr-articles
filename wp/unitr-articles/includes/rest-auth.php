<?php
/**
 * Пароли приложений (Basic Auth) для REST API WordPress: /wp-json/… и ?rest_route=….
 * WordPress проверяет пароль приложения, только если запрос уже распознан как API. Если текущего пользователя
 * определили раньше, чем WordPress распознал REST (плагины и тема на init), Basic Auth не учитывается и REST отвечает
 * 401 rest_not_logged_in. Помечаем такие запросы как API с самого начала — так же WPGraphQL поступает для /graphql.
 * Анонимный доступ это не открывает: без верного пароля приложения пользователь остаётся анонимным.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function unitr_articles_is_rest_uri( $uri ) {
	$path   = (string) wp_parse_url( (string) $uri, PHP_URL_PATH );
	$prefix = '/' . trim( rest_get_url_prefix(), '/' );
	$home   = rtrim( (string) wp_parse_url( home_url(), PHP_URL_PATH ), '/' );
	return 0 === strpos( $path . '/', $home . $prefix . '/' ) || isset( $_GET['rest_route'] ); // phpcs:ignore WordPress.Security.NonceVerification
}

add_filter(
	'application_password_is_api_request',
	function ( $is_api ) {
		return $is_api || unitr_articles_is_rest_uri( $_SERVER['REQUEST_URI'] ?? '' );
	}
);
