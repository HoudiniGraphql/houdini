<script lang="ts">
	import { browser } from '$app/environment';
	import { graphql, type SimpleStore } from '$houdini';

	export function SimpleVariables() {
		return { id: '1' };
	}

	const store: SimpleStore = graphql`
		query Simple($id: ID!) {
			user(id: $id, snapshot: "preprocess-query-simple") {
				name
			}
		}
	`;

	// $: browser && store.fetch({ variables: { id: '1' } });
</script>

<h2>Simple</h2>

<div id="result">
	{$store?.data?.user.name}
</div>
