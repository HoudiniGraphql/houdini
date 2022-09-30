import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { readFile, testConfig } from '../../../common'

test('generates runtime meta data file', async function () {
	const config = testConfig()
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await readFile(config.metaFilePath)

	expect(fileContents).toBeTruthy()
	// verify contents
	expect(fileContents).toContain(`"client":"./my/client/path"`)
})
