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
		ignoreMaskDisable: true,
	})

	const artifactSelection = selection({
		config,
		filepath: '',
		rootType: 'Query',
		operations: {},
		selections: flat,
		document: mockCollectedDoc(`
        query Query {
            entities {
                ...EntityInfo
            }
        }`),
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
		    "hash": "6c2ec570ec75b009aae97355f5b36acae92039a0bf1750fc62fe144f0898f403",

		    "raw": \`query TestQuery {
		  usersByCursor {
		    edges {
		      node {
		        ...UserTest
		        id
		      }
		    }
		    edges {
		      cursor
		      node {
		        __typename
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		  }
		}

		fragment UserTest on User {
		  firstName
		  id
		  __typename
		}
		\`,

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

		"HoudiniHash=6c2ec570ec75b009aae97355f5b36acae92039a0bf1750fc62fe144f0898f403";
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
		    "hash": "89c94f9d620d10fccfc1015a29590d05b9fb2adee3a0b895f00c14b62d279ce9",

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

		"HoudiniHash=89c94f9d620d10fccfc1015a29590d05b9fb2adee3a0b895f00c14b62d279ce9";
	`)
})

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
		    "hash": "9283d1c1a5755e8562f4e365f05f30cc1a37223fd93ba276eabf77971a15b387",

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
		    "enableLoadingState": true,
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
		    "hash": "f3ed974f02969cd4ab64d39108227cd25523ff042d6f46358fb907c8e7b383dc",

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
		    "enableLoadingState": true,
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=f3ed974f02969cd4ab64d39108227cd25523ff042d6f46358fb907c8e7b383dc";
	`)
})

test('loading state on inline fragments', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query Query {
				entities @loading {
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
		    "hash": "2d150cff71880d74b32c9ad056fb36960b0a44daf3d4876ed804f0145c691edf",

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
		                        "count": 3
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "enableLoadingState": true,
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=2d150cff71880d74b32c9ad056fb36960b0a44daf3d4876ed804f0145c691edf";
	`)
})
