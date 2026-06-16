declare module 'houdini' {
	// @ts-ignore
	interface HoudiniPluginConfig {
		'houdini-react': HoudiniReactConfig
	}
}

export type HoudiniReactConfig = {
	/**
	 * Show the Houdini React devtools overlay in development.
	 * @default false
	 */
	devtools?: boolean
}
