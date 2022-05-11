<!--
    redirect / to /all
-->
<script context="module">
	export async function load() {
		return {
			redirect: 'kql',
			status: 302,
		}
	}
</script>
