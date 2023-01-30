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
		    "name": "CachedFriends",
		    "kind": "HoudiniQuery",
		    "hash": "38ee638bcf224e763a3275f84f3b006360fc5b52a7688478b486d30f3963cae1",

		    "raw": \`query CachedFriends {
		  user {
		    friends {
		      id
		    }
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "user": {
		                "type": "User",
		                "keyRaw": "user",

		                "selection": {
		                    "fields": {
		                        "friends": {
		                            "type": "User",
		                            "keyRaw": "friends",

		                            "selection": {
		                                "fields": {
		                                    "id": {
		                                        "type": "ID",
		                                        "keyRaw": "id"
		                                    }
		                                }
		                            }
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    "policy": "CacheAndNetwork",
		    "partial": false
		};

		"HoudiniHash=38ee638bcf224e763a3275f84f3b006360fc5b52a7688478b486d30f3963cae1";
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
		    "name": "CachedFriends",
		    "kind": "HoudiniQuery",
		    "hash": "ea9bab33b9e934c92f813b96c5a86f88fa81fbd06a27045efc95c4506b01ece4",

		    "raw": \`query CachedFriends {
		  user {
		    friends {
		      id
		    }
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "user": {
		                "type": "User",
		                "keyRaw": "user",

		                "selection": {
		                    "fields": {
		                        "friends": {
		                            "type": "User",
		                            "keyRaw": "friends",

		                            "selection": {
		                                "fields": {
		                                    "id": {
		                                        "type": "ID",
		                                        "keyRaw": "id"
		                                    }
		                                }
		                            }
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    "policy": "NetworkOnly",
		    "partial": false
		};

		"HoudiniHash=ea9bab33b9e934c92f813b96c5a86f88fa81fbd06a27045efc95c4506b01ece4";
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
		    "name": "CachedFriends",
		    "kind": "HoudiniQuery",
		    "hash": "9bf0627632b6c42837a39d3478fdb185d5bbd81bd6796a42c451d3769857dada",

		    "raw": \`query CachedFriends {
		  user {
		    friends {
		      id
		    }
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "user": {
		                "type": "User",
		                "keyRaw": "user",

		                "selection": {
		                    "fields": {
		                        "friends": {
		                            "type": "User",
		                            "keyRaw": "friends",

		                            "selection": {
		                                "fields": {
		                                    "id": {
		                                        "type": "ID",
		                                        "keyRaw": "id"
		                                    }
		                                }
		                            }
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    "policy": "CacheAndNetwork",
		    "partial": true
		};

		"HoudiniHash=9bf0627632b6c42837a39d3478fdb185d5bbd81bd6796a42c451d3769857dada";
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
		    "name": "CachedFriends",
		    "kind": "HoudiniQuery",
		    "hash": "38ee638bcf224e763a3275f84f3b006360fc5b52a7688478b486d30f3963cae1",

		    "raw": \`query CachedFriends {
		  user {
		    friends {
		      id
		    }
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "user": {
		                "type": "User",
		                "keyRaw": "user",

		                "selection": {
		                    "fields": {
		                        "friends": {
		                            "type": "User",
		                            "keyRaw": "friends",

		                            "selection": {
		                                "fields": {
		                                    "id": {
		                                        "type": "ID",
		                                        "keyRaw": "id"
		                                    }
		                                }
		                            }
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    "policy": "CacheAndNetwork",
		    "partial": true
		};

		"HoudiniHash=38ee638bcf224e763a3275f84f3b006360fc5b52a7688478b486d30f3963cae1";
	`)
})
