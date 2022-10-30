<script lang="ts">
	import { routes } from '$lib/utils/routes';

	let routesKvp = Object.keys(routes).map((key: string) => {
		return { key, value: (routes as Record<string, string>)[key] };
	});
</script>

<slot />

<hr />

<nav>
	{#each routesKvp as { key, value }}
		<div>
			<a href={value}>{key}</a>
		</div>
	{/each}
</nav>
