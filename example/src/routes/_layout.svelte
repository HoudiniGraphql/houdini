<script context="module">
	import { setEnvironment, Environment } from 'houdini'
	import { graphql } from 'graphql'
	import schema from '../schema'

	export async function preload() {
		setEnvironment(
			new Environment(({ text, variables = {} }) => {
				// usually this would require a network request but we're going to
				// use the schema directly here to avoid starting the server
				return graphql(schema, text, null, null, variables)
			})
		)
	}
</script>

<slot />
