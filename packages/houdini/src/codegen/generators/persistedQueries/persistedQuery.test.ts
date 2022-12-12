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
		    "361432f464ed44eed788f3ea66c4dabc46437b88edbe7daccca87045fd31447f": "query TestQuery1 {\\n  version\\n}\\n",
		    "b1aea7d645764d0f015d97146f7fb7dd32f1156841b1ece9f553efc7ebb216b6": "query TestQuery2 {\\n  user {\\n    ... on User {\\n      firstName\\n    }\\n    id\\n    ...TestFragment\\n  }\\n}\\n\\nfragment TestFragment on User {\\n  firstName\\n}\\n"
		}
	`)
})
