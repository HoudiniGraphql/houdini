#!/usr/bin/env node
import * as p from '@clack/prompts'
import * as graphql from 'graphql'
import { green, grey } from 'kleur/colors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// the first argument is the name of the project
let projectDir = process.argv[2]
let projectName = projectDir
let apiUrl = ''

const schemaPath = './schema.graphql'

// log the version of create-houdini that this was run with by looking at the packge's package.json
const { version } = JSON.parse(fs.readFileSync(new URL('package.json', import.meta.url), 'utf-8'))
console.log(`${grey(`create-houdini version ${version}`)}\n`)

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

// project location emtpy?
if (fs.existsSync(projectDir)) {
	if (fs.readdirSync(projectDir).length > 0) {
		const force = await p.confirm({
			message:
				'Target directory is not empty. Continue anyway? This might overwrite existing files.',
			initialValue: false,
		})

		// bail if `force` is `false` or the user cancelled with Ctrl-C
		if (force !== true) {
			process.exit(1)
		}
	}
} else {
	// create the directory
	fs.mkdirSync(projectDir)
}

const template = await p.select({
	message: 'Which template do you want to use?',
	initialValue: 'react-typescript',
	options: [
		{
			label: 'React',
			value: 'react',
		},
		{
			label: 'React w/ TypeScript',
			value: 'react-typescript',
		},
	],
})
if (p.isCancel(template)) {
	process.exit(1)
}

const templateDir = sourcePath(`./templates/${template}`)

await pullSchema()

copy(templateDir, projectDir, {
	API_URL: apiUrl,
	PROJECT_NAME: projectName,
	HOUDINI_VERSION: version,
})

p.outro(`🎉 Everything is ready!

👉 Next Steps
1️⃣  Install dependencies:       npm i | pnpm i | yarn
2️⃣  Start your application:     npm run dev | pnpm run dev | yarn dev
`)

// Function to copy files recursively
function copy(
	/** @type {string} */ sourceDir,
	/** @type {string} */ destDir,
	/** @type {Record<string, string>} */ transformMap
) {
	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir)
	}

	const files = fs.readdirSync(sourceDir)
	for (const file of files) {
		const sourceFilePath = path.join(sourceDir, file)
		const destFilePath = path.join(destDir, file)
		const sourceRelative = path.relative(templateDir, sourceFilePath)

		const stats = fs.statSync(sourceFilePath)

		// files need to be copied and potentially transformed
		if (stats.isFile()) {
			// read the source file
			const source = fs.readFileSync(sourceFilePath)

			// apply any transformations if necessary
			const transformed = Object.entries(transformMap).reduce((prev, [pattern, value]) => {
				return prev.replaceAll(pattern, value)
			}, source.toString())

			// write the result
			fs.writeFileSync(destFilePath, transformed)
		}
		// if we run into a directory then we should keep going
		else if (stats.isDirectory()) {
			copy(sourceFilePath, destFilePath, transformMap)
		}
	}
}

function sourcePath(/** @type {string} */ path) {
	return fileURLToPath(new URL(path, import.meta.url).href)
}

async function pullSchema() {
	try {
		apiUrl = await p.text({
			message: "What's the URL for your api?",
			placeholder: 'http://localhost:4000/graphql',
			defaultValue: 'http://localhost:4000/graphql',
		})

		if (p.isCancel(apiUrl)) {
			process.exit(1)
		}

		// verify we can send graphql queries to the server
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: graphql.getIntrospectionQuery(),
			}),
		})

		// if the response was not a 200, we have a problem
		if (response.status !== 200) {
			console.log('❌ That URL is not accepting GraphQL queries. Please try again.')
			return await pullSchema()
		}

		// make sure we can parse the response as json
		const content = await response.text()
		const jsonSchema = JSON.parse(content).data
		const schema = graphql.buildClientSchema(jsonSchema)

		// write the schema to disk
		await fs.writeFileSync(path.join(projectDir, schemaPath), JSON.stringify(jsonSchema))
	} catch (e) {
		console.log('❌ Something went wrong: ' + e.message)
		console.log(e)
		return await pullSchema()
	}
}
