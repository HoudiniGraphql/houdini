// externals
import * as recast from 'recast'
// locals
import '../../../jest.setup'
import { parseFile, ParsedSvelteFile } from './parse'

describe('parser tests', () => {
	test('happy path - separate module and instance script', () => {
		const doc = `
		<script context="module">
			console.log('module')
		</script>

		<script>
			console.log('instance')
		</script>
	`

		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("instance");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`69`)
		expect(result.instance?.end).toMatchInlineSnapshot(`115`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.module?.start).toMatchInlineSnapshot(`3`)
		expect(result.module?.end).toMatchInlineSnapshot(`64`)

		checkScriptBounds(doc, result)
	})

	test('happy path - start on first character', () => {
		const doc = `<script context="module">
				console.log('module')
			</script>`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.module?.start).toMatchInlineSnapshot(`0`)
		expect(result.module?.end).toMatchInlineSnapshot(`63`)

		checkScriptBounds(doc, result)
	})

	test('happy path - only module', () => {
		const doc = `
			<script context="module">
				console.log('module')
			</script>
		`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`67`)

		checkScriptBounds(doc, result)
	})

	test('happy path - only instance', () => {
		const doc = `
			<script>
				console.log('module')
			</script>
		`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`4`)
		expect(result.instance?.end).toMatchInlineSnapshot(`50`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})

	test('single quotes', () => {
		const doc = `
			<script context='module'>
				console.log('module')
			</script>
		`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`67`)

		checkScriptBounds(doc, result)
	})

	test('happy path - typescript', () => {
		const doc = `
			<script context="module" lang="ts">
				type Foo = { hello: string}
			</script>
		`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`
		type Foo = {
		    hello: string
		};
	`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`83`)

		checkScriptBounds(doc, result)
	})

	test('nested script block', () => {
		const doc = `
			<div>
				<script>
					console.log('inner')
				</script>
			</div>
		`

		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})

	test('script next to html', () => {
		const doc = `
			<script>
				console.log('script')
			</script>
			<div>
			</div>
		`

		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("script");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`4`)
		expect(result.instance?.end).toMatchInlineSnapshot(`50`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})

	test("logic in script doesn't break things", () => {
		const doc = `
			<script context='module'>
				if (1<2) {
					console.log('hello')
				}
			</script>
		`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`
		if (1 < 2) {
		    console.log("hello");
		}
	`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`88`)

		checkScriptBounds(doc, result)
	})

	test("logic in template doesn't break things", () => {
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
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`66`)

		checkScriptBounds(doc, result)
	})

	test('self-closing tags', () => {
		const doc = `
			<svelte:head>
				<link />
			</svelte:head>
			<script>
				console.log('hello')
			</script>
		`

		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`52`)
		expect(result.instance?.end).toMatchInlineSnapshot(`97`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})

	test('comments', () => {
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
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`42`)
		expect(result.instance?.end).toMatchInlineSnapshot(`87`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})

	test("else in template doesn't break things", () => {
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
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`66`)

		checkScriptBounds(doc, result)
	})

	test('expression in content', () => {
		const doc = `
			<script context='module'>
				console.log('hello')
			</script>
			<div>
				{hello}
			</div>
		`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`66`)

		checkScriptBounds(doc, result)
	})

	test('expression attribute', () => {
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
				<div attribute={foo > && <div 2} foo>
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
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.module?.start).toMatchInlineSnapshot(`306`)
		expect(result.module?.end).toMatchInlineSnapshot(`368`)

		checkScriptBounds(doc, result)
	})

	test('tabs to end tags', () => {
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
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`0`)
		expect(result.instance?.end).toMatchInlineSnapshot(`53`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})

	test('empty object in script', () => {
		const doc = `<script lang="ts">
		const example = object({});
	</script>
	 
	<div>hello</div>
	`

		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`const example = object({});`)
		expect(result.instance?.start).toMatchInlineSnapshot(`0`)
		expect(result.instance?.end).toMatchInlineSnapshot(`58`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})
})

function checkScriptBounds(doc: string, result?: ParsedSvelteFile | null | undefined) {
	if (!result) {
		return
	}

	if (result.module) {
		expect(doc[result.module.start]).toEqual('<')
		expect(doc[result.module.end]).toEqual('>')
	}

	if (result.instance) {
		expect(doc[result.instance.start]).toEqual('<')
		expect(doc[result.instance.end]).toEqual('>')
	}
}
