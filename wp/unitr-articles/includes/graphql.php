<?php
/**
 * Поля WPGraphQL, которые использует фронтенд (src/lib/content/graphql.ts):
 *   Post.unitrSeo { title description }      — SEO-поля статьи (с запасными источниками)
 *   Post.unitrOldSlugs: [String]             — прежние адреса статьи (_wp_old_slug) для 301
 *   RootQuery.unitrArticlesSettings { perPage category frontendUrl } — настройки раздела
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action(
	'graphql_register_types',
	function () {
		register_graphql_object_type(
			'UnitrSeo',
			array(
				'description' => 'SEO-поля статьи раздела «Статьи»',
				'fields'      => array(
					'title'       => array( 'type' => 'String' ),
					'description' => array( 'type' => 'String' ),
				),
			)
		);

		register_graphql_field(
			'Post',
			'unitrSeo',
			array(
				'type'        => 'UnitrSeo',
				'description' => 'SEO title / description (поля раздела → Yoast → Rank Math)',
				'resolve'     => function ( $post ) {
					return unitr_articles_seo( (int) $post->databaseId );
				},
			)
		);

		register_graphql_field(
			'Post',
			'unitrOldSlugs',
			array(
				'type'        => array( 'list_of' => 'String' ),
				'description' => 'Прежние адреса (slug) записи — для постоянного редиректа 301',
				'resolve'     => function ( $post ) {
					$old = get_post_meta( (int) $post->databaseId, '_wp_old_slug', false );
					return array_values( array_unique( array_filter( array_map( 'strval', (array) $old ) ) ) );
				},
			)
		);

		register_graphql_object_type(
			'UnitrArticlesSettings',
			array(
				'description' => 'Настройки раздела «Статьи»',
				'fields'      => array(
					'perPage'     => array( 'type' => 'Int' ),
					'category'    => array( 'type' => 'String' ),
					'frontendUrl' => array( 'type' => 'String' ),
				),
			)
		);

		register_graphql_field(
			'RootQuery',
			'unitrArticlesSettings',
			array(
				'type'    => 'UnitrArticlesSettings',
				'resolve' => function () {
					return array(
						'perPage'     => unitr_articles_per_page(),
						'category'    => UNITR_ARTICLES_CATEGORY,
						'frontendUrl' => unitr_articles_frontend_url(),
					);
				},
			)
		);
	}
);
