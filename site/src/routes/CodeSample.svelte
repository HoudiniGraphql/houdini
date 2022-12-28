<script>
	import { Highlight } from '~/components'
	import Block from './Block.svelte'

	const codeExample = `<script lang=”ts”>
  import { graphql } from '$houdini'

  const allItems = graphql(\`
    query AllTodoItems {
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

<div class={`code-example-container ${$$props.class}`}>
	<Block class="code-example block">
		<div class="code-example-header">
			<div class="code-example-filename">+page.svelte</div>
			<div class="code-example-location">
				src
				<span class="code-example-location-chevron">></span>
				routes
				<span class="code-example-location-chevron">></span>
				items
				<span class="code-example-location-chevron">></span>
				+page.svelte
			</div>
		</div>
		<div class="code-example-body">
			<div class="code-example-numbers">
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
	<p class="code-example-subtext">
		This is all you need to get going with SSR.&nbsp;&nbsp;&nbsp;🚀
	</p>
</div>

<style>
	:global(.code),
	.code-example-body {
		font-size: 14px !important;
		font-family: 'Fira Mono';
	}

	.code-example-numbers {
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

	.code-example-header {
		background: var(--grey);
		border-top-left-radius: 16px;
		width: 280px;
		padding: 8px 16px;
	}

	:global(.code-example) {
		width: 100%;
		padding: 0px;
	}
	.code-example-container {
		display: flex;
		flex-direction: column;
		gap: 20px;
		align-items: center;
	}

	.code-example-text {
		font-size: 16px;
		color: var(--light-grey);
	}
	.code-example-subtext {
		font-size: 14px;
		color: var(--light-grey);
	}
	.code-example-body {
		display: flex;
		flex-direction: row;
	}

	.code-example-body code {
		padding: 12px 0 16px 0;
	}

	.code-example-filename {
		color: white;
		font-family: 'Fira Sans';
		font-size: 16px;
		margin-bottom: 6px;
	}

	.code-example-location {
		color: #838797;
		font-family: 'Fira Mono';
		font-size: 12px;
	}

	.code-example-location-chevron {
		color: #91a2e5;
		font-size: 10px;
	}
</style>
