<?php
/**
 * Транслитерация заголовка в ЧПУ — та же таблица, что во фронтенде (src/lib/slugify.ts),
 * чтобы адреса, построенные на сервере WordPress и во фронтенде, совпадали.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function unitr_articles_slugify( $input, $max_length = 80 ) {
	static $map = array(
		'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd', 'е' => 'e', 'ё' => 'yo', 'ж' => 'zh',
		'з' => 'z', 'и' => 'i', 'й' => 'j', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n', 'о' => 'o',
		'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't', 'у' => 'u', 'ф' => 'f', 'х' => 'h', 'ц' => 'cz',
		'ч' => 'ch', 'ш' => 'sh', 'щ' => 'shh', 'ъ' => '', 'ы' => 'y', 'ь' => '', 'э' => 'e', 'ю' => 'yu',
		'я' => 'ya', 'і' => 'i', 'ї' => 'yi', 'є' => 'ye', 'ґ' => 'g',
	);
	$s = function_exists( 'mb_strtolower' ) ? mb_strtolower( (string) $input, 'UTF-8' ) : strtolower( (string) $input );
	$s = str_replace( array( '«', '»', '"', "'", '’', '“', '”' ), '', $s );
	$s = strtr( $s, $map );
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
