import path from 'path'
import inquirer from 'inquirer'
import fs from 'fs/promises'
import { Config, getConfig, LogLevel } from '../common'
import { writeSchema } from './utils/writeSchema'
import generate from './generate'

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async (_path: string | undefined, args: { pullHeader?: string[] }) => {
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
	if (answers.framework === 'kit') {
		module = 'esm'
	} else if (answers.framework === 'sapper') {
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
	// where we put the houdiniClient
	const houdiniClientPath = path.join(sourceDir, 'houdiniClient.js')

	await Promise.all([
		// Get the schema from the url and write it to file
		writeSchema(answers.url, path.join(targetPath, answers.schemaPath), args?.pullHeader),

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

		// write the houdiniClient file
		fs.writeFile(houdiniClientPath, networkFile(answers.url)),
	])

	// generate an empty runtime
	console.log('Creating necessary files...')

	// make sure we don't log anything else
	const config = await getConfig({
		logLevel: LogLevel.Quiet,
	})
	await generate(config)

	// we're done!
	console.log('Welcome to Houdini!')
}

const networkFile = (url: string) => `import { HoudiniClient } from '$houdini/runtime'

async function fetchQuery({ fetch, session, text = '', variables = {} }) {
	const result = await fetch('${url}', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query: text,
			variables,
		}),
	})
	return await result.json()
}

export default new HoudiniClient(fetchQuery)
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
	schemaPath: '${schemaPath}',
	sourceGlob: 'src/**/*.{svelte,gql,graphql}',
	module: '${module}',
	framework: '${framework}',
	apiUrl: '${url}'
}`

	return module === 'esm'
		? // SvelteKit default config
		  `/** @type {import('houdini').ConfigFile} */
const config = ${configObj}

export default config
`
		: // sapper default config
		  `/** @type {import('houdini').ConfigFile} */
const config = ${configObj}

module.exports = config
`
}
