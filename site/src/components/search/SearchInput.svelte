<script>
	import { onMount } from 'svelte'
	import { Icon } from '~/components'
	import { searching } from './stores'

	let modifier = 'Ctrl'

	onMount(() => {
		// check the current platform to fix the search modifier
		if (navigator.platform === 'MacIntel') {
			modifier = '⌘'
		}
	})
</script>

<button class={`container ${$$props.class}`} on:click={() => ($searching = true)} id={$$props.id}>
	<div class="column">
		<Icon name="search" strokeWidth="3px" />
		<span>Search</span>
	</div>
	<span class="column" id="search-keycombo" aria-hidden="true">
		{modifier} + K
	</span>
</button>

<style>
	button {
		border: 2px solid var(--discreet);
		color: #475365;
		border-radius: 8px;
		padding: 3px 11px;
		display: flex;
		flex-direction: row;
		align-items: center;
		font-size: 16px;
		align-self: center;
		justify-content: space-between;
		background: none;
		cursor: pointer;
		font-family: 'Hind', sans-serif;
		outline: none;
	}

	@media (max-width: 1000px) {
		button {
			flex-grow: 1;
		}
	}

    @media (max-width: 480px) {
        #search-keycombo {
            display: none;
        }
    }

	span {
		margin-left: 10px;
		margin-top: 4px;
	}

	.column {
		height: 100%;
		display: flex;
		flex-direction: row;
		align-items: center;
	}

	button:hover,
	button:focus {
		color: #7e90ac;
		border-color: #7e90ac;
	}
</style>
