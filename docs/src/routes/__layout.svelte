<slot />

<style global>
	:root {
		--color1: #222;
		--color2: rgb(253, 64, 18);
		--color3: rgba(0, 0, 0, 0.1);
	}

	* {
		margin: 0;
		padding: 0;
		border: none;
		background-color: transparent;
		box-sizing: border-box;
		color: inherit;
		font-family: Arial, Helvetica, sans-serif;
		font-size: inherit;
	}

	pre {
		border-radius: 0.25rem;
	}

	h1,
	h2,
	h3,
	h4,
	h5,
	h6 {
		color: var(--color1);
		font-weight: 50;
		margin-bottom: 1rem;
	}

	h1 {
		font-size: 3rem;
		line-height: 1;
	}

	h2 {
		font-size: 2.25rem;
		line-height: 2.5rem;
	}

	h3 {
		font-size: 1.875rem;
		line-height: 2.25rem;
	}

	h4 {
		font-size: 1.5rem;
		line-height: 2rem;
	}

	h5 {
		font-size: 1.25rem;
		line-height: 1.75rem;
	}

	h6 {
		font-size: 1.125rem;
		line-height: 1.75rem;
	}

	p,
	li,
	a {
		font-size: 1rem;
		line-height: 1.5rem;
	}

	.wrapper {
		display: grid;
		grid-template-columns:
			1fr
			min(65ch, 100%)
			1fr;
	}

	@media (max-width: 600px) {
		.wrapper {
			display: grid;
			grid-template-columns: 1fr min(60ch, calc(100% - 64px)) 1fr;
			grid-column-gap: 32px;
		}
	}

	table {
		outline: 0;
		border-collapse: collapse;
		margin: 1rem auto 1rem auto;
	}

	thead {
		color: var(--color1);
	}

	tr:not(:last-child),
	thead tr {
		border-bottom: 1px solid var(--color3);
	}

	td:not(:last-child),
	th:not(:last-child) {
		border-right: 1px solid var(--color3);
	}

	th,
	td {
		padding: 0.5rem 1rem;
		text-align: left;
	}
</style>
