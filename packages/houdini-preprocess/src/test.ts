// external imports
import * as recast from 'recast'
import * as graphql from 'graphql'
// local imports
import { applyTransforms } from '.'
import * as types from './types'

const typeBuilders = recast.types.builders

const config: types.PreProcessorConfig = {
	artifactDirectory: '',
	artifactDirectoryAlias: '',
	schema: graphql.buildSchema(`type Query { foo: Int! }`),
}

describe('preprocessor can replace content', function () {
	test('can update instance content', async function () {
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
			async (document: types.TransformDocument) => {
				// @ts-ignore
				// we're going to set the content of the instance to a literal expression
				document.instance.content.body[0] = typeBuilders.expressionStatement(
					typeBuilders.stringLiteral('hello')
				)
			},
		]

		// apply the transforms
		const result = await applyTransforms(config, { content, filename: 'test' }, { transforms })

		// make sure we got the result back
		expect(result.trim()).toBe(`<script>"hello";</script>
		<div>
		helllo
		</div>`)
	})

	test('can update instance content', async function () {
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
			async (document: types.TransformDocument) => {
				// @ts-ignore
				// we're going to set the content of the instance to a literal expression
				document.module.content.body.push(
					// @ts-ignore
					typeBuilders.expressionStatement(typeBuilders.stringLiteral('hello'))
				)
			},
		]

		// apply the transforms
		const result = await applyTransforms(config, { content, filename: 'test' }, { transforms })

		// make sure we got the result back
		expect(result.trim()).toBe(`<script context="module">"hello";</script>
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
			async (document: types.TransformDocument) => {
				// @ts-ignore
				// we're going to set the content of the instance to a literal expression
				document.module.content.body.push(
					// @ts-ignore
					typeBuilders.expressionStatement(typeBuilders.stringLiteral('hello'))
				)
			},
		]

		// apply the transforms
		const result = await applyTransforms(config, { content, filename: 'test' }, { transforms })

		// make sure we got the result back
		expect(result.trim()).toBe(`<script context="module" lang="ts">"hello";</script>`)
	})
})
