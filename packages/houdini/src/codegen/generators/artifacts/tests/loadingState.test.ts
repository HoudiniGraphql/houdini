import { test, expect } from 'vitest'

import { runPipeline } from '../../..'
import { mockCollectedDoc, testConfig } from '../../../../test'

test('persists loading behavior in selection', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query MonkeyListQuery {
				monkeys @loading {
					pageInfo @loading {
						hasPreviousPage
						hasNextPage
						startCursor
						endCursor
					}
					...AnimalsList @loading
				}
			}`
		),
		mockCollectedDoc(
			`fragment AnimalsList on AnimalConnection {
				edges {
					node {
						id
						name
					}
				}
			}`
		),
	]

	// execute the generator
	await runPipeline(config, docs)

	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "MonkeyListQuery",
		    "kind": "HoudiniQuery",
		    "hash": "5e86edd84280f328c6e368f75bb1f19cfd2eff5876bc240cf98cca13daae05ad",

		    "raw": \`query MonkeyListQuery {
		  monkeys {
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		    ...AnimalsList
		  }
		}

		fragment AnimalsList on AnimalConnection {
		  edges {
		    node {
		      id
		      name
		      __typename
		    }
		    __typename
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "monkeys": {
		                "type": "MonkeyConnection",
		                "keyRaw": "monkeys",

		                "directives": [{
		                    "name": "loading",
		                    "arguments": {}
		                }],

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "AnimalConnection": {
		                                "edges": {
		                                    "type": "AnimalEdge",
		                                    "keyRaw": "edges",

		                                    "selection": {
		                                        "fields": {
		                                            "node": {
		                                                "type": "Animal",
		                                                "keyRaw": "node",
		                                                "nullable": true,

		                                                "selection": {
		                                                    "fields": {
		                                                        "id": {
		                                                            "type": "ID",
		                                                            "keyRaw": "id",
		                                                            "visible": true
		                                                        },

		                                                        "name": {
		                                                            "type": "String",
		                                                            "keyRaw": "name"
		                                                        },

		                                                        "__typename": {
		                                                            "type": "String",
		                                                            "keyRaw": "__typename"
		                                                        }
		                                                    }
		                                                },

		                                                "abstract": true
		                                            },

		                                            "__typename": {
		                                                "type": "String",
		                                                "keyRaw": "__typename"
		                                            }
		                                        }
		                                    },

		                                    "abstract": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename"
		                                },

		                                "pageInfo": {
		                                    "type": "PageInfo",
		                                    "keyRaw": "pageInfo",

		                                    "directives": [{
		                                        "name": "loading",
		                                        "arguments": {}
		                                    }],

		                                    "selection": {
		                                        "fields": {
		                                            "hasPreviousPage": {
		                                                "type": "Boolean",
		                                                "keyRaw": "hasPreviousPage",
		                                                "visible": true
		                                            },

		                                            "hasNextPage": {
		                                                "type": "Boolean",
		                                                "keyRaw": "hasNextPage",
		                                                "visible": true
		                                            },

		                                            "startCursor": {
		                                                "type": "String",
		                                                "keyRaw": "startCursor",
		                                                "visible": true
		                                            },

		                                            "endCursor": {
		                                                "type": "String",
		                                                "keyRaw": "endCursor",
		                                                "visible": true
		                                            }
		                                        }
		                                    },

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {
		                            "MonkeyConnection": "AnimalConnection"
		                        }
		                    },

		                    "fields": {
		                        "pageInfo": {
		                            "type": "PageInfo",
		                            "keyRaw": "pageInfo",

		                            "directives": [{
		                                "name": "loading",
		                                "arguments": {}
		                            }],

		                            "selection": {
		                                "fields": {
		                                    "hasPreviousPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasPreviousPage",
		                                        "visible": true
		                                    },

		                                    "hasNextPage": {
		                                        "type": "Boolean",
		                                        "keyRaw": "hasNextPage",
		                                        "visible": true
		                                    },

		                                    "startCursor": {
		                                        "type": "String",
		                                        "keyRaw": "startCursor",
		                                        "visible": true
		                                    },

		                                    "endCursor": {
		                                        "type": "String",
		                                        "keyRaw": "endCursor",
		                                        "visible": true
		                                    }
		                                }
		                            },

		                            "loading": {
		                                "kind": "value"
		                            },

		                            "visible": true
		                        }
		                    },

		                    "fragments": {
		                        "AnimalsList": {
		                            "arguments": {},
		                            "loading": true
		                        }
		                    }
		                },

		                "loading": {
		                    "kind": "continue"
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "enableLoadingState": "local",
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=9283d1c1a5755e8562f4e365f05f30cc1a37223fd93ba276eabf77971a15b387";
	`)
})
test('loading state on mixed abstract type', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query Query {
				catOwners @loading {
					cats @loading{
						id @loading
					}
					... on User @loading {
						firstName @loading
					}
				}
			}`
		),
	]

	// execute the generator
	await runPipeline(config, docs)

	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Query",
		    "kind": "HoudiniQuery",
		    "hash": "b673be99e3b55f079434a8e24acb3afe9e3a278d99e4e258a433eec0b21e6e39",

		    "raw": \`query Query {
		  catOwners {
		    cats {
		      id
		    }
		    ... on User {
		      firstName
		      id
		    }
		    __typename
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "catOwners": {
		                "type": "CatOwner",
		                "keyRaw": "catOwners",

		                "directives": [{
		                    "name": "loading",
		                    "arguments": {}
		                }],

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "firstName": {
		                                    "type": "String",
		                                    "keyRaw": "firstName",

		                                    "directives": [{
		                                        "name": "loading",
		                                        "arguments": {}
		                                    }],

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "cats": {
		                                    "type": "Cat",
		                                    "keyRaw": "cats",

		                                    "directives": [{
		                                        "name": "loading",
		                                        "arguments": {}
		                                    }],

		                                    "selection": {
		                                        "fields": {
		                                            "id": {
		                                                "type": "ID",
		                                                "keyRaw": "id",

		                                                "directives": [{
		                                                    "name": "loading",
		                                                    "arguments": {}
		                                                }],

		                                                "visible": true,

		                                                "loading": {
		                                                    "kind": "value"
		                                                }
		                                            }
		                                        }
		                                    },

		                                    "loading": {
		                                        "kind": "continue",

		                                        "list": {
		                                            "depth": 1,
		                                            "count": 3
		                                        }
		                                    },

		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "cats": {
		                            "type": "Cat",
		                            "keyRaw": "cats",

		                            "directives": [{
		                                "name": "loading",
		                                "arguments": {}
		                            }],

		                            "selection": {
		                                "fields": {
		                                    "id": {
		                                        "type": "ID",
		                                        "keyRaw": "id",

		                                        "directives": [{
		                                            "name": "loading",
		                                            "arguments": {}
		                                        }],

		                                        "visible": true,

		                                        "loading": {
		                                            "kind": "value"
		                                        }
		                                    }
		                                }
		                            },

		                            "loading": {
		                                "kind": "continue",

		                                "list": {
		                                    "depth": 1,
		                                    "count": 3
		                                }
		                            },

		                            "visible": true
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    },

		                    "loadingTypes": ["User"]
		                },

		                "loading": {
		                    "kind": "continue",

		                    "list": {
		                        "depth": 1,
		                        "count": 3
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "enableLoadingState": "local",
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=f3ed974f02969cd4ab64d39108227cd25523ff042d6f46358fb907c8e7b383dc";
	`)
})

test('loading state on multiple branches of an abstract selection', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query Query {
				entities @loading {
					... on User @loading {
						firstName @loading
					}
					... on Cat @loading {
						name @loading
					}
				}
			}`
		),
	]

	// execute the generator
	await runPipeline(config, docs)

	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Query",
		    "kind": "HoudiniQuery",
		    "hash": "567fd887397a9072784a6320f8609a66bdb69a3d3cbb791428c8cd342dccd67f",

		    "raw": \`query Query {
		  entities {
		    ... on User {
		      firstName
		      id
		    }
		    ... on Cat {
		      name
		      id
		    }
		    __typename
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "entities": {
		                "type": "Entity",
		                "keyRaw": "entities",

		                "directives": [{
		                    "name": "loading",
		                    "arguments": {}
		                }],

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "firstName": {
		                                    "type": "String",
		                                    "keyRaw": "firstName",

		                                    "directives": [{
		                                        "name": "loading",
		                                        "arguments": {}
		                                    }],

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            },

		                            "Cat": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",

		                                    "directives": [{
		                                        "name": "loading",
		                                        "arguments": {}
		                                    }],

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    },

		                    "loadingTypes": ["User", "Cat"]
		                },

		                "loading": {
		                    "kind": "continue",

		                    "list": {
		                        "depth": 1,
		                        "count": 3
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "enableLoadingState": "local",
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=f22627b545cab6185ae10ea60be8e02b7cde67cce7f72a878bf93251c350204f";
	`)
})

test('loading state on inline fragments', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query Query {
				entity @loading {
                    ...Info @loading
				}
			}`
		),
		mockCollectedDoc(`
            fragment Info on Entity {
                ... on User @loading {
                    firstName @loading
                }
            }
        `),
	]

	// execute the generator
	await runPipeline(config, docs)

	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Query",
		    "kind": "HoudiniQuery",
		    "hash": "ed0970b3886e2211f38a0a3d328601407380f13907c5a69a5bd462f7aca6741b",

		    "raw": \`query Query {
		  entity {
		    ...Info
		    __typename
		  }
		}

		fragment Info on Entity {
		  ... on User {
		    firstName
		    id
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "entity": {
		                "type": "Entity",
		                "keyRaw": "entity",

		                "directives": [{
		                    "name": "loading",
		                    "arguments": {}
		                }],

		                "selection": {
		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    },

		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "firstName": {
		                                    "type": "String",
		                                    "keyRaw": "firstName",

		                                    "directives": [{
		                                        "name": "loading",
		                                        "arguments": {}
		                                    }],

		                                    "loading": {
		                                        "kind": "value"
		                                    }
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fragments": {
		                        "Info": {
		                            "arguments": {},
		                            "loading": true
		                        }
		                    },

		                    "loadingTypes": ["User"]
		                },

		                "loading": {
		                    "kind": "continue"
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "enableLoadingState": "local",
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=afd7c4eff63b6b0cd95dd87566a6c0a99089e66412aed0ae111b511c8f29de4b";
	`)
})

test('persist count in loading spec', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query Query {
				entities @loading(count: 5) {
					... on User @loading {
						firstName @loading
					}
					... on Cat  {
						name
					}
				}
			}`
		),
	]

	// execute the generator
	await runPipeline(config, docs)

	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Query",
		    "kind": "HoudiniQuery",
		    "hash": "567fd887397a9072784a6320f8609a66bdb69a3d3cbb791428c8cd342dccd67f",

		    "raw": \`query Query {
		  entities {
		    ... on User {
		      firstName
		      id
		    }
		    ... on Cat {
		      name
		      id
		    }
		    __typename
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "entities": {
		                "type": "Entity",
		                "keyRaw": "entities",

		                "directives": [{
		                    "name": "loading",

		                    "arguments": {
		                        "count": {
		                            "kind": "IntValue",
		                            "value": "5"
		                        }
		                    }
		                }],

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "firstName": {
		                                    "type": "String",
		                                    "keyRaw": "firstName",

		                                    "directives": [{
		                                        "name": "loading",
		                                        "arguments": {}
		                                    }],

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            },

		                            "Cat": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",
		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    },

		                    "loadingTypes": ["User"]
		                },

		                "loading": {
		                    "kind": "continue",

		                    "list": {
		                        "depth": 1,
		                        "count": 5
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "enableLoadingState": "local",
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=3947712af714fc77cea2b4f87481140e2f864f534b037a040e791c8214659700";
	`)
})

test('loading state on definitions', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query Query @loading {
				entities {
					... on User {
						firstName
					}
					... on Cat  {
						name
					}
				}
			}`
		),
	]

	// execute the generator
	await runPipeline(config, docs)

	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Query",
		    "kind": "HoudiniQuery",
		    "hash": "567fd887397a9072784a6320f8609a66bdb69a3d3cbb791428c8cd342dccd67f",

		    "raw": \`query Query {
		  entities {
		    ... on User {
		      firstName
		      id
		    }
		    ... on Cat {
		      name
		      id
		    }
		    __typename
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "entities": {
		                "type": "Entity",
		                "keyRaw": "entities",

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "firstName": {
		                                    "type": "String",
		                                    "keyRaw": "firstName",

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true,

		                                    "loading": {
		                                        "kind": "value"
		                                    }
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                }
		                            },

		                            "Cat": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true,

		                                    "loading": {
		                                        "kind": "value"
		                                    }
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",

		                            "loading": {
		                                "kind": "value"
		                            },

		                            "visible": true
		                        }
		                    }
		                },

		                "loading": {
		                    "kind": "continue",

		                    "list": {
		                        "depth": 1,
		                        "count": 3
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "enableLoadingState": "global",
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=a24fb766d682cde39dcc54c587cce6380b9aef13f258d912d4b11ddbaa5f58ae";
	`)
})

test('loading cascade', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query Query {
				entities  @loading (cascade: true) {
					... on User {
						firstName
					}
					... on Cat  {
						name
					}
				}

				b: entities { 
					... on User {
						firstName
					}
				}
			}`
		),
	]

	// execute the generator
	await runPipeline(config, docs)

	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Query",
		    "kind": "HoudiniQuery",
		    "hash": "10f12e15c7975a8f61f8d519aaf69dea273054da2d8feaf27803aceb7e4f3e1d",

		    "raw": \`query Query {
		  entities {
		    ... on User {
		      firstName
		      id
		    }
		    ... on Cat {
		      name
		      id
		    }
		    __typename
		  }
		  b: entities {
		    ... on User {
		      firstName
		      id
		    }
		    __typename
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "entities": {
		                "type": "Entity",
		                "keyRaw": "entities",

		                "directives": [{
		                    "name": "loading",

		                    "arguments": {
		                        "cascade": {
		                            "kind": "BooleanValue",
		                            "value": true
		                        }
		                    }
		                }],

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "firstName": {
		                                    "type": "String",
		                                    "keyRaw": "firstName",

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true,

		                                    "loading": {
		                                        "kind": "value"
		                                    }
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                }
		                            },

		                            "Cat": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true,

		                                    "loading": {
		                                        "kind": "value"
		                                    }
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",

		                                    "loading": {
		                                        "kind": "value"
		                                    },

		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",

		                            "loading": {
		                                "kind": "value"
		                            },

		                            "visible": true
		                        }
		                    }
		                },

		                "loading": {
		                    "kind": "continue",

		                    "list": {
		                        "depth": 1,
		                        "count": 3
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            },

		            "b": {
		                "type": "Entity",
		                "keyRaw": "b",

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "firstName": {
		                                    "type": "String",
		                                    "keyRaw": "firstName",
		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "enableLoadingState": "local",
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=62941c9d3ef6ff07c7126d463f3f0ca78a942a89e1e95e07c1fbdb0d8fccdfe9";
	`)
})
