import { parseFile } from './parse'
import '../../../jest.setup'

describe('parser tests', () => {
	test('happy path - separate module and instance script', () => {
		// parse the string
		const result = parseFile(`
            <script context="module">
                console.log('module')
            </script>

            <script>
                console.log('instance')
            </script>
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("instance");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`112`)
		expect(result.instance?.end).toMatchInlineSnapshot(`181`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.module?.start).toMatchInlineSnapshot(`13`)
		expect(result.module?.end).toMatchInlineSnapshot(`97`)
	})

	test('happy path - start on first character', () => {
		// parse the string
		const result = parseFile(`<script context="module">
                console.log('module')
            </script>`)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.module?.start).toMatchInlineSnapshot(`0`)
		expect(result.module?.end).toMatchInlineSnapshot(`84`)
	})

	test('happy path - only module', () => {
		// parse the string
		const result = parseFile(`
            <script context="module">
                console.log('module')
            </script>
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.module?.start).toMatchInlineSnapshot(`13`)
		expect(result.module?.end).toMatchInlineSnapshot(`97`)
	})

	test('happy path - only instance', () => {
		// parse the string
		const result = parseFile(`
            <script>
                console.log('module')
            </script>
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`13`)
		expect(result.instance?.end).toMatchInlineSnapshot(`80`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)
	})

	test('single quotes', () => {
		// parse the string
		const result = parseFile(`
            <script context='module'>
                console.log('module')
            </script>
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.module?.start).toMatchInlineSnapshot(`13`)
		expect(result.module?.end).toMatchInlineSnapshot(`97`)
	})

	test('happy path - typescript', () => {
		// parse the string
		const result = parseFile(`
            <script context="module" lang="ts">
				type Foo = { hello: string}
            </script>
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`
		type Foo = {
		    hello: string
		};
	`)
		expect(result.module?.start).toMatchInlineSnapshot(`13`)
		expect(result.module?.end).toMatchInlineSnapshot(`101`)
	})

	test('nested script block', () => {
		// parse the string
		const result = parseFile(`
	        <div>
				<script>
					console.log('inner')
				</script>
	        </div>
	    `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)
	})

	test('script next to html', () => {
		// parse the string
		const result = parseFile(`
			<script>
				console.log('script')
			</script>
	        <div>
	        </div>
	    `)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("script");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`4`)
		expect(result.instance?.end).toMatchInlineSnapshot(`50`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)
	})

	test("logic in script doesn't break things", () => {
		// parse the string
		const result = parseFile(`
            <script context='module'>
				if (1<2) {
					console.log('hello')
				}
            </script>
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`
		if (1 < 2) {
		    console.log("hello");
		}
	`)
		expect(result.module?.start).toMatchInlineSnapshot(`13`)
		expect(result.module?.end).toMatchInlineSnapshot(`106`)
	})

	test("logic in template doesn't break things", () => {
		// parse the string
		const result = parseFile(`
            <script context='module'>
				console.log('hello')
            </script>
			{#if foo < 2}
				<div>
					hello
				</div>
			{/if}
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.module?.start).toMatchInlineSnapshot(`13`)
		expect(result.module?.end).toMatchInlineSnapshot(`84`)
	})

	test('comments', () => {
		// parse the string
		const result = parseFile(`
            <!-- <script context='module'> -->
			<script>
				console.log('hello')
            </script>
			{#if foo < 2}
				<div>
					hello
				</div>
			{/if}
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`51`)
		expect(result.instance?.end).toMatchInlineSnapshot(`105`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)
	})

	test("else in template doesn't break things", () => {
		// parse the string
		const result = parseFile(`
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
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.module?.start).toMatchInlineSnapshot(`13`)
		expect(result.module?.end).toMatchInlineSnapshot(`84`)
	})

	test('expression in content', () => {
		// parse the string
		const result = parseFile(`
            <script context='module'>
				console.log('hello')
            </script>
			<div>
				{hello}
			</div>
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.module?.start).toMatchInlineSnapshot(`13`)
		expect(result.module?.end).toMatchInlineSnapshot(`84`)
	})

	test('expression attribute', () => {
		// parse the string
		const result = parseFile(`
            <script context='module'>
				console.log('hello')
            </script>
			{#if foo < 2}
				<div>
					hello
				</div>
			{:else if foo < 4}
				<div attribute={{foo}}>
					hello
				</div>
			{/if}
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.module?.start).toMatchInlineSnapshot(`13`)
		expect(result.module?.end).toMatchInlineSnapshot(`84`)
	})
})
