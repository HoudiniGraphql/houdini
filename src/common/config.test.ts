import * as graphql from 'graphql'
import path from 'path'
import { getConfig } from './config'

const schema = graphql.buildSchema(`
        type User { 
            id: ID!
            name: String!
        }

        type Query { 
            users: [User!]!
        }
    `)
const defaultConfig = {
	sourceGlob: 'NO NEED',
	schema,
	configFile: path.join(process.cwd(), 'integration/houdini.config.js'),
}

test('absolute filepath should be a route', async function () {
	const config = await getConfig(defaultConfig)
	const isRoute = config.isRoute(
		'/home/mysuperLocation/houdini/integration/src/routes/preprocess/query/layout/__layout.svelte'
	)
	expect(isRoute).toBe(true)
})

test('relative filepath should be a route', async function () {
	const config = await getConfig(defaultConfig)
	const isRoute = config.isRoute('src/routes/preprocess/query/layout/__layout.svelte')
	expect(isRoute).toBe(true)
})

test('relative filepath of lib should not be a route', async function () {
	const config = await getConfig(defaultConfig)
	const isRoute = config.isRoute('src/lib/component.svelte')
	expect(isRoute).toBe(false)
})

test('relative filepath should not be a route', async function () {
	const config = await getConfig(defaultConfig)
	const isRoute = config.isRoute('src/routes/_component.svelte')
	expect(isRoute).toBe(false)
})
