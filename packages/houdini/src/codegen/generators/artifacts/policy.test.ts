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
		    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",

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

		"HoudiniHash=ea9bab33b9e934c92f813b96c5a86f88fa81fbd06a27045efc95c4506b01ece4";
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
		    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",

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
		    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",

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

		"HoudiniHash=ea9bab33b9e934c92f813b96c5a86f88fa81fbd06a27045efc95c4506b01ece4";
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
		    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",

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

		"HoudiniHash=ea9bab33b9e934c92f813b96c5a86f88fa81fbd06a27045efc95c4506b01ece4";
	`)
})
