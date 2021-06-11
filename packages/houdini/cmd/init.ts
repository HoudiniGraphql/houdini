import path from 'path'
import inquirer from 'inquirer'
import fs from 'fs/promises'
import { writeSchema } from './utils/writeSchema'

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async (_path: string | undefined) => {
	// we need to collect some information from the user before we
	// can continue
	let { url, framework, schemaPath } = await inquirer.prompt([
		{
			name: 'url',
			type: 'input',
			message: 'Please enter the URL for your api, including its protocol.',
		},
		{
			name: 'framework',
			type: 'list',
			message: 'Are you using Sapper or SvelteKit?',
			choices: ['Sapper', 'SvelteKit'],
		},
		{
			name: 'schemaPath',
			type: 'input',
			default: './schema.graphql',
			validate: (input: string) => {
				const validExtensions = ['json', 'gql', 'graphql']

				const extension = input.split('.').pop()
				if (!extension) {
					return 'Please provide a valid schema path.'
				}
				if (!validExtensions.includes(extension)) {
					return 'The provided schema path should be of type ' + validExtensions.join('|')
				}

				return true
			},
			message:
				'Enter the path where the schema should be written to. Valid file extensions are (.json/.gql/.graphql)',
		},
	])

	// convert the selected framework the mode
	const mode = framework === 'Sapper' ? 'sapper' : 'kit'

	// if no path was given, we'll use cwd
	const targetPath = _path ? path.resolve(_path) : process.cwd()

	// the source directory
	const sourceDir = path.join(targetPath, 'src')
	// the config file path
	const configPath = path.join(targetPath, 'houdini.config.js')
	// where we put the environment
	const environmentPath = path.join(sourceDir, 'environment.js')

	// Get the schema from the url and write it to file
	await writeSchema(url, path.join(targetPath, schemaPath))
	// write the config file
	await fs.writeFile(configPath, configFile(schemaPath, mode, url))
	// write the environment file
	await fs.writeFile(environmentPath, networkFile(url))

	console.log('Welcome to houdini!')
}

const networkFile = (url: string) => `import { Environment } from '$houdini'

export default new Environment(async function ({ text, variables = {} }) {
	// send the request to the api
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

const configFile = (schemaPath: string, mode: string, url: string) =>
	mode === 'kit'
		? // SvelteKit default config
		  `import path from 'path'

export default {
	schemaPath: path.resolve('${schemaPath}'),
	sourceGlob: 'src/**/*.svelte',
	mode: 'kit',
	apiUrl: '${url}',
}
`
		: // sapper default config
		  `const path = require('path')

module.exports = {
	schemaPath: path.resolve('${schemaPath}'),
	sourceGlob: 'src/{routes,components}/*.svelte',
	mode: 'sapper',
	apiUrl: '${url}',
}
`
