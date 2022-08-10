<script>
	import flexsearch from 'flexsearch'
	import { onMount } from 'svelte'
	import { Icon } from '~/components'

	import { searching } from './stores'
	import { trap, focusable_children } from './focus'

	let results = []
	let lookup = new Map()
	let index
	let query = ''

	let container

	onMount(async () => {
		const response = await fetch('/_content')
		index = new flexsearch.Index({
			tokenize: 'forward'
		})

		for (const passage of await response.json()) {
			const title = passage.breadcrumb[passage.breadcrumb.length - 1]
			lookup.set(passage.href, {
				title,
				href: passage.href,
				breadcrumbs: passage.breadcrumb.slice(0, -1),
				content: passage.content
			})
			index.add(passage.href, `${title} ${passage.content}`)
		}
	})

	function update() {
		const searchResult = (index ? index.search(query) : []).map((href) => lookup.get(href))

		// sort the search results so that api references come before guides
		searchResult.sort((a, b) => {
			// flip the order if we are comparing one guide and one api
			if (a.breadcrumbs[0] === 'Api' && b.breadcrumbs[0] === 'Guides') {
				return -1
			}
			if (a.breadcrumbs[0] === 'Guides' && b.breadcrumbs[0] === 'Api') {
				return 1
			}

			// otherwise, keep the order the same
			return 0
		})

		// update the component state
		results = searchResult
	}
	function escape(text) {
		return text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
	}
	function excerpt(content, query) {
		const index = content.toLowerCase().indexOf(query.toLowerCase())
		if (index === -1) {
			return content.slice(0, 100)
		}
		const prefix = index > 20 ? `…${content.slice(index - 15, index)}` : content.slice(0, index)
		const suffix = content.slice(
			index + query.length,
			index + query.length + (80 - (prefix.length + query.length))
		)
		return (
			escape(prefix) +
			`<mark>${escape(content.slice(index, index + query.length))}</mark>` +
			escape(suffix)
		)
	}

	function navigate(href) {
		close()
	}
	function close() {
		if ($searching) {
			$searching = false
			const scroll = -parseInt(document.body.style.top || '0')
			document.body.style.position = ''
			document.body.style.top = ''
			document.body.tabIndex = -1
			document.body.focus()
			document.body.removeAttribute('tabindex')
			window.scrollTo(0, scroll)
		}
	}
</script>

{#if $searching}
	<div class="container" on:click={() => ($searching = false)} id="search-dialog">
		<div
			class="body"
			on:click={(e) => e.stopPropagation()}
			bind:this={container}
			use:trap
			on:keydown={(e) => {
				if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
					e.preventDefault()
					const group = focusable_children(e.currentTarget)

					// when using arrow keys (as opposed to tab), don't focus buttons
					const selector = 'a, input'

					if (e.key === 'ArrowDown') {
						group.next(selector)
					} else {
						group.prev(selector)
					}
				}
			}}
		>
			<!-- svelte-ignore a11y-autofocus -->
			<input
				autofocus
				on:input={(e) => {
					query = e.target.value
					update()
				}}
				on:keydown={(e) => {
					if (e.key === 'Enter') {
						if (results.length > 0) {
							container.querySelector('a').click()
						}
					}
				}}
				value={query}
				placeholder="Search"
				aria-describedby="search-description"
			/>
			<Icon name="search" class="search-input-search-icon" stroke="#475365" />
			<button aria-label="Close" on:click={() => ($searching = false)} class="close-button">
				<Icon name="x" class="search-input-close-icon" stroke="#475365" />
			</button>

			<div class="results">
				{#if results.length > 0}
					<ul>
						{#each results as result, i}
							<!-- svelte-ignore a11y-mouse-events-have-key-events -->
							<li>
								<a on:click={() => navigate(result.href)} href={result.href}>
									<small>
										{#each result.breadcrumbs as value, i}
											{value}
											{#if i !== result.breadcrumbs.length - 1}
												<Icon name="chevron-right" class="breadcrumb-icon" />
											{/if}
										{/each}
									</small>
									<strong>{@html excerpt(result.title, query)}</strong>
									<span>{@html excerpt(result.content, query)}...</span>
								</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="info">No results</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<svelte:window
	on:keydown={(e) => {
		// if the user pressed ctrl+k, open the search dialog
		if (e.key === 'k' && (navigator.platform === 'MacIntel' ? e.metaKey : e.ctrlKey)) {
			e.preventDefault()
			$searching = !$searching
		}

		if (e.code === 'Escape') {
			$searching = false
		}
	}}
/>

<style>
	.container {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;

		z-index: 20;
		background: rgba(71, 83, 101, 0.5);
		padding-top: 6.25rem;

		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.body {
		background: #161b22;
		max-width: 31.25rem;
		width: calc(100% - 20px);
		border-radius: 11px;
		position: relative;

		box-shadow: 0 5px 20px 20px rgba(22, 27, 34, 0.2);

		color: white;
	}

	input {
		height: 3.25rem;
		width: 100%;
		border-top-left-radius: 11px;
		border-top-right-radius: 11px;
		border: none;
		box-sizing: border-box;
		padding-left: 3rem;
		padding-right: 3rem;
		outline: none;
		font-size: 1rem;
		line-height: 3.25rem;
		color: #475365;
		position: sticky;
	}

	:global(.search-input-search-icon) {
		position: absolute;
		top: calc(1rem + 2px);
		left: 1rem;
		height: 1rem;
	}

	.close-button {
		position: absolute;
		top: 1rem;
		right: 0.5rem;
		background: none;
		border: none;
		cursor: pointer;
	}

	:global(.search-input-close-icon) {
		width: 1.25rem !important;
		height: 1.25rem !important;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 20px;
		overflow-y: auto;
		max-height: 450px;

		margin-top: 20px;
		padding-bottom: 30px;
	}

	a {
		display: flex;
		flex-direction: column;
		text-decoration: none;
		gap: 6px;
		padding: 10px 15px;
	}

	a:hover,
	a:focus {
		background: #1b2129;
		outline: none;
	}

	small {
		font-size: 14px;
		font-family: 'Hind', sans-serif;
		color: #7687a0;
	}

	strong {
		font-family: 'Hind', sans-serif;
		font-size: 1rem;
		color: white;
	}

	span {
		color: white;
		font-family: 'Hind', sans-serif;
		font-size: 1rem;
		line-height: 1.5rem;
	}

	:global(.breadcrumb-icon) {
		margin-bottom: -3px;
	}

	:global(mark) {
		background-color: rgb(71, 83, 101);
		color: white;
	}

	p {
		font-family: 'Hind', sans-serif;
		color: white;
		font-size: 1rem;
		padding: 30px 15px;
	}
</style>
