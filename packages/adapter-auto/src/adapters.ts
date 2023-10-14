export const adapters = [
	{
		name: 'CloudFlare Pages',
		test: () => Boolean(process.env.CF_PAGES),
		module: 'houdini-adapter-cloudflare',
	},
	{
		name: 'HoudiniCloud',
		test: () => Boolean(process.env.HOUDINI_CLOUD),
		module: 'houdini-cloud-adapter',
	},
	// putting this at the bottom makes it will be the default
	{
		name: 'Node',
		test: () => true,
		module: 'houdini-adapter-node',
	},
]
