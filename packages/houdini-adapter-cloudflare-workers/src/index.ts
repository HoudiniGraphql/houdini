import type { Adapter } from 'houdini'

const adapter: Adapter = async ({ config, conventions, publicBase }) => {
	console.log('hello from adapter!', publicBase)
}

export default adapter
