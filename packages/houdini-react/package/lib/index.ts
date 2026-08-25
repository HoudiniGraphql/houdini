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
	 * - `dev`: only during development (production builds drop the overlay entirely)
	 * - `always`: in development and production
	 * - `never`: never (the overlay is never bundled)
	 *
	 * @default 'dev'
	 */
	devtools?: 'dev' | 'always' | 'never'
}
