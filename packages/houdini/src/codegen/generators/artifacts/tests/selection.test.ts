import * as graphql from 'graphql'
import { test, expect } from 'vitest'

import { runPipeline } from '../../..'
import { mockCollectedDoc, testConfig } from '../../../../test'
import { flattenSelections } from '../../../utils'
import selection from '../selection'

test('fragments of unions inject correctly', function () {
	const document = graphql.parse(`
        query {
            entities {
                ...EntityInfo
            }
        }

        fragment EntityInfo on Entity {
            ... on User {
                firstName
            }
            ... on Cat {
                name
            }
        }
    `)

	const config = testConfig()
	const fragmentDefinitions = {
		EntityInfo: document.definitions.find(
			(def): def is graphql.FragmentDefinitionNode => def.kind === 'FragmentDefinition'
		)!,
	}

	const flat = flattenSelections({
		config,
		filepath: '',
		selections: document.definitions.find(
			(def): def is graphql.OperationDefinitionNode => def.kind === 'OperationDefinition'
		)!.selectionSet.selections,
		fragmentDefinitions,
		applyFragments: true,
	})

	const artifactSelection = selection({
		config,
		filepath: '',
		rootType: 'Query',
		operations: {},
		selections: flat,
		includeFragments: true,

		document: mockCollectedDoc(`
			query Query {
				entities {
					...EntityInfo
				}
			}
		`),
	})

	expect(artifactSelection).toMatchInlineSnapshot(`
		{
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
		                                "keyRaw": "firstName"
		                            }
		                        },
		                        "Cat": {
		                            "name": {
		                                "type": "String",
		                                "keyRaw": "name"
		                            }
		                        }
		                    },
		                    "typeMap": {}
		                },
		                "fragments": {
		                    "EntityInfo": {
		                        "arguments": {}
		                    }
		                }
		            },
		            "abstract": true
		        }
		    }
		}
	`)
})

test('fragments in lists', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query TestQuery {
				usersByCursor @list(name: "All_Users") {
					edges {
						node {
							...UserTest
						}
					}
				}
			}`
		),
		mockCollectedDoc(
			`fragment UserTest on User {
				firstName
			}`
		),
	]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "91b23604b402b84e2d83099ca8afc0953ce7e9abdad65e7ea3fb20ba5893e4ce",
		    "raw": "",
		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "usersByCursor": {
		                "type": "UserConnection",
		                "keyRaw": "usersByCursor",

		                "directives": [{
		                    "name": "list",

		                    "arguments": {
		                        "name": {
		                            "kind": "StringValue",
		                            "value": "All_Users"
		                        },

		                        "connection": {
		                            "kind": "BooleanValue",
		                            "value": true
		                        }
		                    }
		                }],

		                "list": {
		                    "name": "All_Users",
		                    "connection": true,
		                    "type": "User"
		                },

		                "selection": {
		                    "fields": {
		                        "edges": {
		                            "type": "UserEdge",
		                            "keyRaw": "edges",

		                            "selection": {
		                                "fields": {
		                                    "node": {
		                                        "type": "User",
		                                        "keyRaw": "node",
		                                        "nullable": true,

		                                        "selection": {
		                                            "fields": {
		                                                "firstName": {
		                                                    "type": "String",
		                                                    "keyRaw": "firstName"
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

		                                            "fragments": {
		                                                "UserTest": {
		                                                    "arguments": {}
		                                                }
		                                            }
		                                        },

		                                        "visible": true
		                                    },

		                                    "cursor": {
		                                        "type": "String",
		                                        "keyRaw": "cursor",
		                                        "visible": true
		                                    }
		                                }
		                            },

		                            "visible": true
		                        },

		                        "pageInfo": {
		                            "type": "PageInfo",
		                            "keyRaw": "pageInfo",

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

		                            "visible": true
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=91b23604b402b84e2d83099ca8afc0953ce7e9abdad65e7ea3fb20ba5893e4ce";
	`)
})

test('concrete selection applies mask over abstract selection', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query MonkeyListQuery {
				monkeys {
					pageInfo {
					hasPreviousPage
					hasNextPage
					startCursor
					endCursor
					}
					...AnimalsList
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

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "MonkeyListQuery",
		    "kind": "HoudiniQuery",
		    "hash": "5e86edd84280f328c6e368f75bb1f19cfd2eff5876bc240cf98cca13daae05ad",
		    "raw": "",
		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "monkeys": {
		                "type": "MonkeyConnection",
		                "keyRaw": "monkeys",

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

		                            "visible": true
		                        }
		                    },

		                    "fragments": {
		                        "AnimalsList": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=5e86edd84280f328c6e368f75bb1f19cfd2eff5876bc240cf98cca13daae05ad";
	`)
})
