import { test, expect, describe } from 'vitest'

import { runPipeline } from '../../..'
import type { Document } from '../../../../../lib'
import { fs } from '../../../../../lib'
import { mockCollectedDoc, testConfig } from '../../../../test'

test('some artifactData added to artifact specific to plugins', async function () {
	// the config to use in tests
	const localConfig = testConfig()

	localConfig.plugins = [
		{
			name: 'plugin-tmp1',
			filepath: '',
			artifactData: () => {
				return {
					added_stuff: { yop: 'true' },
				}
			},
		},
		{
			name: 'plugin-tmp2',
			filepath: '',
		},
	]

	// the documents to test
	const docs: Document[] = [mockCollectedDoc(`query TestQuery { version }`)]

	// execute the generator
	await runPipeline(localConfig, docs)

	// load the contents of the file
	// We should have nothing related to plugin-tmp2
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2",

		    "raw": \`query TestQuery {
		  version
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "version": {
		                "type": "Int",
		                "keyRaw": "version",
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {
		        "plugin-tmp1": {
		            "added_stuff": {
		                "yop": "true"
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=4e7afee5e8aa689ee7f58f61f60955769c29fe630b05a32ca2a5d8f61620afe3";
	`)
})

test('client nullability', async function () {
	// the config to use in tests
	const config = testConfig()

	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query TestQuery($id: ID!) {
				node(id: $id) {
					...LegendWithRequiredName
					...GhostWithRequiredLegendName
					...GhostWithRequiredLegendAndLegendName
				}
			}
		`),
		mockCollectedDoc(`
			fragment LegendWithRequiredName on Legend {
				name @required
			}
		`),
		mockCollectedDoc(`
			fragment GhostWithRequiredLegendName on Ghost {
				legends {
					name @required
				}
			}
		`),
		mockCollectedDoc(`
			fragment GhostWithRequiredLegendAndLegendName on Ghost {
				legends @required {
					name @required
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "af247d6de9dde7a1cab76049b4590fcf075346eec4bc7fc4a8937f2d71e4aade",

		    "raw": \`query TestQuery($id: ID!) {
		  node(id: $id) {
		    ...LegendWithRequiredName
		    ...GhostWithRequiredLegendName
		    ...GhostWithRequiredLegendAndLegendName
		    id
		    __typename
		  }
		}

		fragment LegendWithRequiredName on Legend {
		  name
		  __typename
		}

		fragment GhostWithRequiredLegendName on Ghost {
		  legends {
		    name
		  }
		  name
		  aka
		  __typename
		}

		fragment GhostWithRequiredLegendAndLegendName on Ghost {
		  legends {
		    name
		  }
		  name
		  aka
		  __typename
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: $id)",
		                "nullable": true,

		                "selection": {
		                    "abstractFields": {
		                        "fields": {
		                            "Legend": {
		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",

		                                    "directives": [{
		                                        "name": "required",
		                                        "arguments": {}
		                                    }],

		                                    "nullable": false,
		                                    "required": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                }
		                            },

		                            "Ghost": {
		                                "legends": {
		                                    "type": "Legend",
		                                    "keyRaw": "legends",

		                                    "selection": {
		                                        "fields": {
		                                            "name": {
		                                                "type": "String",
		                                                "keyRaw": "name",

		                                                "directives": [{
		                                                    "name": "required",
		                                                    "arguments": {}
		                                                }],

		                                                "nullable": false,
		                                                "required": true
		                                            }
		                                        }
		                                    },

		                                    "nullable": true
		                                },

		                                "name": {
		                                    "type": "String",
		                                    "keyRaw": "name",
		                                    "visible": true
		                                },

		                                "aka": {
		                                    "type": "String",
		                                    "keyRaw": "aka",
		                                    "visible": true
		                                },

		                                "__typename": {
		                                    "type": "String",
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                },

		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fields": {
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
		                        "LegendWithRequiredName": {
		                            "arguments": {}
		                        },

		                        "GhostWithRequiredLegendName": {
		                            "arguments": {}
		                        },

		                        "GhostWithRequiredLegendAndLegendName": {
		                            "arguments": {}
		                        }
		                    }
		                },

		                "abstract": true,
		                "abstractHasRequired": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "id": "ID"
		        },

		        "types": {},
		        "defaults": {},
		        "runtimeScalars": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=23216f6c7d045549667f3a1d5b156fe3924abc3cd1bbce9cfdcbc3394da6065c";
	`)
})

test('nested abstract fragments', async function () {
	// the config to use in tests
	const config = testConfig()

	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query AnimalsOverview {
				animals {
					...AnimalsOverviewList
				}
			}
		`),
		mockCollectedDoc(`
			fragment AnimalsOverviewList on AnimalConnection {
				edges {
					node {
						... on Monkey {
							...MonkeyFragment
						}
					}
				}
			}
		`),
		mockCollectedDoc(`
			fragment MonkeyFragment on Monkey {
				id
				name
				hasBanana
			}
		`),
	]

	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "AnimalsOverview",
		    "kind": "HoudiniQuery",
		    "hash": "f8b2873db25ee257e57d33dce2ad02ea97ff20d623594812593a9fc75fe54527",

		    "raw": \`query AnimalsOverview {
		  animals {
		    ...AnimalsOverviewList
		    __typename
		  }
		}

		fragment AnimalsOverviewList on AnimalConnection {
		  edges {
		    node {
		      ... on Monkey {
		        ...MonkeyFragment
		        id
		      }
		      id
		      __typename
		    }
		    __typename
		  }
		  __typename
		}

		fragment MonkeyFragment on Monkey {
		  id
		  name
		  hasBanana
		  __typename
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "animals": {
		                "type": "AnimalConnection",
		                "keyRaw": "animals",
		                "nullable": true,

		                "selection": {
		                    "fields": {
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
		                                            "abstractFields": {
		                                                "fields": {
		                                                    "Monkey": {
		                                                        "id": {
		                                                            "type": "ID",
		                                                            "keyRaw": "id",
		                                                            "visible": true
		                                                        },

		                                                        "name": {
		                                                            "type": "String",
		                                                            "keyRaw": "name"
		                                                        },

		                                                        "hasBanana": {
		                                                            "type": "Boolean",
		                                                            "keyRaw": "hasBanana"
		                                                        },

		                                                        "__typename": {
		                                                            "type": "String",
		                                                            "keyRaw": "__typename"
		                                                        }
		                                                    }
		                                                },

		                                                "typeMap": {}
		                                            },

		                                            "fields": {
		                                                "id": {
		                                                    "type": "ID",
		                                                    "keyRaw": "id",
		                                                    "visible": true
		                                                },

		                                                "__typename": {
		                                                    "type": "String",
		                                                    "keyRaw": "__typename"
		                                                }
		                                            },

		                                            "fragments": {
		                                                "MonkeyFragment": {
		                                                    "arguments": {}
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
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    },

		                    "fragments": {
		                        "AnimalsOverviewList": {
		                            "arguments": {}
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

		"HoudiniHash=76b03979f7da0a69d5fbf2aa80f2ff7610168ec74b7545b16344b1e37deca9d2";
	`)

	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "AnimalsOverviewList",
		    "kind": "HoudiniFragment",
		    "hash": "80b0907b53d8a2fc39aa5fb018a75c8fc8d647ab741e3f4c4eea6a15ac5239cd",

		    "raw": \`fragment AnimalsOverviewList on AnimalConnection {
		  edges {
		    node {
		      ... on Monkey {
		        ...MonkeyFragment
		        id
		      }
		      id
		      __typename
		    }
		    __typename
		  }
		  __typename
		}

		fragment MonkeyFragment on Monkey {
		  id
		  name
		  hasBanana
		  __typename
		}
		\`,

		    "rootType": "AnimalConnection",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
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
		                                "abstractFields": {
		                                    "fields": {
		                                        "Monkey": {
		                                            "id": {
		                                                "type": "ID",
		                                                "keyRaw": "id",
		                                                "visible": true
		                                            },

		                                            "name": {
		                                                "type": "String",
		                                                "keyRaw": "name"
		                                            },

		                                            "hasBanana": {
		                                                "type": "Boolean",
		                                                "keyRaw": "hasBanana"
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
		                                    "MonkeyFragment": {
		                                        "arguments": {}
		                                    }
		                                }
		                            },

		                            "abstract": true,
		                            "visible": true
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    }
		                },

		                "abstract": true,
		                "visible": true
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename",
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {}
		};

		"HoudiniHash=72091e952cf94a18193cee6cda1caf256f6439e4e202b319d876e9b3365ac319";
	`)
})

test('runtimeScalars', async function () {
	// the config to use in tests
	const config = testConfig()

	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query AnimalsOverview($id: ViewerIDFromSession!) {
				node(id: $id) {
					id
				}
			}
		`),
	]

	await runPipeline(config, docs)

	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "AnimalsOverview",
		    "kind": "HoudiniQuery",
		    "hash": "7bdf3fd75d58f53835443b251587e4ccc3c4e5bcb7e9e8b41e8b15fca19cb82e",

		    "raw": \`query AnimalsOverview($id: ID!) {
		  node(id: $id) {
		    id
		    __typename
		  }
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: $id)",
		                "nullable": true,

		                "selection": {
		                    "fields": {
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

		                "abstract": true,
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "id": "ID"
		        },

		        "types": {},
		        "defaults": {},

		        "runtimeScalars": {
		            "id": "ViewerIDFromSession"
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=df81d1ede64bedbd8a57467683fe68a9366e29a2ed240465ad0c8a9cb4302242";
	`)
})

describe('default arguments', function () {
	test('adds default values to the artifact', async function () {
		// the config to use in tests
		const config = testConfig()
		// the documents to test
		const docs: Document[] = [
			mockCollectedDoc(`
				query UserFriends($count: Int = 10, $search: String = "bob") {
					user {
						friendsByOffset(offset: $count, filter: $search) {
							name
						}
					}
				}
			`),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "UserFriends",
			    "kind": "HoudiniQuery",
			    "hash": "50713a85f40c418e37c1eb92eef9dc136b8916e78b4126a902bde2956a642db3",

			    "raw": \`query UserFriends($count: Int = 10, $search: String = "bob") {
			  user {
			    friendsByOffset(offset: $count, filter: $search) {
			      name
			      id
			    }
			    id
			  }
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
			                        "friendsByOffset": {
			                            "type": "User",
			                            "keyRaw": "friendsByOffset(filter: $search, offset: $count)",

			                            "selection": {
			                                "fields": {
			                                    "name": {
			                                        "type": "String",
			                                        "keyRaw": "name",
			                                        "visible": true
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                }
			                            },

			                            "visible": true
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id",
			                            "visible": true
			                        }
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},

			    "input": {
			        "fields": {
			            "count": "Int",
			            "search": "String"
			        },

			        "types": {},

			        "defaults": {
			            "count": 10,
			            "search": "bob"
			        },

			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=d1f65a0e526e297d58858015a806c475bdca0a1b153f3ee839712ec7ee6190ff";
		`)
	})

	test('handles base scalars correctly', async function () {
		// the config to use in tests
		const config = testConfig()
		// the documents to test
		const docs: Document[] = [
			mockCollectedDoc(`
				query ListUsers($bool: Boolean = true, $int: Int = 5, $float: Float = 3.14, $string: String = "hello world") {
					users(boolValue: $bool, intValue: $int, floatValue: $float, stringValue: $string) {
						name
					}
				}
			`),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "ListUsers",
			    "kind": "HoudiniQuery",
			    "hash": "8e997ca35d0030fcfbb888a740c20240530c85149e04b931e7d34d489d8be553",

			    "raw": \`query ListUsers($bool: Boolean = true, $int: Int = 5, $float: Float = 3.14, $string: String = "hello world") {
			  users(
			    boolValue: $bool
			    intValue: $int
			    floatValue: $float
			    stringValue: $string
			  ) {
			    name
			    id
			  }
			}
			\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "users": {
			                "type": "User",
			                "keyRaw": "users(boolValue: $bool, floatValue: $float, intValue: $int, stringValue: $string)",

			                "selection": {
			                    "fields": {
			                        "name": {
			                            "type": "String",
			                            "keyRaw": "name",
			                            "visible": true
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id",
			                            "visible": true
			                        }
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},

			    "input": {
			        "fields": {
			            "bool": "Boolean",
			            "int": "Int",
			            "float": "Float",
			            "string": "String"
			        },

			        "types": {},

			        "defaults": {
			            "bool": true,
			            "int": 5,
			            "float": 3.14,
			            "string": "hello world"
			        },

			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=f8edbf4199a63a56d214cd5c845d90310052da75c45f3f3f5abf5f5cdb707a3e";
		`)
	})

	test('handles complex default arguments', async function () {
		// the config to use in tests
		const config = testConfig()
		// the documents to test
		const docs: Document[] = [
			mockCollectedDoc(`
				query FindUser($filter: UserFilter = { name: "bob" }) {
					usersByOffset(offset: 5, filter: $filter) {
						name
					}
				}
			`),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "FindUser",
			    "kind": "HoudiniQuery",
			    "hash": "178720d2fc874e6b58c920f655d292a59a6de314ed70ea9eee335b1ad3fb1755",

			    "raw": \`query FindUser($filter: UserFilter = {name: "bob"}) {
			  usersByOffset(offset: 5, filter: $filter) {
			    name
			    id
			  }
			}
			\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "usersByOffset": {
			                "type": "User",
			                "keyRaw": "usersByOffset(filter: $filter, offset: 5)",

			                "selection": {
			                    "fields": {
			                        "name": {
			                            "type": "String",
			                            "keyRaw": "name",
			                            "visible": true
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id",
			                            "visible": true
			                        }
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},

			    "input": {
			        "fields": {
			            "filter": "UserFilter"
			        },

			        "types": {
			            "UserFilter": {
			                "name": "String"
			            }
			        },

			        "defaults": {
			            "filter": {
			                "name": "bob"
			            }
			        },

			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=4b2886d3afb40660837727c266b5667c81698e3bbf240ec47270a262842f61d8";
		`)
	})
})

test('persists dedupe which', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query FindUser @dedupe{
				usersByOffset {
					name
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "FindUser",
		    "kind": "HoudiniQuery",
		    "hash": "63be02f78e12d6dd155da0aac94892e700a5be1eeb66dfc2305740ce2464dd3b",

		    "raw": \`query FindUser {
		  usersByOffset {
		    name
		    id
		  }
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "usersByOffset": {
		                "type": "User",
		                "keyRaw": "usersByOffset",

		                "selection": {
		                    "fields": {
		                        "name": {
		                            "type": "String",
		                            "keyRaw": "name",
		                            "visible": true
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "dedupe": {
		        "cancel": "last",
		        "match": "Operation"
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=752d5f5b068733a0ab1039b96b5f9d13a45a872329bca86998b1971c4ce0816b";
	`)
})

test('persists dedupe first', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query FindUser @dedupe(cancelFirst: true) {
				usersByOffset {
					name
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "FindUser",
		    "kind": "HoudiniQuery",
		    "hash": "63be02f78e12d6dd155da0aac94892e700a5be1eeb66dfc2305740ce2464dd3b",

		    "raw": \`query FindUser {
		  usersByOffset {
		    name
		    id
		  }
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "usersByOffset": {
		                "type": "User",
		                "keyRaw": "usersByOffset",

		                "selection": {
		                    "fields": {
		                        "name": {
		                            "type": "String",
		                            "keyRaw": "name",
		                            "visible": true
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "dedupe": {
		        "cancel": "first",
		        "match": "Operation"
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=3dfb64916aa4359cf85f08b3544bbc7382fd818935c5a0e92f324a2d2519c227";
	`)
})

describe('Parses the correct matching mode', function () {
	test('match mode variables', async function () {
		// the config to use in tests
		const config = testConfig()
		// the documents to test
		const docs: Document[] = [
			mockCollectedDoc(`
			query FindUser @dedupe(match: Variables) {
				usersByOffset {
					name
				}
			}
		`),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "FindUser",
			    "kind": "HoudiniQuery",
			    "hash": "63be02f78e12d6dd155da0aac94892e700a5be1eeb66dfc2305740ce2464dd3b",

			    "raw": \`query FindUser {
			  usersByOffset {
			    name
			    id
			  }
			}
			\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "usersByOffset": {
			                "type": "User",
			                "keyRaw": "usersByOffset",

			                "selection": {
			                    "fields": {
			                        "name": {
			                            "type": "String",
			                            "keyRaw": "name",
			                            "visible": true
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id",
			                            "visible": true
			                        }
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},

			    "dedupe": {
			        "cancel": "last",
			        "match": "Variables"
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=f3faa6e93bde578b11490f9a32518e410a47ec242b0ef94331fc4fb5b01ace20";
		`)
	})

	test('match mode operation', async function () {
		// the config to use in tests
		const config = testConfig()
		// the documents to test
		const docs: Document[] = [
			mockCollectedDoc(`
			query FindUser @dedupe(match: Operation) {
				usersByOffset {
					name
				}
			}
		`),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "FindUser",
			    "kind": "HoudiniQuery",
			    "hash": "63be02f78e12d6dd155da0aac94892e700a5be1eeb66dfc2305740ce2464dd3b",

			    "raw": \`query FindUser {
			  usersByOffset {
			    name
			    id
			  }
			}
			\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "usersByOffset": {
			                "type": "User",
			                "keyRaw": "usersByOffset",

			                "selection": {
			                    "fields": {
			                        "name": {
			                            "type": "String",
			                            "keyRaw": "name",
			                            "visible": true
			                        },

			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id",
			                            "visible": true
			                        }
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},

			    "dedupe": {
			        "cancel": "last",
			        "match": "Operation"
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=1e1c9cd888a109d85a8bda7c3470aeb645b25678fa17916a3b016816b7a9d783";
		`)
	})
})
