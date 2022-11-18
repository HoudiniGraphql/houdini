<script>
	import { Highlight } from '~/components'

	export let title
	export let description
	export let href
	export let example
	export let language = 'typescript'
</script>

<a class="api-showcase-container" {href} data-sveltekit-prefetch>
	<div class="left-column">
		<h3>
			{title}
		</h3>
		<p>
			{description}
		</p>

		<Highlight code={example} class="hidden-big" {language} />
		<button tabindex="-1"> More Info </button>
	</div>
	<Highlight code={example} class="hidden-small" {language} />
</a>

<style>
	.api-showcase-container {
		display: flex;
		flex-direction: row;
		justify-content: flex-start;
		gap: 4rem;
		background: #11141a;
		border-radius: 10px;
		padding: 2rem 2.5rem;
		cursor: pointer;
		color: white !important;
		margin-bottom: 30px;
	}

	h3 {
		margin-top: 0 !important;
		margin-bottom: 0;
		padding-top: 0;
	}

	.left-column {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: 15rem;
	}

	:global(.api-showcase-container pre) {
		margin-bottom: 0 !important;
		padding-left: 0 !important;
		padding-right: 0 !important;
	}

	p {
		margin-bottom: 0 !important;
		white-space: normal !important;
	}

	button {
		display: inline-block;
		width: 9.5rem;
		background: #ff3e00;
		color: white;
		font-family: 'Hind', sans-serif;
		font-weight: 500;
		border: none;
		font-size: 1.25rem;
		border-radius: 0.5rem;
		height: 2.6rem;
		cursor: pointer;
		box-shadow: 1px 2px 25px 3px rgba(0, 0, 0, 0.1);
	}

	.api-showcase-container:hover button {
		background: #b42e02;
	}

	@media (min-width: 1200px) {
		:global(.hidden-big) {
			display: none;
		}
	}

	@media (max-width: 1200px) {
		.api-showcase-container {
			flex-direction: column;
		}

		:global(.api-showcase-container pre) {
			padding: 0 !important;
			margin-bottom: 30px !important;
		}

		:global(.hidden-small) {
			display: none;
		}

		.left-column {
			width: 100%;
		}

		h3 {
			margin-bottom: 0 !important;
		}
	}
</style>
