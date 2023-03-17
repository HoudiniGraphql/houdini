import { HoudiniClient } from '$houdini'

// Export the Houdini client
export default new HoudiniClient({
	url: 'http://localhost:4000/graphql',
	plugins: [
		() => ({
			beforeNetwork(ctx, { next }) {
				setTimeout(() => next(ctx), 3000)
			},
		}),
	],
})
