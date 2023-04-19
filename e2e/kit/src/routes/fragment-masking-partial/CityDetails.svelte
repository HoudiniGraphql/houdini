<script lang="ts">
	import { fragment, graphql, type CityDetails } from '$houdini';

	export let city: CityDetails | null;

	$: data = fragment(
		city,
		graphql(`
			fragment CityDetails on City {
				id
				name
				libraries {
					id
					name
				}
			}
		`)
	);
</script>

{#if $data}
	<p>{JSON.stringify($data)}</p>
{/if}
