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

test('list of fragment unions', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query Entities {
				entities @list(name: "list_entities") {
					... on User {
						name
					}
					... on Cat {
						name
					}
				}
			}`
		),
		mockCollectedDoc(
			`mutation CatMutation {
				catMutation {
					...list_entities_insert
				}
			}`
		),
	]

	// execute the generator
	await runPipeline(config, docs)

	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "Entities",
		    "kind": "HoudiniQuery",
		    "hash": "4087fc510c6a4252213315a4c4a4d9c915ac81619f1210683e5e7c980cc3390f",

		    "raw": \`query Entities {
		  entities {
		    ... on User {
		      name
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
		                    "name": "list",

		                    "arguments": {
		                        "name": {
		                            "kind": "StringValue",
		                            "value": "list_entities"
		                        }
		                    }
		                }],

		                "list": {
		                    "name": "list_entities",
		                    "connection": false,
		                    "type": "Entity"
		                },

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "User": {
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
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=d7db6b92dac1893d8640c0f9d3535d1f75cdb1017cf4c8960c0bdaefbe119229";
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

test("multiple abstract selections don't conflict", async function () {
	// the config to use in tests
	const config = testConfig({
		schema: `
			type Query {
				articles: ArticleConnection!
				others: OtherConnection!
			}

			union Article = Book | CustomBook | CustomBlueRay

			type Book implements ArticleInterface {
				id: ID!
				title: String!
			}

			type CustomBook implements ArticleInterface & CustomArticleInterface {
				id: ID!
				title: String!
				isCustom: Boolean!
				something: Boolean!
			}

			type CustomBlueRay implements ArticleInterface & CustomArticleInterface {
				id: ID!
				title: String!
				isCustom: Boolean!
				else: Boolean!
			}

			type ArticleEdge {
				cursor: ID!
				node: Article!
			}

			type ArticleConnection {
				edges: [ArticleEdge!]!
				pageInfo: PageInfo!
			}

			interface ArticleInterface {
				id: ID!
				title: String!
			}

			interface CustomArticleInterface {
				id: ID!
				isCustom: Boolean!
			}

			type PageInfo {
				endCursor: String
				hasNextPage: Boolean!
				hasPreviousPage: Boolean!
				startCursor: String
			}

			type OtherEdge {
				cursor: ID!
				node: Article!
			}

			type OtherConnection {
				edges: [OtherEdge!]!
				pageInfo: PageInfo!
			}

		`,
	})
	const docs = [
		mockCollectedDoc(
			`query Articles {
				articles {
				  ...The_articles
				}
				others {
				  ...The_others
				}
			  }
			  `
		),
		mockCollectedDoc(
			`fragment The_articles on ArticleConnection {
				edges {
				  node {
					... on Book {
					  __typename
					  id
					}
					... on CustomArticleInterface {
					  __typename
					  id
					  isCustom
					}
				  }
				}
			  }`
		),
		mockCollectedDoc(
			`fragment The_others on OtherConnection {
				edges {
				  node {
					... on Book {
					  __typename
					  id
					}
					... on CustomArticleInterface {
					  __typename
					  id
					  isCustom
					}
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
		    "name": "Articles",
		    "kind": "HoudiniQuery",
		    "hash": "aaa0127313b60910b437b95e7f37ea6bf01d5fbf426a5aa51da48916a91812de",

		    "raw": \`query Articles {
		  articles {
		    ...The_articles
		  }
		  others {
		    ...The_others
		  }
		}

		fragment The_articles on ArticleConnection {
		  edges {
		    node {
		      ... on Book {
		        __typename
		        id
		      }
		      ... on CustomArticleInterface {
		        __typename
		        id
		        isCustom
		      }
		      __typename
		    }
		  }
		  __typename
		}

		fragment The_others on OtherConnection {
		  edges {
		    node {
		      ... on Book {
		        __typename
		        id
		      }
		      ... on CustomArticleInterface {
		        __typename
		        id
		        isCustom
		      }
		      __typename
		    }
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "articles": {
		                "type": "ArticleConnection",
		                "keyRaw": "articles",

		                "selection": {
		                    "fields": {
		                        "edges": {
		                            "type": "ArticleEdge",
		                            "keyRaw": "edges",

		                            "selection": {
		                                "fields": {
		                                    "node": {
		                                        "type": "Article",
		                                        "keyRaw": "node",

		                                        "selection": {
		                                            "abstractFields": {
		                                                "fields": {
		                                                    "Book": {
		                                                        "__typename": {
		                                                            "type": "String",
		                                                            "keyRaw": "__typename"
		                                                        },

		                                                        "id": {
		                                                            "type": "ID",
		                                                            "keyRaw": "id",
		                                                            "visible": true
		                                                        }
		                                                    },

		                                                    "CustomArticleInterface": {
		                                                        "__typename": {
		                                                            "type": "String",
		                                                            "keyRaw": "__typename"
		                                                        },

		                                                        "id": {
		                                                            "type": "ID",
		                                                            "keyRaw": "id",
		                                                            "visible": true
		                                                        },

		                                                        "isCustom": {
		                                                            "type": "Boolean",
		                                                            "keyRaw": "isCustom"
		                                                        }
		                                                    }
		                                                },

		                                                "typeMap": {
		                                                    "CustomBook": "CustomArticleInterface",
		                                                    "CustomBlueRay": "CustomArticleInterface"
		                                                }
		                                            },

		                                            "fields": {
		                                                "__typename": {
		                                                    "type": "String",
		                                                    "keyRaw": "__typename"
		                                                }
		                                            }
		                                        },

		                                        "abstract": true
		                                    }
		                                }
		                            }
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        }
		                    },

		                    "fragments": {
		                        "The_articles": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "visible": true
		            },

		            "others": {
		                "type": "OtherConnection",
		                "keyRaw": "others",

		                "selection": {
		                    "fields": {
		                        "edges": {
		                            "type": "OtherEdge",
		                            "keyRaw": "edges",

		                            "selection": {
		                                "fields": {
		                                    "node": {
		                                        "type": "Article",
		                                        "keyRaw": "node",

		                                        "selection": {
		                                            "abstractFields": {
		                                                "fields": {
		                                                    "Book": {
		                                                        "__typename": {
		                                                            "type": "String",
		                                                            "keyRaw": "__typename"
		                                                        },

		                                                        "id": {
		                                                            "type": "ID",
		                                                            "keyRaw": "id",
		                                                            "visible": true
		                                                        }
		                                                    },

		                                                    "CustomArticleInterface": {
		                                                        "__typename": {
		                                                            "type": "String",
		                                                            "keyRaw": "__typename"
		                                                        },

		                                                        "id": {
		                                                            "type": "ID",
		                                                            "keyRaw": "id",
		                                                            "visible": true
		                                                        },

		                                                        "isCustom": {
		                                                            "type": "Boolean",
		                                                            "keyRaw": "isCustom"
		                                                        }
		                                                    }
		                                                },

		                                                "typeMap": {
		                                                    "CustomBook": "CustomArticleInterface",
		                                                    "CustomBlueRay": "CustomArticleInterface"
		                                                }
		                                            },

		                                            "fields": {
		                                                "__typename": {
		                                                    "type": "String",
		                                                    "keyRaw": "__typename"
		                                                }
		                                            }
		                                        },

		                                        "abstract": true
		                                    }
		                                }
		                            }
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        }
		                    },

		                    "fragments": {
		                        "The_others": {
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

		"HoudiniHash=bd13373d03a3df9c1dfd11905a885a9acea3fd081833ffd9800e48761d00c583";
	`)
})

test('componentFields get embedded in the selection', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query UserWithAvatar {
			user {
				Avatar
			}
		}`
		),
		mockCollectedDoc(
			`fragment UserAvatar on User @componentField(field: "Avatar", prop: "user") {
				firstName
				FriendList
			}`
		),
		mockCollectedDoc(
			`fragment FriendList on User @componentField(field: "FriendList", prop: "user") {
				firstName
			}`
		),
	]

	// execute the generator
	await runPipeline(config, docs)

	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "UserWithAvatar",
		    "kind": "HoudiniQuery",
		    "hash": "30e4c52e63f8d5ce74e8b8545a099d29e877df195141d1c67221b480f0840014",

		    "raw": \`query UserWithAvatar {
		  user {
		    ...UserAvatar
		    id
		  }
		}

		fragment UserAvatar on User {
		  firstName
		  ...FriendList
		  id
		  __typename
		}

		fragment FriendList on User {
		  firstName
		  id
		  __typename
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
		                            "keyRaw": "__typename"
		                        },

		                        "Avatar": {
		                            "keyRaw": "Avatar",
		                            "type": "Component",

		                            "component": {
		                                "prop": "user",
		                                "key": "User.Avatar",
		                                "fragment": "UserAvatar",
		                                "variables": {}
		                            },

		                            "visible": true
		                        }
		                    },

		                    "fragments": {
		                        "UserAvatar": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "hasComponents": true,
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=bb8055518b549496d9673bb3a0ff9091e20fbe760670c589f689a1dc416211dd";
	`)

	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "UserAvatar",
		    "kind": "HoudiniFragment",
		    "hash": "f5f2155463f80756d17e9e3294cd9f922bbe56ce135a0a39c84bb34b49a13f7e",

		    "raw": \`fragment UserAvatar on User {
		  firstName
		  ...FriendList
		  id
		  __typename
		}

		fragment FriendList on User {
		  firstName
		  id
		  __typename
		}
		\`,

		    "rootType": "User",

		    "selection": {
		        "fields": {
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
		            },

		            "FriendList": {
		                "keyRaw": "FriendList",
		                "type": "Component",

		                "component": {
		                    "prop": "user",
		                    "key": "User.FriendList",
		                    "fragment": "FriendList",
		                    "variables": {}
		                },

		                "visible": true
		            }
		        },

		        "fragments": {
		            "FriendList": {
		                "arguments": {}
		            }
		        }
		    },

		    "pluginData": {},
		    "hasComponents": true
		};

		"HoudiniHash=06be0ac4bd68cba33a2211d36d7235ecf1631722d830c88e0f39ae9896a25f85";
	`)
})
