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
		mockCollectedDoc(`query TestQuery2 { user { ...TestFragment @mask_disable } }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
		mockCollectedDoc(`mutation Add { addFriend { friend { firstName id } } }`),
	]
	// execute the generator
	await runPipeline(config, docs)

	const computedHash1 = '361432f464ed44eed788f3ea66c4dabc46437b88edbe7daccca87045fd31447f'
	const computedHash2 = '7b6df0b58f32c599a8b07d36cdbdc21570f07b4b8a6819ebf457888be98798ad'
	const computedHash3 = 'ff694171ced9bd7edc84a4a4a4201dadea30c0cdb8a8734c940872a673111bc1'
	const computedHash4 = 'fe1a99181d15832006212f1d94483733e06a2a73b12ef7a167c980f7f484c2ee'

	expect(docs[0].artifact?.hash).toBe(computedHash1)
	expect(docs[1].artifact?.hash).toBe(computedHash2)
	// we don't really care about fragment hashes (but let's keep this)
	expect(docs[2].artifact?.hash).toBe(computedHash3)
	expect(docs[3].artifact?.hash).toBe(computedHash4)

	const operations: Record<string, string> = JSON.parse(
		(await fs.readFile(config.persistedQueryPath))!
	)

	// we should have only 3 operations (2 queries and 1 mutation)
	expect(Object.keys(operations).length).toBe(3)

	// Let's look add the hashes and make sure they match the expected values
	expect(operations[computedHash1]).toMatchInlineSnapshot(`
		"query TestQuery1 {
		  version
		}
		"
	`)

	expect(operations[computedHash2]).toMatchInlineSnapshot(`
			"query TestQuery2 {
			  user {
			    ...TestFragment
			    id
			  }
			}

			fragment TestFragment on User {
			  firstName
			  id
			  __typename
			}
			"
		`)

	expect(operations[computedHash4]).toMatchInlineSnapshot(`
		"mutation Add {
		  addFriend {
		    friend {
		      firstName
		      id
		    }
		  }
		}
		"
	`)
})
