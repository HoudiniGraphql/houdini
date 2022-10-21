import { test, expect } from 'vitest'

import { runPipeline } from '../../../codegen'
import { CollectedGraphQLDocument, fs, path } from '../../../lib'
import { mockCollectedDoc, testConfig } from '../../../test'

test('generates an artifact for every document', async function () {
	const config = testConfig()
	config.persistedQueryPath = path.join(config.rootDir, 'hash.json')

	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		mockCollectedDoc(`query TestQuery1 { version }`),
		mockCollectedDoc(`query TestQuery2 { user { ...TestFragment } }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]
	// execute the generator
	await runPipeline(config, docs)

	expect(JSON.parse((await fs.readFile(config.persistedQueryPath))!)).toMatchInlineSnapshot(`
		{
		    "5ba2c5763a93559769c84d7dd536becf80b4c7be6db9f6af232a4309ebff665c": "query TestQuery1 {\\n  version\\n}",
		    "eb8e226b085997a05050d4407492d37aaf133c02186dfcdb75b8bebdb2d8d8fb": "query TestQuery2 {\\n  user {\\n    ...TestFragment\\n    id\\n  }\\n}\\n\\nfragment TestFragment on User {\\n  firstName\\n}"
		}
	`)
})
