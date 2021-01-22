// Consult https://www.snowpack.dev to learn about these options
module.exports = {
	extends: '@sveltejs/snowpack-config',
	plugins: ['@snowpack/plugin-typescript'],
	mount: {
		'src/components': '/_components',
		'src/houdini': '/_houdini',
		generated: '/.generated',
	},
	alias: {
		$houdini: './src/houdini',
		$components: './src/components',
		$generated: './generated',
	},
}
