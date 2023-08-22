<script lang="ts">
	import type { PageData } from './$houdini';

	export let data: PageData;

	$: ({ Page_2 } = data);
</script>

<h2>Page 2</h2>

<pre>{JSON.stringify($Page_2.data, null, 2)}</pre>
