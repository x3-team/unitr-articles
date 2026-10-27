<?php
/**
 * Поля статьи для раздела «Статьи»:
 *  - обложка — «Изображение записи» (featured image), используется в анонсе, Open Graph и Schema.org;
 *  - анонс — «Отрывок» (excerpt);
 *  - SEO title / description — мета-поля unitr_seo_title / unitr_seo_description.
 *    При активном ACF поля регистрируются как группа ACF (видна в GraphQL через WPGraphQL for ACF),
 *    без ACF — как обычный блок «SEO для раздела «Статьи»» в редакторе записи. Хранение одинаковое.
 *    Если поля пустые, фронтенд берёт значения Yoast SEO / Rank Math, затем заголовок и анонс.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const UNITR_SEO_TITLE_KEY = 'unitr_seo_title';
const UNITR_SEO_DESC_KEY  = 'unitr_seo_description';

add_action(
	'init',
	function () {
		foreach ( array( UNITR_SEO_TITLE_KEY, UNITR_SEO_DESC_KEY ) as $key ) {
			register_post_meta(
				'post',
				$key,
				array(
					'type'              => 'string',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'sanitize_text_field',
					'auth_callback'     => function () {
						return current_user_can( 'edit_posts' );
					},
				)
			);
		}
	}
);

/* --- ACF: локальная группа полей --- */
add_action(
	'acf/init',
	function () {
		if ( ! function_exists( 'acf_add_local_field_group' ) ) {
			return;
		}
		acf_add_local_field_group(
			array(
				'key'                => 'group_unitr_article_seo',
				'title'              => 'SEO для раздела «Статьи»',
				'fields'             => array(
					array(
						'key'          => 'field_unitr_seo_title',
						'label'        => 'SEO title',
						'name'         => UNITR_SEO_TITLE_KEY,
						'type'         => 'text',
						'maxlength'    => 120,
						'instructions' => 'Для статей рубрики «' . UNITR_ARTICLES_CATEGORY_NAME . '» (раздел unitr.ru/articles/). Заголовок страницы в поиске (тег title), до 60–70 символов. Пусто — заголовок статьи.',
						'show_in_graphql' => 1,
					),
					array(
						'key'          => 'field_unitr_seo_description',
						'label'        => 'Meta description',
						'name'         => UNITR_SEO_DESC_KEY,
						'type'         => 'textarea',
						'rows'         => 3,
						'maxlength'    => 300,
						'instructions' => 'Описание для поисковых систем и соцсетей. Рекомендуется 140–160 символов. Пусто — используется анонс (отрывок).',
						'show_in_graphql' => 1,
					),
				),
				// у любой записи, а не только в рубрике раздела: у новой записи рубрика ещё не выбрана, а блочный редактор
				// не перепроверяет условие «рубрика» при её выборе — блок не появлялся до сохранения записи
				'location'           => array(
					array(
						array(
							'param'    => 'post_type',
							'operator' => '==',
							'value'    => 'post',
						),
					),
				),
				'menu_order'         => 0,
				'position'           => 'side',
				'style'              => 'default',
				'active'             => true,
				'show_in_graphql'    => 1,
				'graphql_field_name' => 'unitrSeoFields',
				'graphql_types'      => array( 'Post' ),
			)
		);
	}
);

/* --- Без ACF: собственный блок в редакторе --- */
add_action(
	'add_meta_boxes_post',
	function () {
		if ( function_exists( 'acf_add_local_field_group' ) ) {
			return;
		}
		add_meta_box( 'unitr-article-seo', 'SEO для раздела «Статьи»', 'unitr_articles_render_seo_box', 'post', 'side' );
	}
);

function unitr_articles_render_seo_box( $post ) {
	wp_nonce_field( 'unitr_seo_save', 'unitr_seo_nonce' );
	$title = get_post_meta( $post->ID, UNITR_SEO_TITLE_KEY, true );
	$desc  = get_post_meta( $post->ID, UNITR_SEO_DESC_KEY, true );
	?>
	<p><label for="unitr-seo-title"><strong>SEO title</strong></label><br>
		<input type="text" id="unitr-seo-title" name="unitr_seo_title" value="<?php echo esc_attr( $title ); ?>" maxlength="120" style="width:100%">
		<span class="description">До 60–70 символов. Пусто — заголовок статьи.</span></p>
	<p><label for="unitr-seo-desc"><strong>Meta description</strong></label><br>
		<textarea id="unitr-seo-desc" name="unitr_seo_description" rows="4" maxlength="300" style="width:100%"><?php echo esc_textarea( $desc ); ?></textarea>
		<span class="description">140–160 символов. Пусто — анонс (отрывок).</span></p>
	<p class="description">Поля используются для статей рубрики «<?php echo esc_html( UNITR_ARTICLES_CATEGORY_NAME ); ?>».</p>
	<?php
}

add_action(
	'save_post_post',
	function ( $post_id ) {
		if ( ! isset( $_POST['unitr_seo_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['unitr_seo_nonce'] ) ), 'unitr_seo_save' ) ) {
			return;
		}
		if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		foreach ( array( UNITR_SEO_TITLE_KEY, UNITR_SEO_DESC_KEY ) as $key ) {
			if ( isset( $_POST[ $key ] ) ) {
				$val = sanitize_text_field( wp_unslash( $_POST[ $key ] ) );
				'' === $val ? delete_post_meta( $post_id, $key ) : update_post_meta( $post_id, $key, $val );
			}
		}
	}
);

/**
 * SEO-поля записи с запасными источниками: поля раздела → Yoast SEO → Rank Math → пусто.
 * Шаблонные значения с переменными (%%title%%, %title%) не используются — их подставит фронтенд.
 */
function unitr_articles_seo( $post_id ) {
	$pick = function ( array $keys ) use ( $post_id ) {
		foreach ( $keys as $k ) {
			$v = trim( (string) get_post_meta( $post_id, $k, true ) );
			if ( '' !== $v && false === strpos( $v, '%' ) ) {
				return wp_strip_all_tags( $v );
			}
		}
		return '';
	};
	return array(
		'title'       => $pick( array( UNITR_SEO_TITLE_KEY, '_yoast_wpseo_title', 'rank_math_title' ) ),
		'description' => $pick( array( UNITR_SEO_DESC_KEY, '_yoast_wpseo_metadesc', 'rank_math_description' ) ),
	);
}

/** Чего не хватает статье для полноценного вывода в разделе */
function unitr_articles_missing( $post ) {
	$post    = get_post( $post );
	$missing = array();
	if ( ! has_post_thumbnail( $post ) ) {
		$missing[] = 'обложка';
	}
	if ( '' === trim( (string) $post->post_excerpt ) ) {
		$missing[] = 'анонс (отрывок)';
	}
	$seo = unitr_articles_seo( $post->ID );
	if ( '' === $seo['title'] ) {
		$missing[] = 'SEO title';
	}
	if ( '' === $seo['description'] ) {
		$missing[] = 'meta description';
	}
	return $missing;
}

/* --- Колонка «Раздел «Статьи»» в списке записей --- */
add_filter(
	'manage_post_posts_columns',
	function ( $cols ) {
		$cols['unitr_articles'] = 'Раздел «Статьи»';
		return $cols;
	}
);

add_action(
	'manage_post_posts_custom_column',
	function ( $col, $post_id ) {
		if ( 'unitr_articles' !== $col || ! unitr_articles_is_article( $post_id ) ) {
			return;
		}
		$missing = unitr_articles_missing( $post_id );
		if ( ! $missing ) {
			echo '<span style="color:#3c8a17">✓ всё заполнено</span>';
			return;
		}
		echo '<span style="color:#b26200">Не заполнено: ' . esc_html( implode( ', ', $missing ) ) . '</span>';
	},
	10,
	2
);
