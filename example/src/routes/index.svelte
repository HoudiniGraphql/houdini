<!--
    redirect / to /all
-->
<script context="module">
	import { KQL_AllItems } from '$houdini/stores'
	export async function load() {
		const result = KQL_AllItems.query()
		// result.from => Typing OK

		return {
			redirect: 'all',
			status: 302,
		}
	}
</script>

<!-- Typing OK -->
{$KQL_AllItems.data}
