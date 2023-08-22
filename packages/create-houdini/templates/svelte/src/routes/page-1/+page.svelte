<script lang="ts">
	import type { PageData } from './$houdini';

	export let data: PageData;

	$: ({ Page_1 } = data);
</script>

<h2>Page 1</h2>

<pre>{JSON.stringify($Page_1.data, null, 2)}</pre>
