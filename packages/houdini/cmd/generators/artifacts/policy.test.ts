// external imports
import { testConfig } from 'houdini-common'
// local imports
import '../../../../../jest.setup'
import { runPipeline } from '../../generate'
import { mockCollectedDoc } from '../../testUtils'

// the config to use in tests
const config = testConfig()

test('cache policy is persisted in artifact', async function () {
	const docs = [
		mockCollectedDoc(
			`
            query CachedFriends @cache(policy: CacheOrNetwork) {
                user {
                    friends {
                        id
                    }
                }
            }
        `
		),
	]

	await runPipeline(config, docs)

	// look at the artifact for the generated pagination query
	await expect(docs[0]).toMatchArtifactSnapshot(`
					module.exports = {
					    name: "CachedFriends",
					    kind: "HoudiniQuery",
					    hash: "ea9bab33b9e934c92f813b96c5a86f88fa81fbd06a27045efc95c4506b01ece4",

					    raw: \`query CachedFriends {
					  user {
					    friends {
					      id
					    }
					    id
					  }
					}
					\`,

					    rootType: "Query",

					    selection: {
					        user: {
					            type: "User",
					            keyRaw: "user",

					            fields: {
					                friends: {
					                    type: "User",
					                    keyRaw: "friends",

					                    fields: {
					                        id: {
					                            type: "ID",
					                            keyRaw: "id"
					                        }
					                    }
					                },

					                id: {
					                    type: "ID",
					                    keyRaw: "id"
					                }
					            }
					        }
					    },

					    policy: "CacheOrNetwork"
					};
				`)
})
