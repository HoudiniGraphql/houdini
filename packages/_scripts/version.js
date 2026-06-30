#!/usr/bin/env node

// Runs `changeset version`, retrying when the only failure is a transient error
// talking to GitHub's GraphQL API. `@changesets/get-github-info` (used by the
// changelog-github generator) fetches PR/commit metadata over node-fetch, and on
// the CI runner that connection is sometimes dropped mid-response, surfacing as
// "Invalid response body ... Premature close" / "Failed to parse data from GitHub".
// changesets aborts before writing anything ("we have escaped applying the
// changesets, and no files should have been affected"), so re-running is safe.

import { spawn } from 'child_process'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

// Resolve the changeset CLI entry point directly so we don't depend on PATH or a shell.
const changesetBin = createRequire(import.meta.url).resolve('@changesets/cli/bin.js')

// When HOUDINI_CHANGESET_DIAGNOSTICS is set (the release workflow does), preload a
// hook that logs the HTTP status + headers GitHub returns for each node-fetch call,
// so a "Premature close" failure tells us whether GitHub errored or dropped a 200.
const childArgs = []
if (process.env.HOUDINI_CHANGESET_DIAGNOSTICS) {
	const diagnostics = fileURLToPath(new URL('./changeset-fetch-diagnostics.cjs', import.meta.url))
	childArgs.push('--require', diagnostics)
}
childArgs.push(changesetBin, 'version')

const MAX_ATTEMPTS = 5
const BASE_DELAY_MS = 3000

// Markers that identify a transient GitHub-fetch failure (vs. a real changeset error).
const TRANSIENT_PATTERNS = [
	'Premature close',
	'fetching data from GitHub',
	'parse data from GitHub',
	'fetch https://api.github.com/graphql',
	'ECONNRESET',
	'ETIMEDOUT',
	'socket hang up',
]

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function runChangesetVersion() {
	return new Promise(resolve => {
		const child = spawn(process.execPath, childArgs)

		// Stream output through while capturing it so we can classify failures
		// (changesets logs the GitHub error to either stream depending on version).
		let output = ''
		child.stdout.on('data', chunk => {
			output += chunk.toString()
			process.stdout.write(chunk)
		})
		child.stderr.on('data', chunk => {
			output += chunk.toString()
			process.stderr.write(chunk)
		})

		child.on('close', code => resolve({ code, output }))
	})
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
	const { code, output } = await runChangesetVersion()

	if (code === 0) {
		process.exit(0)
	}

	const isTransient = TRANSIENT_PATTERNS.some(pattern => output.includes(pattern))
	if (!isTransient || attempt === MAX_ATTEMPTS) {
		process.exit(code ?? 1)
	}

	const delay = BASE_DELAY_MS * attempt
	console.error(
		`\n⚠️  changeset version failed talking to GitHub (attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${delay / 1000}s…\n`
	)
	await sleep(delay)
}
