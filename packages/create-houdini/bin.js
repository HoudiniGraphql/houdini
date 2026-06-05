#!/usr/bin/env node
import * as p from '@clack/prompts'
import { program, Option, InvalidArgumentError } from 'commander'
import * as graphql from 'graphql'
import { bold, cyan, gray, grey, italic, white } from 'kleur/colors'
import fs, { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { exit } from 'node:process'
import { fileURLToPath } from 'node:url'

// the first argument is the name of the project
let projectDir = process.argv[2]
let projectName = projectDir

// log the version of create-houdini that this was run with by looking at the packge's package.json
const { version } = JSON.parse(fs.readFileSync(new URL('package.json', import.meta.url), 'utf-8'))
console.log(`${grey(`create-houdini version ${version}`)}\n`)

// derive the dist-tag from our own version, then resolve it to a real version from the registry
const distTag = version.includes('-') ? version.split('-')[1].split('.')[0] : 'latest'
let houdiniVersion = version
try {
	const { execSync } = await import('node:child_process')
	const resolved = execSync(`npm view houdini@${distTag} version`, { encoding: 'utf-8' }).trim()
	if (resolved) houdiniVersion = resolved
} catch {
	// offline or registry unavailable — fall back to create-houdini's own version
}

// prepare options
const templatesDir = sourcePath(`./templates`)
const options = fs.readdirSync(templatesDir).map((templateDir) => {
	// in .meta.json you can find:
	/** @type {{label?: string, hint?: string, apiUrl?: string}} */
	let data = {}
	const metaPath = path.join(templatesDir, templateDir, '.meta.json')
	if (fs.existsSync(metaPath)) {
		data = JSON.parse(readFileSync(metaPath, 'utf-8'))
	}
	return { ...data, value: templateDir }
})

program.argument('[project_name]', 'optional project name')
program.addOption(
	new Option('-t, --template <template>', 'template you want to use').choices(
		options.map((c) => c.value)
	)
)
program.addOption(
	new Option('-s, --schema <schema>', '"local" or "http..."').argParser((value) => {
		if (value === 'local' || value.startsWith('http')) {
			return value
		}
		throw new InvalidArgumentError('Should be "local" or "http..." or do not set it!')
	})
)

program.parse(process.argv)
const options_cli = program.opts()

p.intro('🎩 Welcome to Houdini!')

// if we weren't given a directory, then we should ask
if (!projectDir) {
	const dir = await pathInput({
		message: `Where should we create your project?`,
	})

	if (dir === null) {
		process.exit(1)
	}

	if (dir) {
		projectDir = dir
		projectName = dir
	} else {
		projectDir = '.'
	}
}

// if we were told to use the current directory then we need
// a more appropriate name for the project
if (projectDir === '.') {
	projectName = 'hello-houdini'
}
let dirToCreate = true

// project location emtpy?
if (fs.existsSync(projectDir)) {
	if (fs.readdirSync(projectDir).length > 0) {
		const force = await p.confirm({
			message:
				'Target directory is not empty. Continue anyway? This might overwrite existing files.',
			initialValue: false,
		})
		dirToCreate = false

		// bail if `force` is `false` or the user cancelled with Ctrl-C
		if (force !== true) {
			process.exit(1)
		}
	}
}

// create the project directory if necessary
if (dirToCreate && !fs.existsSync(projectDir)) {
	fs.mkdirSync(projectDir)
}

const template = options_cli.template
	? options_cli.template
	: await p.select({
			message: 'Which template do you want to use?',
			initialValue: 'react-typescript',
			options,
	  })
if (p.isCancel(template)) {
	process.exit(1)
}
const templateDir = path.join(templatesDir, template)
const templateMeta = options.find((option) => option.value === template)
if (!templateMeta) {
	// this will never happen, but it helps to types later
	exit(1)
}

// ask if the schema is local or remote
const localSchema = templateMeta.apiUrl
	? false
	: options_cli.schema === 'local'
	? true
	: options_cli.schema?.startsWith('http')
	? false
	: await p.confirm({
			message: 'Is your api going to be defined in this project too?',
	  })

// if we have a remote schema then we need to introspect it and write the value
let apiUrl = options_cli.schema?.startsWith('http') ? options_cli.schema : templateMeta.apiUrl ?? ''
if (!localSchema) {
	let pullSchema_content = ''
	if (apiUrl === '') {
		const apiRunning = await p.confirm({
			message: 'Is your API currently running?',
			initialValue: true,
		})
		if (p.isCancel(apiRunning)) pCancel()

		if (apiRunning) {
			const { apiUrl: apiUrlCli, pullSchema_content: pullSchema_content_cli } =
				await pullSchemaCli()
			apiUrl = apiUrlCli
			if (pullSchema_content_cli === null) {
				pCancel('There was a problem pulling your shema. Please try again.')
			} else {
				pullSchema_content = pullSchema_content_cli
			}
		} else {
			const hasSchemaFile = await p.confirm({
				message: 'Do you have a schema file on disk we can use?',
				initialValue: false,
			})
			if (p.isCancel(hasSchemaFile)) pCancel()

			if (hasSchemaFile) {
				const schemaFilePath = await pathInput({
					message: 'Where is the schema file?',
					initialValue: './schema.graphql',
					validate: (value) => {
						if (!value) return 'Please enter a valid path'
						try {
							fs.statSync(path.resolve(value))
						} catch {
							return 'File not found'
						}
					},
				})
				if (schemaFilePath === null) pCancel()
				pullSchema_content = fs.readFileSync(path.resolve(schemaFilePath), 'utf-8')
			}

			apiUrl = 'API_URL'
		}
	} else {
		const pullSchema_content_local = await pullSchema(apiUrl, {})
		if (pullSchema_content_local === null) {
			pCancel('There was a problem pulling your shema. Please report this on Discord.')
		} else {
			pullSchema_content = pullSchema_content_local
		}
	}

	if (pullSchema_content) {
		writeFileSync(path.join(projectDir, 'schema.graphql'), pullSchema_content)
	}
}

// the final client config depends on whether we have a local schema or not
const clientConfig = localSchema
	? ``
	: `{
	url: '${apiUrl}',
}`

const configFile = localSchema
	? ''
	: `
	watchSchema: {
		url: '${apiUrl}',
	},
`

copy(
	sourcePath(path.join(templatesDir, template)),
	projectDir,
	{
		API_URL: apiUrl,
		PROJECT_NAME: projectName,
		HOUDINI_VERSION: houdiniVersion,
		["'CLIENT_CONFIG'"]: clientConfig,
		["'CONFIG_FILE'"]: configFile,
	},
	{ '.meta.gitignore': '.gitignore' },
	['.meta.json']
)

// if we have a local schema then we have more files to copy
if (localSchema) {
	copy(sourcePath('./fragments/localSchema/' + template))
}

p.outro(`🎉 Everything is ready!

👉 Next Steps
0️⃣  Go to your project     :  cd ${projectDir}
1️⃣  Install dependencies   :  npm i       | pnpm i   | yarn
2️⃣  Start your application :  npm run dev | pnpm dev | yarn dev`)

console.log(
	gray(
		italic(
			`${bold('❔ More help')} ` +
				`at ${cyan('https://houdinigraphql.com')} ` +
				`(📄 Docs, ⭐ Github, 📣 Discord, ...) `
		)
	)
)

// Function to copy files recursively
function copy(
	/** @type {string} */ sourceDir,
	/** @type {string} */ destDir = projectDir,
	/** @type {Record<string, string>} */ transformMap = {},
	/** @type {Record<string, string>} */ transformFileMap = {},
	/** @type {string[]} */ ignoreList = []
) {
	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir)
	}

	const files = fs.readdirSync(sourceDir)
	for (const fileSource of files) {
		const fileDest = Object.entries(transformFileMap).reduce((acc, [key, value]) => {
			return acc.replace(key, value)
		}, fileSource)
		// const file = fileSource.replace(".meta.gitignore", ".gitignore")
		const sourceFilePath = path.join(sourceDir, fileSource)
		const sourceRelative = path.relative(templateDir, sourceFilePath)
		// skip the ignore list
		if (!ignoreList.includes(sourceRelative)) {
			const destFilePath = path.join(destDir, fileDest)

			const stats = fs.statSync(sourceFilePath)

			// files need to be copied and potentially transformed
			if (stats.isFile()) {
				// read the source file
				const source = fs.readFileSync(sourceFilePath)

				// apply any transformations if necessary
				const transformed = Object.entries(transformMap).reduce(
					(prev, [pattern, value]) => {
						return prev.replaceAll(pattern, value)
					},
					source.toString()
				)

				// write the result
				fs.writeFileSync(destFilePath, transformed)
			}
			// if we run into a directory then we should keep going
			else if (stats.isDirectory()) {
				copy(sourceFilePath, destFilePath, transformMap, transformFileMap, ignoreList)
			}
		}
	}
}

function sourcePath(/** @type {string} */ path) {
	return fileURLToPath(new URL(path, import.meta.url).href)
}

async function pullSchemaCli() {
	let number_of_round = 0
	let url_and_headers = ''
	let apiUrl = ''
	let pullSchema_content = null
	while (pullSchema_content === null && number_of_round < 10) {
		number_of_round++
		const answer = await p.group(
			{
				url_and_headers: async () =>
					p.text({
						defaultValue: 'http://localhost:4000/graphql',
						message: `What's the URL for your api? ${
							number_of_round === 1 ? '' : `(attempt ${number_of_round}/10)`
						}`,
						placeholder: `http://localhost:4000/graphql ${
							number_of_round === 1 ? '' : 'Authorization=Bearer MyToken'
						}`,
						// initialValue: url_and_headers,
						validate: (value) => {
							// If empty, let's assume the placeholder value
							if (value === '') {
								value = 'http://localhost:4000/graphql'
							}

							if (!value.startsWith('http')) {
								return 'Please enter a valid URL'
							}
						},
					}),
			},
			{
				onCancel: () => pCancel(),
			}
		)

		url_and_headers = answer.url_and_headers
		const value_splited = url_and_headers.split(' ')

		apiUrl = value_splited[0]

		const local_headers =
			value_splited.length > 1
				? // remove the url and app all the headers
				  extractHeadersStr(value_splited.slice(1).join(' '))
				: {}

		pullSchema_content = await pullSchema(apiUrl, local_headers)

		if (pullSchema_content === null) {
			const msg = `If you need to pass headers, add them after the URL (eg: '${`${apiUrl} Authorization=Bearer MyToken`}')`
			p.log.error(msg)
		}
	}

	// if we are here... it means that we have tried x times to pull the schema and it failed
	if (pullSchema_content === null) {
		pCancel(
			'There was a problem pulling your schema. Please check your URL/headers and try again.'
		)
	}

	return { apiUrl, pullSchema_content }
}

async function pullSchema(
	/** @type {string} */ url,
	/** @type {Record<string, string>} */ headers
) {
	let content = ''
	const spinnerPullSchema = p.spinner()
	spinnerPullSchema.start('Pulling your schema...')
	let fileData = null
	try {
		// send the request
		const resp = await fetch(url, {
			method: 'POST',
			body: JSON.stringify({
				query: graphql.getIntrospectionQuery(),
			}),
			headers: { 'Content-Type': 'application/json', ...headers },
		})
		content = await resp.text()

		const jsonSchema = JSON.parse(content).data
		const schema = graphql.buildClientSchema(jsonSchema)
		fileData = graphql.printSchema(graphql.lexicographicSortSchema(schema))
	} catch (/** @type {any} */ e) {
		if (content) {
			console.warn(
				`⚠️  Couldn't pull your schema.
${'   Reponse:'} ${content}
${'   Error  :'} ${e.message}`
			)
		} else {
			console.warn(`⚠️  Couldn't pull your schema: ${e.message}`)
		}
	}
	spinnerPullSchema.stop(fileData ? 'Schema pulled 🪄' : 'Failed to pull schema!')
	return fileData
}

function extractHeadersStr(/** @type {string} */ str) {
	const regex = /(\w+)=("[^"]*"|[^ ]*)/g
	const /** @type {Record<string, string>} */ obj = {}

	let match
	while ((match = regex.exec(str ?? '')) !== null) {
		obj[match[1]] = match[2].replaceAll('"', '')
	}

	return obj
}

async function pathInput({ message, initialValue = '', validate }) {
	const { createInterface } = await import('node:readline')

	function completer(line) {
		const isTrailingSlash = line.endsWith('/')
		const dir = isTrailingSlash ? line || '.' : path.dirname(line) || '.'
		const base = isTrailingSlash ? '' : path.basename(line)
		let hits = []
		try {
			hits = fs
				.readdirSync(dir)
				.filter((e) => e.startsWith(base))
				.map((e) => {
					const full = path.join(dir, e)
					try {
						return fs.statSync(full).isDirectory() ? full + '/' : full
					} catch {
						return full
					}
				})
		} catch {}
		return [hits, line]
	}

	process.stdout.write(`\n${gray('◆')}  ${message}\n`)

	for (;;) {
		const answer = await new Promise((resolve) => {
			const rl = createInterface({ input: process.stdin, output: process.stdout, completer })
			rl.setPrompt(`${gray('│')}  `)
			rl.prompt()
			rl.once('line', (v) => {
				rl.close()
				resolve(v.trim() || initialValue)
			})
			rl.on('SIGINT', () => {
				rl.close()
				resolve(null)
			})
		})

		if (answer === null) return null
		if (validate) {
			const err = validate(answer)
			if (err) {
				process.stdout.write(`${gray('▲')}  ${err}\n`)
				continue
			}
		}
		return answer
	}
}

function pCancel(cancelText = 'Operation cancelled.') {
	p.cancel(cancelText)
	process.exit(1)
}
