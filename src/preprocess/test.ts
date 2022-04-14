// external imports
import * as recast from 'recast'
// local imports
import { Config } from '../common'
import applyTransforms from './transforms'
import * as types from './types'

const typeBuilders = recast.types.builders

const config: Config = new Config({
	filepath: 'hello',
	schema: `type Query { foo: Int! }`,
	sourceGlob: '',
})

describe('preprocessor can replace content', function () {
	test('update instance content', async function () {
		// the source
		const content = `
        <script>

		</script>
		<div>
		helllo
		</div>
`

		// lets apply a simple transform that replaces the content with the literal expression 'hello'
		const transforms = [
			async (config: Config, document: types.TransformDocument) => {
				// @ts-ignore
				// we're going to set the content of the instance to a literal expression
				document.instance.content.body[0] = typeBuilders.expressionStatement(
					typeBuilders.stringLiteral('hello')
				)
			},
		]

		// apply the transforms
		const result = await applyTransforms(config, { content, filename: 'test' }, transforms)

		// make sure we got the result back
		expect(result.code.trim()).toBe(`<script>"hello";</script>
		<div>
		helllo
		</div>`)
	})

	test('update module content', async function () {
		// the source
		const content = `
        <script context="module">

		</script>
		<div>
		helllo
		</div>
`

		// lets apply a simple transform that replaces the content with the literal expression 'hello'
		const transforms = [
			async (config: Config, document: types.TransformDocument) => {
				// @ts-ignore
				// we're going to set the content of the instance to a literal expression
				document.module.content.body.push(
					// @ts-ignore
					typeBuilders.expressionStatement(typeBuilders.stringLiteral('hello'))
				)
			},
		]

		// apply the transforms
		const result = await applyTransforms(config, { content, filename: 'test' }, transforms)

		// make sure we got the result back
		expect(result.code.trim()).toBe(`<script context="module">"hello";</script>
		<div>
		helllo
		</div>`)
	})

	test('retains attributes', async function () {
		// the source
		const content = `
        <script context="module" lang="ts">

		</script>
`

		// lets apply a simple transform that replaces the content with the literal expression 'hello'
		const transforms = [
			async (config: Config, document: types.TransformDocument) => {
				// @ts-ignore
				// we're going to set the content of the instance to a literal expression
				document.module.content.body.push(
					// @ts-ignore
					typeBuilders.expressionStatement(typeBuilders.stringLiteral('hello'))
				)
			},
		]

		// apply the transforms
		const result = await applyTransforms(config, { content, filename: 'test' }, transforms)

		// make sure we got the result back
		expect(result.code.trim()).toBe(`<script context="module" lang="ts">"hello";</script>`)
	})

	test('parses typescript', async function () {
		// the source
		const content = `
        <script lang="ts">
			type Foo = { hello: string }
		</script>
`

		// apply the transforms
		await expect(
			applyTransforms(config, { content, filename: 'test' }, [])
		).resolves.toBeTruthy()

		// apply the transforms
		const result = await applyTransforms(config, { content, filename: 'test' }, [])

		// make sure we got the result back
		expect(result.code.trim()).toMatchInlineSnapshot(`
		"<script lang=\\"ts\\">type Foo = {
		    hello: string
		};</script>"
	`)
	})

	test('modify both at the same time (module above instance)', async function () {
		// the source
		const content = `
        <script context="module">

		</script>
		<script>

		</script>
`

		// lets apply a simple transform that replaces the content with the literal expression 'hello'
		const transforms = [
			async (config: Config, document: types.TransformDocument) => {
				// @ts-ignore
				// we're going to set the content of the instance to a literal expression
				document.module.content.body.push(
					// @ts-ignore
					typeBuilders.expressionStatement(typeBuilders.stringLiteral('hello'))
				)
				// @ts-ignore
				// we're going to set the content of the instance to a literal expression
				document.instance.content.body.push(
					// @ts-ignore
					typeBuilders.expressionStatement(typeBuilders.stringLiteral('world'))
				)
			},
		]

		// apply the transforms
		const result = await applyTransforms(config, { content, filename: 'test' }, transforms)

		// make sure we got the result back
		expect(result.code.trim()).toBe(`<script context="module">"hello";</script>
		<script>"world";</script>`)
	})

	test('modify both at the same time (instance above module)', async function () {
		// the source
		const content = `<script>

		</script>
        <script context="module">

		</script>`

		// lets apply a simple transform that replaces the content with the literal expression 'hello'
		const transforms = [
			async (config: Config, document: types.TransformDocument) => {
				// @ts-ignore
				// we're going to set the content of the instance to a literal expression
				document.module.content.body.push(
					// @ts-ignore
					typeBuilders.expressionStatement(typeBuilders.stringLiteral('hello'))
				)
				// @ts-ignore
				// we're going to set the content of the instance to a literal expression
				document.instance.content.body.push(
					// @ts-ignore
					typeBuilders.expressionStatement(typeBuilders.stringLiteral('world'))
				)
			},
		]

		// apply the transforms
		const result = await applyTransforms(config, { content, filename: 'test' }, transforms)

		// make sure we got the result back
		expect(result.code.trim()).toBe(`<script>"world";</script>
        <script context="module">"hello";</script>`)
	})

	test('add module', async function () {
		// the source
		const content = `
        <script></script>
		<div>
		helllo
		</div>
`

		// lets apply a simple transform that replaces the content with the literal expression 'hello'
		const transforms = [
			async (config: Config, document: types.TransformDocument) => {
				// we're going to set the content of the instance to a literal expression
				document.module = {
					start: 0,
					end: 0,
					// @ts-ignore
					content: typeBuilders.program([]),
				}
			},
		]

		// apply the transforms
		const result = await applyTransforms(config, { content, filename: 'test' }, transforms)

		// make sure we got the result back
		expect(result.code.trim()).toBe(`<script context="module"></script>
        <script></script>
		<div>
		helllo
		</div>`)
	})

	test('add instance', async function () {
		// the source
		const content = `<script context="module">
		</script>
		<div>
		helllo
		</div>
`

		// lets apply a simple transform that replaces the content with the literal expression 'hello'
		const transforms = [
			async (config: Config, document: types.TransformDocument) => {
				// @ts-ignore
				// we're going to set the content of the instance to a literal expression
				document.instance = {
					type: 'Script',
					start: 0,
					end: 0,
					context: '',
					// @ts-ignore
					content: typeBuilders.program([]),
				}
			},
		]

		// apply the transforms
		const result = await applyTransforms(config, { content, filename: 'test' }, transforms)

		// make sure we got the result back
		expect(result.code.trim()).toBe(`<script></script><script context="module"></script>
		<div>
		helllo
		</div>`)
	})
})
