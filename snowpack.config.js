// Consult https://www.snowpack.dev to learn about these options
module.exports = {
	extends: '@sveltejs/snowpack-config',
	plugins: ['@snowpack/plugin-typescript'],
	mount: {
		'src/components': '/_components',
		'src/mosaic': '/_mosaic',
		generated: '/.generated',
	},
	alias: {
		$mosaic: './src/mosaic',
		$components: './src/components',
		$generated: './generated',
	},
}
