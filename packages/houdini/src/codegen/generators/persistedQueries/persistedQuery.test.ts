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
	console.log(`docs[0]`, docs[1])

	const computedHash1 = '49dc4c0692eced5aacee9f00666346a949191deb9d6efbaed8f073f1dc7e16fd'
	const computedHash2 = '0fed821a89624811bd47a7e95cbd1fd2a37f5b94613ae4968eecd7483aaaee56'
	const computedHash3 = '7af5be069af3b67c394042bdd7c12f46058ba9d372d38e67f5613fc3d0a2aaff'
	const computedHash4 = '85d8c7b6ad01e4a70c7d3f91f563b6bd33a135bd2f6698292c25a683445c2d16'

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
