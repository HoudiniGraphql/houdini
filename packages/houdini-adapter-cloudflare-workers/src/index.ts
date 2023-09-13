import type { Adapter } from 'houdini'

const adapter: Adapter = async ({ config, conventions }) => {
	console.log('hello from adapter!')
}

export default adapter
