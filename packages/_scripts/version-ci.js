import { execSync } from 'node:child_process'

const maxAttempts = 3
const baseDelayMs = 2000
const command = process.env.CHANGESET_VERSION_COMMAND || 'changeset version'
const retryableMessages = [
	'Failed to parse data from GitHub',
	'Premature close',
	'ECONNRESET',
	'ETIMEDOUT',
	'fetch failed',
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const runChangesetVersion = () => {
	execSync(command, { stdio: 'inherit', shell: true })
}

const isRetryable = (error) => {
	const output = [error?.message, error?.stdout?.toString(), error?.stderr?.toString()]
		.filter(Boolean)
		.join('\n')

	return retryableMessages.some((message) => output.includes(message))
}

let lastError = null
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
	try {
		runChangesetVersion()
		process.exit(0)
	} catch (error) {
		lastError = error
		if (!isRetryable(error) || attempt === maxAttempts) {
			break
		}

		const delayMs = baseDelayMs * attempt
		console.warn(
			`changeset version hit a transient GitHub API error. Retrying (${attempt + 1}/${maxAttempts}) in ${delayMs / 1000}s...`
		)
		await sleep(delayMs)
	}
}

process.exit(lastError?.status ?? 1)
