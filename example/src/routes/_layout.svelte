<script context="module">
	import { setEnvironment, Environment } from 'houdini'
	import fetch from 'isomorphic-fetch'

	setEnvironment(
		new Environment(async ({ text, variables }) => {
			console.log(text)

			// send the request to the ricky and morty api
			const result = await fetch('https://rickandmortyapi.com/graphql', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					query: text,
				}),
			})

			// parse the result as json
			return await result.json()
		})
	)
</script>

<slot />
