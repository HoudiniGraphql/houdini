<script context="module">
	import { setEnvironment, Environment } from 'houdini'

	// configure the environment to use
	setEnvironment(
		new Environment(async ({ text, variables }) => {
			// send the request to the ricky and morty api
			const result = await this.fetch('https://rickandmortyapi.com/graphql', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					query: text,
					variables,
				}),
			})

			// parse the result as json
			return await result.json()
		})
	)
</script>

<slot />
