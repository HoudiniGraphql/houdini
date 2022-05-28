<!--
    redirect / to /all
-->
<script context="module">
	export async function load() {
		return {
			redirect: 'stores',
			status: 302,
		}
	}
</script>
