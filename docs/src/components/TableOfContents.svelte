<script>
	import { page } from '$app/stores'
	import { crossfade } from 'svelte/transition'

	const [send, receive] = crossfade({})

	const pages = [
		{ name: 'Introduction', href: '/docs' },
		{ name: 'Getting Started', href: '/docs/getting-started' },
	]

	const otherPages = [{ name: 'Contributing', href: '/docs/contributing' }]
</script>

<aside>
	<details open>
		<summary>
			<div class="summary-arrow-wrapper">
				<div class="arrow arrow-large" />
			</div>
		</summary>
		<div class="scroll-area">
			<div class="header">
				<a href="/">
					<img
						src="/images/logo.png"
						height="70"
						alt="Houdini logo. Looks like a hat with rabbit ears coming out of it"
					/>
				</a>
			</div>
			<nav>
				<ul>
					{#each pages as { href, name }}
						<li class:selected={href === $page.path}>
							{#if href === $page.path}
								<div
									in:receive={{ key: 'a' }}
									out:send={{ key: 'a' }}
									class="arrow-wrapper"
								>
									<div class="arrow arrow-small" />
								</div>
							{/if}
							<a {href} tabindex="0">{name}</a>
						</li>
					{/each}
					<hr />
					{#each otherPages as { href, name }}
						<li class:selected={href === $page.path}>
							{#if href === $page.path}
								<div
									in:receive={{ key: 'a' }}
									out:send={{ key: 'a' }}
									class="arrow-wrapper"
								>
									<div class="arrow arrow-small" />
								</div>
							{/if}
							<a {href} tabindex="0">{name}</a>
						</li>
					{/each}
				</ul>
			</nav>
		</div>
	</details>
</aside>

<style>
	aside {
		grid-column: 1;
		height: 100vh;
	}

	.scroll-area {
		overflow-y: scroll;
		height: 100%;
		padding: 2rem 2rem 2rem 3rem;
	}

	details {
		width: 300px;
		left: -290px;
		background-color: #fafbff;
		height: 100%;
		position: fixed;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
		border-right: 1px solid rgba(0, 0, 0, 0.05);
		transition: left 300ms;
	}

	details[open] {
		left: 0;
	}

	summary {
		list-style: none;
		position: absolute;
		right: -20px;
		top: 50vh;
		cursor: pointer;
		background-color: #fafbff;
		border-radius: 50rem;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}

	summary::-webkit-details-marker,
	summary::marker {
		display: none;
	}

	.summary-arrow-wrapper {
		transition: transform 300ms;
		transform: rotate(-135deg);
	}

	details:not([open]) .summary-arrow-wrapper {
		transform: rotate(45deg);
	}

	.header {
		display: flex;
		margin-left: -30px;
		align-items: baseline;
		margin-bottom: 1rem;
	}

	.title {
		color: var(--color1);
		margin-bottom: 1rem;
		margin-left: 0.5rem;
	}

	.title small {
		color: var(--color2);
		font-size: 1rem;
	}

	li {
		font-weight: 600;
		font-size: 1rem;
		line-height: 1.5rem;
		color: var(--color1);
		margin-bottom: 0.25rem;
		position: relative;
		list-style: none;
	}

	li.selected {
		color: var(--color2);
	}

	.arrow-wrapper {
		left: -15px;
		position: absolute;
		top: 50%;
		display: inline-block;
	}

	.arrow {
		border-top: 2px solid var(--color2);
		border-right: 2px solid var(--color2);
	}

	.arrow-small {
		width: 7px;
		height: 7px;
		transform: rotate(45deg) translateY(-50%);
	}

	.arrow-large {
		width: 12px;
		height: 12px;
	}

	a {
		text-decoration: none;
	}

	li a {
		display: flex;
		align-items: center;
		border-radius: 0.5rem;
		padding: 0.25rem 0.5rem;
	}

	li a:hover {
		background-color: var(--color3);
	}

	hr {
		height: 1px;
		background-color: var(--color3);
		margin-top: 1rem;
		margin-bottom: 1rem;
	}
</style>
