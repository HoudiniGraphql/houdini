<!--
    redirect / to /all
-->
<script context="module">
	import { KQL_AllItems } from '$houdini/stores'
	export async function load() {
		const result = KQL_AllItems.query()

		return {
			redirect: 'all',
			status: 302,
		}
	}
</script>

<!-- How to get typings here? -->
{$KQL_AllItems.data}
