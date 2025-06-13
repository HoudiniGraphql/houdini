import { test, expect } from 'vitest'

import { runPipeline } from '../../..'
import { mockCollectedDoc, testConfig } from '../../../../test'

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
		    "stripVariables": [],

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
		    "stripVariables": [],

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
		                        },

		                        "FriendList": {
		                            "keyRaw": "FriendList",
		                            "type": "Component",

		                            "component": {
		                                "prop": "user",
		                                "key": "User.FriendList",
		                                "fragment": "FriendList",
		                                "variables": {}
		                            }
		                        }
		                    },

		                    "fragments": {
		                        "UserAvatar": {
		                            "arguments": {}
		                        },

		                        "FriendList": {
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
		    "stripVariables": [],

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

test('fragment argument passed to directive', async function () {
	// the config to use in tests
	const config = testConfig()
	const docs = [
		mockCollectedDoc(
			`query UserDetailsWithBirthday {
				user {
				  name
				  ...UserDetailsArguments @with(showBirthday: true)
				}
			}`
		),
		mockCollectedDoc(
			`fragment UserDetailsArguments on User @arguments(showBirthday: { type: "Boolean!" }) {
				id
				birthday @include(if: $showBirthday)
			  }`
		),
	]

	// execute the generator (there shouldn't be a call-stack bug)
	await runPipeline(config, docs)

	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "UserDetailsArguments",
		    "kind": "HoudiniFragment",
		    "hash": "79a8d7df6a489a0f095761c3159630e50dd05bbff30c2a93bc9aa177cbe40cb5",

		    "raw": \`fragment UserDetailsArguments on User {
		  id
		  birthday @include(if: $showBirthday)
		  __typename
		}
		\`,

		    "rootType": "User",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "id": {
		                "type": "ID",
		                "keyRaw": "id",
		                "visible": true
		            },

		            "birthday": {
		                "type": "DateTime",
		                "keyRaw": "birthday",

		                "directives": [{
		                    "name": "include",

		                    "arguments": {
		                        "if": {
		                            "kind": "Variable",

		                            "name": {
		                                "kind": "Name",
		                                "value": "showBirthday"
		                            }
		                        }
		                    }
		                }],

		                "visible": true
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename",
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "showBirthday": "Boolean"
		        },

		        "types": {},
		        "defaults": {},
		        "runtimeScalars": {}
		    }
		};

		"HoudiniHash=8362b2cdd240eeb06a44c498267a971b7010534b464bba2b36c34a9635eed2ce";
	`)
})
