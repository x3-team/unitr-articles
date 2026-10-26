<?php
/**
 * Настройки → Раздел «Статьи»: количество анонсов на странице, адрес фронтенда, секрет вебхука.
 * Количество анонсов Заказчик меняет здесь, без правки кода (ТЗ, п. 1.1).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function unitr_articles_setting( $key, $default = null ) {
	$opts = get_option( UNITR_ARTICLES_OPTION, array() );
	return is_array( $opts ) && array_key_exists( $key, $opts ) ? $opts[ $key ] : $default;
}

function unitr_articles_per_page() {
	$n = (int) unitr_articles_setting( 'per_page', 10 );
	return $n > 0 && $n <= 100 ? $n : 10;
}

function unitr_articles_frontend_url() {
	$url = defined( 'UNITR_FRONTEND_URL' ) ? UNITR_FRONTEND_URL : (string) unitr_articles_setting( 'frontend_url', '' );
	return untrailingslashit( esc_url_raw( $url ) );
}

function unitr_articles_secret() {
	return defined( 'UNITR_REVALIDATE_SECRET' ) ? (string) UNITR_REVALIDATE_SECRET : (string) unitr_articles_setting( 'secret', '' );
}

add_action(
	'admin_init',
	function () {
		register_setting(
			'unitr_articles',
			UNITR_ARTICLES_OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => function ( $in ) {
					$in = is_array( $in ) ? $in : array();
					return array(
						'per_page'      => max( 1, min( 100, (int) ( $in['per_page'] ?? 10 ) ) ),
						'frontend_url'  => esc_url_raw( trim( (string) ( $in['frontend_url'] ?? '' ) ) ),
						'secret'        => sanitize_text_field( (string) ( $in['secret'] ?? '' ) ),
						'rewrite_links' => empty( $in['rewrite_links'] ) ? 0 : 1,
					);
				},
			)
		);
	}
);

add_action(
	'admin_menu',
	function () {
		add_options_page( 'Раздел «Статьи»', 'Раздел «Статьи»', 'manage_options', 'unitr-articles', 'unitr_articles_render_settings' );
	}
);

function unitr_articles_render_settings() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$o = get_option( UNITR_ARTICLES_OPTION, array() );
	?>
	<div class="wrap">
		<h1>Раздел «Статьи» (unitr.ru/articles/)</h1>
		<p>Записи рубрики <strong><?php echo esc_html( UNITR_ARTICLES_CATEGORY_NAME ); ?></strong> (<code><?php echo esc_html( UNITR_ARTICLES_CATEGORY ); ?></code>) и её подрубрик публикуются в разделе «Статьи» сайта.
			<a href="<?php echo esc_url( admin_url( 'tools.php?page=unitr-articles-check' ) ); ?>">Проверить настройку раздела →</a></p>
		<form method="post" action="options.php">
			<?php settings_fields( 'unitr_articles' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="ua-per-page">Анонсов на странице</label></th>
					<td><input id="ua-per-page" type="number" min="1" max="100" name="<?php echo esc_attr( UNITR_ARTICLES_OPTION ); ?>[per_page]" value="<?php echo esc_attr( $o['per_page'] ?? 10 ); ?>" class="small-text">
						<p class="description">Сколько статей выводится на одной странице архива /articles/. Изменения появятся на сайте в течение 15 минут.</p></td>
				</tr>
				<tr>
					<th scope="row"><label for="ua-front">Адрес сайта (фронтенда)</label></th>
					<td><input id="ua-front" type="url" name="<?php echo esc_attr( UNITR_ARTICLES_OPTION ); ?>[frontend_url]" value="<?php echo esc_attr( $o['frontend_url'] ?? '' ); ?>" class="regular-text" placeholder="https://unitr.ru" <?php disabled( defined( 'UNITR_FRONTEND_URL' ) ); ?>>
						<?php if ( defined( 'UNITR_FRONTEND_URL' ) ) : ?><p class="description">Задано в wp-config.php: <code><?php echo esc_html( UNITR_FRONTEND_URL ); ?></code></p><?php endif; ?></td>
				</tr>
				<tr>
					<th scope="row"><label for="ua-secret">Секрет вебхука ревалидации</label></th>
					<td><input id="ua-secret" type="text" name="<?php echo esc_attr( UNITR_ARTICLES_OPTION ); ?>[secret]" value="<?php echo esc_attr( $o['secret'] ?? '' ); ?>" class="regular-text code" autocomplete="off" <?php disabled( defined( 'UNITR_REVALIDATE_SECRET' ) ); ?>>
						<p class="description">Должен совпадать с переменной REVALIDATE_SECRET на сервере сайта. При публикации, изменении или снятии статьи сайт обновляется сразу; без вебхука — не позже чем через 15 минут.</p></td>
				</tr>
				<tr>
					<th scope="row">Ссылки «Просмотреть»</th>
					<td><label><input type="checkbox" name="<?php echo esc_attr( UNITR_ARTICLES_OPTION ); ?>[rewrite_links]" value="1" <?php checked( ! empty( $o['rewrite_links'] ) ); ?>> Вести на страницу статьи на сайте (адрес сайта + /articles/&lt;адрес&gt;/)</label></td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}

/* Изменение количества анонсов тоже должно сбрасывать кеш фронтенда */
add_action(
	'update_option_' . UNITR_ARTICLES_OPTION,
	function () {
		unitr_articles_queue_revalidate( 'settings' );
	}
);
