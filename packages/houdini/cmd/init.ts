import path from 'path'
import inquirer from 'inquirer'
import fs from 'fs/promises'
import { Config } from 'houdini-common'
import { writeSchema } from './utils/writeSchema'

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async (_path: string | undefined) => {
	// we need to collect some information from the user before we
	// can continue
	let answers = await inquirer.prompt([
		{
			name: 'url',
			type: 'input',
			message: 'Please enter the URL for your api, including its protocol.',
		},
		{
			name: 'framework',
			type: 'list',
			message: 'Are you using Sapper or SvelteKit?',
			choices: [
				{ value: 'svelte', name: 'No' },
				{ value: 'sapper', name: 'Sapper' },
				{ value: 'kit', name: 'SvelteKit' },
			],
		},
		{
			name: 'module',
			type: 'list',
			message: 'What kind of modules do you want to be generated?',
			when: ({ framework }) => framework === 'svelte',
			choices: [
				{ value: 'commonjs', name: 'CommonJS' },
				{ value: 'esm', name: 'ES Modules' },
			],
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
				'Where should the schema be written to? Valid file extensions are .json, .gql, or .graphql',
		},
	])

	// if the user didn't choose a module type, figure it out from the framework choice
	let module: Config['module'] = answers.module
	switch (answers.framework) {
		case 'kit':
			module = 'esm'
		case 'sapper':
			module = 'commonjs'
	}
	// dry up the framework choice
	const { framework } = answers

	// if no path was given, we'll use cwd
	const targetPath = _path ? path.resolve(_path) : process.cwd()

	// the source directory
	const sourceDir = path.join(targetPath, 'src')
	// the config file path
	const configPath = path.join(targetPath, 'houdini.config.js')
	// where we put the environment
	const environmentPath = path.join(sourceDir, 'environment.js')

	await Promise.all([
		// Get the schema from the url and write it to file
		writeSchema(answers.url, path.join(targetPath, answers.schemaPath)),

		// write the config file
		fs.writeFile(
			configPath,
			configFile({
				schemaPath: answers.schemaPath,
				framework,
				module,
				url: answers.url,
			})
		),

		// write the environment file
		fs.writeFile(environmentPath, networkFile(answers.url)),
	])

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

const configFile = ({
	schemaPath,
	framework,
	module,
	url,
}: {
	schemaPath: string
	framework: string
	module: string
	url: string
}) => {
	// the actual config contents
	const configObj = `{
		schemaPath: path.resolve('${schemaPath}'),
		sourceGlob: 'src/**/*.svelte',
		module: '${module}',
		framework: '${framework}',
		apiUrl: '${url}'
	}`

	return module === 'esm'
		? // SvelteKit default config
		  `import path from 'path'

export default ${configObj}
`
		: // sapper default config
		  `const path = require('path')

module.exports = ${configObj}
`
}
