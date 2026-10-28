<?php
/**
 * Транслитерация заголовка в ЧПУ по схеме Яндекса — та же таблица, что во фронтенде (src/lib/slugify.ts),
 * чтобы адреса, построенные на сервере WordPress и во фронтенде, совпадали.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Таблица Яндекса: ё → e, й → y, х → h, ц → c, щ → sch, ъ и ь опускаются. */
function unitr_articles_translit_table() {
	return array(
		'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd', 'е' => 'e', 'ё' => 'e', 'ж' => 'zh',
		'з' => 'z', 'и' => 'i', 'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n', 'о' => 'o',
		'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't', 'у' => 'u', 'ф' => 'f', 'х' => 'h', 'ц' => 'c',
		'ч' => 'ch', 'ш' => 'sh', 'щ' => 'sch', 'ъ' => '', 'ы' => 'y', 'ь' => '', 'э' => 'e', 'ю' => 'yu',
		'я' => 'ya', 'і' => 'i', 'ї' => 'yi', 'є' => 'ye', 'ґ' => 'g',
	);
}

function unitr_articles_slugify( $input, $max_length = 80 ) {
	$s = function_exists( 'mb_strtolower' ) ? mb_strtolower( (string) $input, 'UTF-8' ) : strtolower( (string) $input );
	$s = str_replace( array( '«', '»', '"', "'", '’', '“', '”' ), '', $s );
	$s = strtr( $s, unitr_articles_translit_table() );
	if ( function_exists( 'remove_accents' ) ) {
		$s = remove_accents( $s );
	}
	$s = preg_replace( '/[^a-z0-9]+/', '-', $s );
	$s = trim( preg_replace( '/-{2,}/', '-', $s ), '-' );
	if ( strlen( $s ) > $max_length ) {
		$cut = substr( $s, 0, $max_length );
		$pos = strrpos( $cut, '-' );
		$s   = false !== $pos ? substr( $cut, 0, $pos ) : $cut;
	}
	return $s;
}

/**
 * Латинский адрес статьи из адреса WordPress — так же, как во фронтенде (latinSlug в src/lib/slugify.ts).
 * WordPress обрезает кириллический адрес до 200 байт %-кодировки (≈ 33 буквы): если адрес обрезан и является
 * началом заголовка, транслитерируется полный заголовок; иначе (в т.ч. адрес, введённый вручную) — сам адрес.
 */
function unitr_articles_latin_slug( $wp_slug, $title ) {
	$decoded    = rawurldecode( (string) $wp_slug );
	$from_slug  = unitr_articles_slugify( $decoded );
	$from_title = unitr_articles_slugify( (string) $title );
	if ( '' === $from_slug ) {
		return $from_title;
	}
	$truncated = strlen( rawurlencode( $decoded ) ) > 200 - 12;
	return $truncated && 0 === strpos( $from_title, $from_slug ) ? $from_title : $from_slug;
}
