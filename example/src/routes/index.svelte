<!--
    redirect / to /all
-->
<script context="module">
	export async function load() {
		return {
			redirect: '/all',
			status: 302,
		}
	}
</script>
