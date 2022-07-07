import fs from 'fs/promises'
import inquirer from 'inquirer'
import path from 'path'
import { Config, getConfig, LogLevel } from '../common'
import generate from './generate'
import { writeSchema } from './utils/writeSchema'

// the init command is responsible for scaffolding a few files
// as well as pulling down the initial schema representation
export default async (_path: string | undefined, args: { pullHeader?: string[] }) => {
	// we need to collect some information from the user before we
	// can continue
	let answers = (await inquirer.prompt([
		{
			message:
				'Did you git commit everything before running init? (so that you can see all changes easily)',
			name: 'isTypeScript',
			type: 'confirm',
		},
		{
			message: 'What framework are you using?',
			name: 'framework',
			type: 'list',
			choices: [
				{ value: 'kit', name: 'SvelteKit' },
				{ value: 'svelte', name: 'Svelte' },
				{ value: 'sapper', name: 'Sapper (deprecated)' },
			],
		},
		{
			message: 'Will SvelteKit be your GraphQL endpoint as well?',
			name: 'isGraphQLEndpoint',
			type: 'confirm',
			when: ({ framework }) => framework === 'kit',
		},
		{
			message: 'Please enter the GraphQL endpoint URL (including its protocol):',
			name: 'url',
			type: 'input',
			when: ({ framework }) => framework !== 'kit',
		},
		{
			message: 'Please enter the GraphQL endpoint URL (including its protocol):',
			name: 'urlKit',
			type: 'input',
			default: 'http://localhost/api/graphql',
			when: ({ framework, isGraphQLEndpoint }) => framework === 'kit' && isGraphQLEndpoint,
		},
		{
			message: 'What kind of modules do you want to be generated?',
			name: 'module',
			type: 'list',
			when: ({ framework }) => framework === 'svelte',
			choices: [
				{ value: 'commonjs', name: 'CommonJS' },
				{ value: 'esm', name: 'ES Modules' },
			],
		},
		{
			message: 'Just to be sure, you want the magic in TypeScript?',
			name: 'isTypeScript',
			type: 'confirm',
		},
		// {
		// 	message:
		// 		'Where should the schema be written to? Valid file extensions are .json, .gql, or .graphql',
		// 	name: 'schemaPath',
		// 	type: 'input',
		// 	default: './schema.graphql',
		// 	validate: (input: string) => {
		// 		const validExtensions = ['json', 'gql', 'graphql']

		// 		const extension = input.split('.').pop()
		// 		if (!extension) {
		// 			return 'Please provide a valid schema path.'
		// 		}
		// 		if (!validExtensions.includes(extension)) {
		// 			return 'The provided schema path should be of type ' + validExtensions.join('|')
		// 		}

		// 		return true
		// 	},
		// },
	])) as {
		framework: 'kit' | 'svelte' | 'sapper'
		isGraphQLEndpoint: boolean
		url: string
		module: 'commonjs' | 'esm'
		isTypeScript: boolean
		// schemaPath: string
	}

	// if the user didn't choose a module type, figure it out from the framework choice
	let module: Config['module'] = answers.module
	if (answers.framework === 'kit') {
		module = 'esm'
	} else if (answers.framework === 'sapper') {
		module = 'commonjs'
	}

	// if no path was given, we'll use cwd
	const targetPath = _path ? path.resolve(_path) : process.cwd()

	// the source directory
	const sourceDir = path.join(targetPath, 'src')
	// the config file path
	const configPath = path.join(targetPath, 'houdini.config.js')
	// where we put the houdiniClient
	const houdiniClientPath = path.join(
		sourceDir,
		answers.isTypeScript ? 'houdiniClient.ts' : 'houdiniClient.js'
	)

	const kitGraphQLEndpoint = answers.framework === 'kit' && answers.isGraphQLEndpoint
	const schemaPath = kitGraphQLEndpoint ? 'src/**/*.graphql' : './schema.graphql'

	await Promise.all([
		// Get the schema from the url and write it to file
		!kitGraphQLEndpoint &&
			writeSchema(answers.url, path.join(targetPath, schemaPath), args?.pullHeader),

		// write the config file
		fs.writeFile(
			configPath,
			configFile({
				schemaPath,
				framework: answers.framework,
				module,
				url: answers.url,
				kitGraphQLEndpoint,
			})
		),

		// write the houdiniClient file
		fs.writeFile(houdiniClientPath, houdiniClientFile(answers.url, answers.isTypeScript)),
	])

	// generate an empty runtime
	console.log('✨ Creating necessary files...')

	// make sure we don't log anything else
	const config = await getConfig({
		logLevel: LogLevel.Quiet,
	})
	await generate(config)

	// we're done!
	console.log('🎩 Welcome to Houdini!')
}

const houdiniClientFile = (url: string, isTypeScript: boolean) => {
	if (isTypeScript) {
		return `import type { RequestHandlerArgs } from '$houdini';
import { HoudiniClient } from '$houdini';

async function fetchQuery({
	fetch,
	text = '',
	variables = {},
	session,
	metadata
}: RequestHandlerArgs) {
	const url = import.meta.env.VITE_GRAPHQL_ENDPOINT || '${url}';

	const result = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			query: text,
			variables
		})
	});

	return await result.json();
}

export const houdiniClient = new HoudiniClient(fetchQuery);
`
	}
	return `import { HoudiniClient } from '$houdini'

async function fetchQuery({ fetch, session, text = '', variables = {}, session, metadata }) {
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

export default new HoudiniClient(fetchQuery)}
`
}

const configFile = ({
	schemaPath,
	framework,
	module,
	url,
	kitGraphQLEndpoint,
}: {
	schemaPath: string
	framework: string
	module: string
	url: string
	kitGraphQLEndpoint: boolean
}) => {
	// the actual config contents
	const configObj: string[] = []

	configObj.push(`/** @type {import('houdini').ConfigFile} */`)
	configObj.push(`const config = {`)
	configObj.push(`		schemaPath: '${schemaPath}',`)
	configObj.push(`		sourceGlob: 'src/**/*.{svelte,gql}',`)

	if (module !== 'esm') {
		configObj.push(`		module: '${module}',`)
	}
	if (framework !== 'kit') {
		configObj.push(`		framework: '${framework}',`)
	}
	if (!kitGraphQLEndpoint) {
		configObj.push(`		apiUrl: '${url}',`)
	}

	configObj.push(`}`)
	configObj.push(``)

	// SvelteKit default config
	if (module === 'esm') {
		configObj.push(`export default config`)
	} else {
		configObj.push(`module.exports = config`)
	}

	return configObj.join('\n')
}
