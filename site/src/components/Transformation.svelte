<script>
	import { Icon } from '~/components'
</script>

<div>
	<slot name="from" />
	<p>
		<Icon name="arrow-down" height="30px" width="30px" />
	</p>
	<slot name="to" />
</div>

<style>
	div {
		display: flex;
		flex-direction: column;
		align-items: center;
		overflow-x: auto;
		margin-bottom: 15px;
	}

	p {
		margin-bottom: -10px;
	}
</style>
