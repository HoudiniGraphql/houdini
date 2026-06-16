declare module 'houdini' {
	// @ts-ignore
	interface HoudiniPluginConfig {
		'houdini-react': HoudiniReactConfig
	}
}

export type HoudiniReactConfig = {
	/**
	 * Controls when the Houdini React devtools overlay is shown.
	 *
	 * - `dev`: show in development
	 * - `production`: show in production
	 * - `never`: never show
	 *
	 * @default 'dev'
	 */
	devtools?: 'dev' | 'production' | 'never'
}
