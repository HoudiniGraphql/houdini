import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { CachePolicy } from '../../../runtime/lib'
import { testConfig, mockCollectedDoc } from '../../../test'

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
	await expect(docs[0]).toMatchInlineSnapshot(`
		export default {
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
		        fields: {
		            user: {
		                type: "User",
		                keyRaw: "user",

		                selection: {
		                    fields: {
		                        friends: {
		                            type: "User",
		                            keyRaw: "friends",

		                            selection: {
		                                fields: {
		                                    id: {
		                                        type: "ID",
		                                        keyRaw: "id"
		                                    }
		                                }
		                            }
		                        },

		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    policy: "CacheAndNetwork",
		    partial: false
		};

		"HoudiniHash=08a3bafdc782d255deb9894e8bb198e5a47681e8fc4d1d1bff0c075d93c2362d";
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
	await expect(docs[0]).toMatchInlineSnapshot(`
		export default {
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
		        fields: {
		            user: {
		                type: "User",
		                keyRaw: "user",

		                selection: {
		                    fields: {
		                        friends: {
		                            type: "User",
		                            keyRaw: "friends",

		                            selection: {
		                                fields: {
		                                    id: {
		                                        type: "ID",
		                                        keyRaw: "id"
		                                    }
		                                }
		                            }
		                        },

		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    policy: "NetworkOnly",
		    partial: false
		};

		"HoudiniHash=07860fa33d7e0f709a61716b22c5fada0f5074d95da404e8cac9d3b245843773";
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
	await expect(docs[0]).toMatchInlineSnapshot(`
		export default {
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
		        fields: {
		            user: {
		                type: "User",
		                keyRaw: "user",

		                selection: {
		                    fields: {
		                        friends: {
		                            type: "User",
		                            keyRaw: "friends",

		                            selection: {
		                                fields: {
		                                    id: {
		                                        type: "ID",
		                                        keyRaw: "id"
		                                    }
		                                }
		                            }
		                        },

		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    policy: "CacheAndNetwork",
		    partial: true
		};

		"HoudiniHash=4fb7cd5b288356c5bd7b09bd128cab1d399cb2aab2fe8c57bce318d423282a2f";
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
	await expect(docs[0]).toMatchInlineSnapshot(`
		export default {
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
		        fields: {
		            user: {
		                type: "User",
		                keyRaw: "user",

		                selection: {
		                    fields: {
		                        friends: {
		                            type: "User",
		                            keyRaw: "friends",

		                            selection: {
		                                fields: {
		                                    id: {
		                                        type: "ID",
		                                        keyRaw: "id"
		                                    }
		                                }
		                            }
		                        },

		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    policy: "CacheAndNetwork",
		    partial: true
		};

		"HoudiniHash=08a3bafdc782d255deb9894e8bb198e5a47681e8fc4d1d1bff0c075d93c2362d";
	`)
})
