<script>
	import { Highlight } from '~/components'
	import Block from './Block.svelte'

	const codeExample = `<script lang=”ts”>
  import { graphql } from '$houdini'

  const allItems = graphql(\`
    query AllTodoItems @load {
      items {
        text
      }
    }
  \`)
\<\/script>

{#each $allItems.data.items as item}
  <div>{item.text}</div>
{/each}`
</script>

<div class={`container ${$$props.class}`}>
	<Block class="code-example block">
		<div class="header">
			<div class="filename">+page.svelte</div>
			<div class="location">
				src
				<span class="location-chevron">></span>
				routes
				<span class="location-chevron">></span>
				items
				<span class="location-chevron">></span>
				+page.svelte
			</div>
		</div>
		<div class="body">
			<div class="numbers">
				<div>1</div>
				<div>2</div>
				<div>3</div>
				<div>4</div>
				<div>5</div>
				<div>6</div>
				<div>7</div>
				<div>8</div>
				<div>9</div>
				<div>10</div>
				<div>11</div>
				<div>12</div>
				<div>13</div>
				<div>14</div>
				<div>15</div>
			</div>
			<code>
				<Highlight code={codeExample} class="code" />
			</code>
		</div>
	</Block>
	<p class="subtext">This is all you need to get going with SSR.&nbsp;&nbsp;&nbsp;🚀</p>
</div>

<style>
	:global(.code),
	.body {
		font-size: 14px !important;
		font-family: 'Roboto Mono';
	}

	.numbers {
		padding: 4px;
		line-height: 1.5rem;
		width: 28px;
		flex-grow: 0;
		border-right: 1px solid var(--grey);
		color: var(--grey);
		margin-right: 8px;
		text-align: center;
		padding-top: 16px;
		padding-bottom: 16px;
	}

	.header {
		background: var(--grey);
		width: 280px;
		padding: 8px 16px;
	}

	:global(.code-example) {
		width: 100%;
		padding: 0px;
		overflow: hidden;
	}
	.container {
		display: flex;
		flex-direction: column;
		gap: 20px;
		align-items: center;
	}

	.text {
		font-size: 16px;
		color: var(--light-grey);
	}
	.subtext {
		font-size: 14px;
		color: var(--light-grey);
	}
	.body {
		display: flex;
		flex-direction: row;
	}

	.body code {
		padding: 12px 0 16px 0;
	}

	.filename {
		color: white;
		font-family: 'Fira Sans';
		font-size: 16px;
		margin-bottom: 6px;
	}

	.location {
		color: #838797;
		font-family: 'Roboto Mono';
		font-size: 12px;
	}

	.location-chevron {
		color: #91a2e5;
		font-size: 10px;
	}
</style>
