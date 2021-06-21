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

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
	})

	test('happy path - only module', () => {
		// parse the string
		const result = parseFile(`
            <script context="module">
                console.log('module')
            </script>
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
	})

	test('happy path - only instance', () => {
		// parse the string
		const result = parseFile(`
            <script>
                console.log('module')
            </script>
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("module");`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
	})

	test('single quotes', () => {
		// parse the string
		const result = parseFile(`
            <script context='module'>
                console.log('module')
            </script>
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
	})

	test('happy path - typescript', () => {
		// parse the string
		const result = parseFile(`
            <script context="module" lang="ts">
                console.log('module')
            </script>
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
	})

	test('nested script block', () => {
		// parse the string
		const result = parseFile(`
            <div>
				<script>
					console.log('non-svelte script block')
				</script>
            </div>
        `)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
	})
})
