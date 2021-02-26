import path from 'path'
import inquirer from 'inquirer'
import fetch from 'node-fetch'
import { getIntrospectionQuery } from 'graphql'
import fs from 'fs/promises'

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async (_path: string | undefined) => {
	// we need to collect some information from the user before we
	// can continue
	let { url } = await inquirer.prompt([
		{
			name: 'url',
			type: 'input',
			message: 'Please enter the URL for your api with its protocol.',
		},
	])

	// if no path was given, we'll use cwd
	const targetPath = _path ? path.resolve(_path) : process.cwd()

	// the source directory
	const sourceDir = path.join(targetPath, 'src')
	// the config file path
	const configPath = path.join(targetPath, 'houdini.config.cjs')
	// where we put the environment
	const environmentPath = path.join(sourceDir, 'environment.js')

	// where we'll put it
	const schemaPath = './schema.json'

	// send the request
	const resp = await fetch(url, {
		method: 'POST',
		body: JSON.stringify({
			query: getIntrospectionQuery(),
		}),
		headers: { 'Content-Type': 'application/json' },
	})
	const content = await resp.text()

	try {
		// write the schema file
		await fs.writeFile(
			path.resolve(path.join(targetPath, schemaPath)),
			JSON.stringify(JSON.parse(content).data),
			'utf-8'
		)
	} catch (e) {
		console.log('encountered error parsing response as json: ' + e.message)
		console.log('full body: ' + content)
		return
	}

	// write the config file
	await fs.writeFile(configPath, configFile(schemaPath))
	// write the environment file
	await fs.writeFile(environmentPath, networkFile(url))

	console.log('Welcome to houdini!')
}

const networkFile = (url: string) => `import { Environment } from '$houdini'

export default new Environment(async function ({ text, variables = {} }) {
	// send the request to the ricky and morty api
	const result = await this.fetch('${url}', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query: text,
			variables,
		}),
	})

	// parse the result as json
	return await result.json()
})
`

const configFile = (schemaPath: string) => `const path = require('path')

module.exports = {
	schemaPath: path.resolve('${schemaPath}'),
	sourceGlob: 'src/{routes,components}/*.svelte',
}
`
