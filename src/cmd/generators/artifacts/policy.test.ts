// local imports
import { CachePolicy, testConfig } from '../../../common'
import '../../../../jest.setup'
import { runPipeline } from '../../generate'
import { mockCollectedDoc } from '../../testUtils'

// the config to use in tests
const config = testConfig()

test('cache policy is persisted in artifact', async function () {
	const docs = [
		mockCollectedDoc(
			`
            query CachedFriends @cache(policy: CacheAndNetwork) {
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

					    policy: "CacheAndNetwork",
					    partial: false
					};
				`)
})

test('can change default cache policy', async function () {
	// the config to use in tests
	const cfg = testConfig({
		defaultCachePolicy: CachePolicy.NetworkOnly,
	})

	const docs = [
		mockCollectedDoc(
			`
            query CachedFriends {
                user {
                    friends {
                        id
                    }
                }
            }
        `
		),
	]

	await runPipeline(cfg, docs)

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

					    policy: "NetworkOnly",
					    partial: false
					};
				`)
})

test('partial opt-in is persisted', async function () {
	const docs = [
		mockCollectedDoc(
			`
            query CachedFriends @cache(policy: CacheAndNetwork, partial: true) {
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

					    policy: "CacheAndNetwork",
					    partial: true
					};
				`)
})

test('can set default partial opt-in', async function () {
	// the config to use in tests
	const cfg = testConfig({
		defaultPartial: true,
	})

	const docs = [
		mockCollectedDoc(
			`
            query CachedFriends @cache(policy: CacheAndNetwork) {
                user {
                    friends {
                        id
                    }
                }
            }
        `
		),
	]

	await runPipeline(cfg, docs)

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

					    policy: "CacheAndNetwork",
					    partial: true
					};
				`)
})
