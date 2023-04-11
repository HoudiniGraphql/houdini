import { test, expect, describe } from 'vitest'

import { parseSvelte } from './extract'

describe('parser tests', () => {
	test('happy path - separate module and instance script', async () => {
		const doc = `
		<script>
			console.log('instance')
		</script>
	`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot("console.log('instance')")
	})

	test('happy path - start on first character', async () => {
		const doc = `<script>
				console.log('module')
			</script>`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot("console.log('module')")
	})

	test('single quotes', async () => {
		const doc = `
			<script context='module'>
				console.log('module')
			</script>
		`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test('happy path - typescript', async () => {
		const doc = `
			<script lang="ts">
				type Foo = { hello: string }
			</script>
		`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot('type Foo = { hello: string }')
	})

	test('nested script block', async () => {
		const doc = `
			<div>
				<script>
					console.log('inner')
				</script>
			</div>
		`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test('script next to html', async () => {
		const doc = `
			<script>
				console.log('script')
			</script>
			<div>
			</div>
		`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot("console.log('script')")
	})

	test("logic in script doesn't break things", async () => {
		const doc = `
			<script context='module'>
				if (1<2) {
					console.log('hello')
				}
			</script>
		`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test("logic in template doesn't break things", async () => {
		const doc = `
			<script context='module'>
				console.log('hello')
			</script>
			{#if foo < 2}
				<div>
					hello
				</div>
			{/if}
		`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test('self-closing tags', async () => {
		const doc = `
			<svelte:head>
				<link />
			</svelte:head>
			<script>
				console.log('hello')
			</script>
		`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot("console.log('hello')")
	})

	test('comments', async () => {
		const doc = `
			<!-- <script context='module'> -->
			<script>
				console.log('hello')
			</script>
			{#if foo < 2}
				<div>
					hello
				</div>
			{/if}
		`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot("console.log('hello')")
	})

	test("else in template doesn't break things", async () => {
		const doc = `
			<script context='module'>
				console.log('hello')
			</script>
			{#if foo < 2}
				<div>
					hello
				</div>
			{:else if foo < 4}
				<div>
					hello
				</div>
			{/if}
		`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test('expression in content', async () => {
		const doc = `
			<script context='module'>
				console.log('hello')
			</script>
			<div>
				{hello}
			</div>
		`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test('expression attribute', async () => {
		const doc = `
			{#if foo < 2}
				<div>
					hello
				</div>
			{:else if foo < 4}
				<!--
					the crazy <div is to trick the parser into thinking there's
					a new tag inside of an expression
				-->
				<div attribute={foo > 2 && div < 2} foo>
					hello
					<div>
						inner
					</div>
				</div>
			{/if}
			<script context='module'>
				console.log('hello')
			</script>
		`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test('tabs to end tags', async () => {
		const doc = `<script lang="ts">
			console.log('hello')
		</script>

		<header
			class="sticky flex items-center justify-between h-16 top-0 inset-x-0 max-w-7xl px-2 xl:px-0 mx-auto"
		>

			<svg
			class="w-6 h-6"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			><path
			/>
				hello
			</svg>
		</header>
	`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot("console.log('hello')")
	})

	test("styling tag parse errors don't fail (postcss support)", async () => {
		const doc = `<script lang="ts">
		const example = object({});
	</script>
	<style>
		.test { 
			&_title {
				width: 500px;
				@media (max-width: 500px) {
					width: auto;
				}
				body.is_dark & {
					color: white;
				}
			}
			img {
				display: block;
			}
		}
	</style>

	<div>hello</div>
	`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`const example = object({});`)
	})

	test('empty object in script', async () => {
		const doc = `<script lang="ts">
		const example = object({});
	</script>

	<div>hello</div>
	`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`const example = object({});`)
	})
})
