import plugin from './plugin.js'

// this file is rewritten during codegen based on the plugin's `devtools` config value:
// 'dev' (the default) keeps the import.meta.env.DEV guard below so production builds
// tree-shake the overlay, 'always' exports the plugin unconditionally, and 'never'
// exports null without importing the plugin at all.
// @ts-ignore: vite provides import.meta.env
export default import.meta.env.DEV ? plugin : null
