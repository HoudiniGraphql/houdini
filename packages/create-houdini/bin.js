#!/usr/bin/env node
import * as p from '@clack/prompts'
import * as graphql from 'graphql'
import { grey } from 'kleur/colors'
import fs, { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// the first argument is the name of the project
let projectDir = process.argv[2]
let projectName = projectDir

// log the version of create-houdini that this was run with by looking at the packge's package.json
const { version } = JSON.parse(fs.readFileSync(new URL('package.json', import.meta.url), 'utf-8'))
console.log(`${grey(`create-houdini version ${version}`)}\n`)

// prepare options
const templatesDir = sourcePath(`./templates`)
const options = fs.readdirSync(templatesDir).map((template) => {
	const metaPath = path.join(templatesDir, template, '.meta.json')
	if (!fs.existsSync(metaPath)) {
		// this message will be for developers only when we add a template and forget to add the .meta.json
		p.cancel(
			`❌ Template "${template}" is missing a ".meta.json" file to describe options (value!, label, hint, apiUrl)`
		)
		process.exit(1)
	}
	return JSON.parse(readFileSync(metaPath, 'utf-8'))
})

p.intro('🎩 Welcome to Houdini!')

// if we weren't given a directory, then we should ask
if (!projectDir) {
	const dir = await p.text({
		message: `Where should we create your project?`,
		placeholder: '  (press Enter to use the current directory)',
	})

	if (p.isCancel(dir)) {
		process.exit(1)
	}

	if (dir) {
		projectDir = dir
		projectName = 'hello-houdini'
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

const template = await p.select({
	message: 'Which template do you want to use?',
	initialValue: 'react-typescript',
	options,
})
if (p.isCancel(template)) {
	process.exit(1)
}
const templateMeta = options.find((option) => option.value === template)
const templateDir = sourcePath(path.join(templatesDir, template))

let apiUrl = templateMeta.apiUrl ?? ''
let pullSchema_content = ''
if (apiUrl === '') {
	const { apiUrl: apiUrlCli, pullSchema_content: pullSchema_content_cli } = await pullSchemaCli()
	apiUrl = apiUrlCli
	if (pullSchema_content_cli === null) {
		pCancel('We could not pull the schema. Please try again.')
	} else {
		pullSchema_content = pullSchema_content_cli
	}
} else {
	const pullSchema_content_local = await pullSchema(apiUrl, {})
	if (pullSchema_content_local === null) {
		pCancel('We could not pull the schema. Please report this on Discord.')
	} else {
		pullSchema_content = pullSchema_content_local
	}
}

// create the project directory if necessary
if (dirToCreate) {
	fs.mkdirSync(projectDir)
}
writeFileSync(path.join(projectDir, 'schema.graphql'), pullSchema_content)

copy(
	templateDir,
	projectDir,
	{
		API_URL: apiUrl,
		PROJECT_NAME: projectName,
		HOUDINI_VERSION: version,
	},
	['.meta.json']
)

p.outro(`🎉 Everything is ready!

👉 Next Steps
1️⃣  Install dependencies   :  npm i       | pnpm i   | yarn
2️⃣  Start your application :  npm run dev | pnpm dev | yarn dev
`)

// Function to copy files recursively
function copy(
	/** @type {string} */ sourceDir,
	/** @type {string} */ destDir,
	/** @type {Record<string, string>} */ transformMap,
	/** @type {string[]} */ ignoreList
) {
	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir)
	}

	const files = fs.readdirSync(sourceDir)
	for (const file of files) {
		const sourceFilePath = path.join(sourceDir, file)
		const sourceRelative = path.relative(templateDir, sourceFilePath)
		// skip the ignore list
		if (!ignoreList.includes(sourceRelative)) {
			const destFilePath = path.join(destDir, file)

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
				copy(sourceFilePath, destFilePath, transformMap, ignoreList)
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
								return 'Please enter something'
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
		const apiUrl = value_splited[0]

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
		pCancel("We couldn't pull the schema. Please check your URL/headers and try again.")
	}

	return { apiUrl, pullSchema_content }
}

async function pullSchema(
	/** @type {string} */ url,
	/** @type {Record<string, string>} */ headers
) {
	let content = ''
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
		let fileData = ''

		const schema = graphql.buildClientSchema(jsonSchema)
		fileData = graphql.printSchema(graphql.lexicographicSortSchema(schema))

		return fileData
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
	return null
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

function pCancel(cancelText = 'Operation cancelled.') {
	p.cancel(cancelText)
	process.exit(1)
}
