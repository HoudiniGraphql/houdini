import { test, expect } from 'vitest'

import { runPipeline } from '../../../codegen'
import type { Document } from '../../../lib'
import { fs, path } from '../../../lib'
import { mockCollectedDoc, testConfig } from '../../../test'

test('generates an artifact for every document', async function () {
	const config = testConfig()
	config.persistedQueryPath = path.join(config.rootDir, 'hash.json')

	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`query TestQuery1 { version }`),
		mockCollectedDoc(`query TestQuery2 { user { ...TestFragment } }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]
	// execute the generator
	await runPipeline(config, docs)

	expect(JSON.parse((await fs.readFile(config.persistedQueryPath))!)).toMatchInlineSnapshot(`
		{
		    "361432f464ed44eed788f3ea66c4dabc46437b88edbe7daccca87045fd31447f": "query TestQuery1 {\\n  version\\n}\\n",
		    "7b6df0b58f32c599a8b07d36cdbdc21570f07b4b8a6819ebf457888be98798ad": "query TestQuery2 {\\n  user {\\n    ...TestFragment\\n    id\\n  }\\n}\\n\\nfragment TestFragment on User {\\n  firstName\\n  id\\n  __typename\\n}\\n"
		}
	`)
})
