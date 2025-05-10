import { test, expect, describe } from 'vitest'

import { runPipeline } from '../../..'
import type { Document } from '../../../../../lib'
import { fs } from '../../../../../lib'
import { mockCollectedDoc, testConfig } from '../../../../test'

describe('mutation artifacts', function () {

	test('insert operation allList', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @allLists
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",
			                                "target": "all"
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=90d93ca64a69bec0880925b8af471b0da1cf76964df0b6b6c3af30b6fd877217";
		`)
	})

	test('insert operation allList and @with directive', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @with(filter: "Hello World") @allLists
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery($filter: String) {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
						field(filter: $filter)
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "b1ad7b854a43149aedac6832e6a5bff625e125f516e1fea5806bf4123c4ee687",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert_1oDy9M
			      id
			    }
			  }
			}

			fragment All_Users_insert_1oDy9M on User {
			  firstName
			  field(filter: "Hello World")
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",
			                                "target": "all"
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "field": {
			                                        "type": "String",
			                                        "keyRaw": "field(filter: \\"Hello World\\")",
			                                        "nullable": true
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {
			                                            "filter": {
			                                                "kind": "StringValue",
			                                                "value": "Hello World"
			                                            }
			                                        }
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

			    "pluginData": {}
			};

			"HoudiniHash=f6b965893f6a89f0d97c9a63645b36de599756e3e135d8912b1e0b741164caeb";
		`)
	})

	test('remove operation allList', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_remove @allLists
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "9dc41329a7176f813b623958a68c2752d391151a4f3b1f9b8198f6c487e931a4",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_remove
			      id
			    }
			  }
			}

			fragment All_Users_remove on User {
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "remove",
			                                "list": "All_Users",
			                                "target": "all"
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_remove": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=1687548d0889d73e5d143c8e295e0abe989939d22869a86b86d70488209d73d5";
		`)
	})

	test('toggle operation allList', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_toggle @allLists @prepend
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "e01f8a23cc33c10c4ee3745c041ee97f428b3b4676a5d8d681124f75b09306da",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_toggle
			      id
			    }
			  }
			}

			fragment All_Users_toggle on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "toggle",
			                                "list": "All_Users",
			                                "position": "first",
			                                "target": "all"
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_toggle": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=18243e748112d965c35ee2f2b0e29d430a9c472e30c96f253449296ae3fe636a";
		`)
	})

	test('toggle operation allList and @with directive', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_toggle @with(filter: "Hello World") @allLists @prepend
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery($filter: String) {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
						field(filter: $filter)
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "d7187de06687137a262178ad23eecf315461cd5cef17e2b384cbcdd25fe1e752",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_toggle_1oDy9M
			      id
			    }
			  }
			}

			fragment All_Users_toggle_1oDy9M on User {
			  firstName
			  field(filter: "Hello World")
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "toggle",
			                                "list": "All_Users",
			                                "position": "first",
			                                "target": "all"
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "field": {
			                                        "type": "String",
			                                        "keyRaw": "field(filter: \\"Hello World\\")",
			                                        "nullable": true
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_toggle": {
			                                        "arguments": {
			                                            "filter": {
			                                                "kind": "StringValue",
			                                                "value": "Hello World"
			                                            }
			                                        }
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

			    "pluginData": {}
			};

			"HoudiniHash=2b2f4aafb54ec3bdba80389398aff1d4b6f478a5e58ec714bb6aa82c48e987b5";
		`)
	})

	test('insert operation allList by default in config', async function () {
		// the config to use in tests
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		let configUpdate = testConfig()
		configUpdate.defaultListTarget = 'all'

		// execute the generator
		await runPipeline(configUpdate, docs)

		// verify contents
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",
			                                "target": "all"
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=c2cee63cc2dfd5eabad47ed394b64c91f6e19378bbf018b80c6e3391c3a56e5b";
		`)
	})

	test('insert operation cosition first by default in config', async function () {
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
						users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// the config to use in tests
		let configUpdate = testConfig()
		configUpdate.internalListPosition = 'first'

		// execute the generator
		await runPipeline(configUpdate, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "first"
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=c2cee63cc2dfd5eabad47ed394b64c91f6e19378bbf018b80c6e3391c3a56e5b";
		`)
	})

	test('toggle operation', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_toggle @prepend
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "e01f8a23cc33c10c4ee3745c041ee97f428b3b4676a5d8d681124f75b09306da",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_toggle
			      id
			    }
			  }
			}

			fragment All_Users_toggle on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "toggle",
			                                "list": "All_Users",
			                                "position": "first"
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_toggle": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=cc9a6fb32e9b6a79e2a3c46885d07b11078f84dcb8c52555fb96e3ff6f87f8b2";
		`)
	})

	test('toggle operation and @with directive', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_toggle @with(filter: "Hello World")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery($filter: String) {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
						field(filter: $filter)
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "d7187de06687137a262178ad23eecf315461cd5cef17e2b384cbcdd25fe1e752",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_toggle_1oDy9M
			      id
			    }
			  }
			}

			fragment All_Users_toggle_1oDy9M on User {
			  firstName
			  field(filter: "Hello World")
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "toggle",
			                                "list": "All_Users",
			                                "position": "last"
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "firstName": {
			                                        "type": "String",
			                                        "keyRaw": "firstName"
			                                    },

			                                    "field": {
			                                        "type": "String",
			                                        "keyRaw": "field(filter: \\"Hello World\\")",
			                                        "nullable": true
			                                    },

			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_toggle": {
			                                        "arguments": {
			                                            "filter": {
			                                                "kind": "StringValue",
			                                                "value": "Hello World"
			                                            }
			                                        }
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

			    "pluginData": {}
			};

			"HoudiniHash=4a95f1e6dc9fdce153311e84965a99e72f76fc56a063fced1e28efefc50f143a";
		`)
	})

	test('remove operation', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_remove
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "9dc41329a7176f813b623958a68c2752d391151a4f3b1f9b8198f6c487e931a4",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_remove
			      id
			    }
			  }
			}

			fragment All_Users_remove on User {
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "remove",
			                                "list": "All_Users"
			                            }],

			                            "selection": {
			                                "fields": {
			                                    "id": {
			                                        "type": "ID",
			                                        "keyRaw": "id",
			                                        "visible": true
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_remove": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=a33810e6e3850879918dc77009577f72a2cab24664911bb0a1e57b47c6b7d104";
		`)
	})

	test('delete operation', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					deleteUser(id: "1234") {
						userID @User_delete
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "b9e1e926be309c06c868dc2472c082b6829f93ae55e000317a1066378590a85d",

			    "raw": \`mutation A {
			  deleteUser(id: "1234") {
			    userID
			  }
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "deleteUser": {
			                "type": "DeleteUserOutput",
			                "keyRaw": "deleteUser(id: \\"1234\\")",

			                "selection": {
			                    "fields": {
			                        "userID": {
			                            "type": "ID",
			                            "keyRaw": "userID",

			                            "directives": [{
			                                "name": "User_delete",
			                                "arguments": {}
			                            }],

			                            "operations": [{
			                                "action": "delete",
			                                "type": "User"
			                            }],

			                            "visible": true
			                        }
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {}
			};

			"HoudiniHash=02916c12509a82eb42926c996cc383fde93bc550a72887cd6cf259a1164543da";
		`)
	})

	test('delete operation with condition', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					deleteUser(id: "1234") {
						userID @User_delete @when(stringValue: "foo")
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "b9e1e926be309c06c868dc2472c082b6829f93ae55e000317a1066378590a85d",

			    "raw": \`mutation A {
			  deleteUser(id: "1234") {
			    userID
			  }
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "deleteUser": {
			                "type": "DeleteUserOutput",
			                "keyRaw": "deleteUser(id: \\"1234\\")",

			                "selection": {
			                    "fields": {
			                        "userID": {
			                            "type": "ID",
			                            "keyRaw": "userID",

			                            "directives": [{
			                                "name": "User_delete",
			                                "arguments": {}
			                            }, {
			                                "name": "when",

			                                "arguments": {
			                                    "stringValue": {
			                                        "kind": "StringValue",
			                                        "value": "foo"
			                                    }
			                                }
			                            }],

			                            "operations": [{
			                                "action": "delete",
			                                "type": "User",

			                                "when": {
			                                    "must": {
			                                        "stringValue": "foo"
			                                    }
			                                }
			                            }],

			                            "visible": true
			                        }
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {}
			};

			"HoudiniHash=da85d1acef7d12c0a3185f625a7f77a22a4d2ec90fc91d1a919aefd9209db113";
		`)
	})

	test('parentID - prepend', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "first",

			                                "parentID": {
			                                    "kind": "String",
			                                    "value": "1234"
			                                }
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=3bea2bec5d5cac795d941051dbacf5941a18716579f1f63aefb7b898372252d5";
		`)
	})

	test('parentID - append', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @append @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",

			                                "parentID": {
			                                    "kind": "String",
			                                    "value": "1234"
			                                }
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=db83e4480bab1a728042e1da417a3bb1c3acdbe52658847b508d00cf88aa7065";
		`)
	})

	test('parentID - parentID directive', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",

			                                "parentID": {
			                                    "kind": "String",
			                                    "value": "1234"
			                                }
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=269dd0acb58d7a44b0df6d6a53ed1beaeb5aca5cc216d8011b29425d2eed6584";
		`)
	})

	test('must - prepend', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend(when: { stringValue: "foo" })
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "first",

			                                "when": {
			                                    "must": {
			                                        "stringValue": "foo"
			                                    }
			                                }
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=5bbd672c18c5febf61cf8335145d6f837b1e711ec3f1a1d5b81241767444c8ed";
		`)
	})

	test('must - append', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @append(when: { stringValue: "true" })
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",

			                                "when": {
			                                    "must": {
			                                        "stringValue": "true"
			                                    }
			                                }
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=8b57b4d6231aeadc73661b6096f815d1f59fa9bb44e62b363d72c7dfcd78048f";
		`)
	})

	test('must - directive', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @when(stringValue: "true")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",

			                                "when": {
			                                    "must": {
			                                        "stringValue": "true"
			                                    }
			                                }
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=c6990945263aa9f52111e9cc0d89b6ccad2a258ca5356f6cf23a7e9424354aa7";
		`)
	})

	test('must_not - prepend', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend(when_not: { stringValue: "true" })
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "first",

			                                "when": {
			                                    "must_not": {
			                                        "stringValue": "true"
			                                    }
			                                }
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=d7fca173168e1a7c842115c468d62ff9d347724c0a8fa20a3408771eef5c7cf9";
		`)
	})

	test('must_not - append', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @append(when_not: { stringValue: "true" })
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",

			                                "when": {
			                                    "must_not": {
			                                        "stringValue": "true"
			                                    }
			                                }
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=cc5ca165e8418fe5ac352c3067402d6aca3c1e76c25efdad5d076dbf294e2554";
		`)
	})

	test('list filters', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @when_not(boolValue: true)
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery($value: String!) {
					users(
						stringValue: $value,
						boolValue: true,
						floatValue: 1.2,
						intValue: 1,
					) @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[1]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "d773bead4120baa620dc05347fba277faaa5bb555e10943507a393eaa3399c52",

			    "raw": \`query TestQuery($value: String!) {
			  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
			    firstName
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
			                "keyRaw": "users(boolValue: true, floatValue: 1.2, intValue: 1, stringValue: $value)",

			                "directives": [{
			                    "name": "list",

			                    "arguments": {
			                        "name": {
			                            "kind": "StringValue",
			                            "value": "All_Users"
			                        }
			                    }
			                }],

			                "list": {
			                    "name": "All_Users",
			                    "connection": false,
			                    "type": "User"
			                },

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
			                        }
			                    }
			                },

			                "filters": {
			                    "stringValue": {
			                        "kind": "Variable",
			                        "value": "value"
			                    },

			                    "boolValue": {
			                        "kind": "Boolean",
			                        "value": true
			                    },

			                    "floatValue": {
			                        "kind": "Float",
			                        "value": 1.2
			                    },

			                    "intValue": {
			                        "kind": "Int",
			                        "value": 1
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},

			    "input": {
			        "fields": {
			            "value": "String"
			        },

			        "types": {},
			        "defaults": {},
			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=f0b0082b38e66bc9fcefcd11741b874cacb74a1a939221c1618b499df139b356";
		`)
	})

	test('must_not - directive', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @when_not(boolValue: true)
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo", boolValue:true) @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "A",
			    "kind": "HoudiniMutation",
			    "hash": "7cc5c23ffd19603e2c7c727d1ac2726d4d87ee6b0470ced7d28c7f0ed88a05c2",

			    "raw": \`mutation A {
			  addFriend {
			    friend {
			      ...All_Users_insert
			      id
			    }
			  }
			}

			fragment All_Users_insert on User {
			  firstName
			  id
			}
			\`,

			    "rootType": "Mutation",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "addFriend": {
			                "type": "AddFriendOutput",
			                "keyRaw": "addFriend",

			                "selection": {
			                    "fields": {
			                        "friend": {
			                            "type": "User",
			                            "keyRaw": "friend",

			                            "operations": [{
			                                "action": "insert",
			                                "list": "All_Users",
			                                "position": "last",

			                                "when": {
			                                    "must_not": {
			                                        "boolValue": true
			                                    }
			                                }
			                            }],

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
			                                    }
			                                },

			                                "fragments": {
			                                    "All_Users_insert": {
			                                        "arguments": {}
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

			    "pluginData": {}
			};

			"HoudiniHash=a29794de026215f4e9266358741cf0ab3876640e1230e3dc190907d5cc7c1c37";
		`)
	})

	test('tracks list name', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[1]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "2997353b3d1f04e02b9d211bb4f4069b63f8536b7f1eb686fc74fd8b3dab8dbd",

			    "raw": \`query TestQuery {
			  users(stringValue: "foo") {
			    firstName
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
			                "keyRaw": "users(stringValue: \\"foo\\")",

			                "directives": [{
			                    "name": "list",

			                    "arguments": {
			                        "name": {
			                            "kind": "StringValue",
			                            "value": "All_Users"
			                        }
			                    }
			                }],

			                "list": {
			                    "name": "All_Users",
			                    "connection": false,
			                    "type": "User"
			                },

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
			                        }
			                    }
			                },

			                "filters": {
			                    "stringValue": {
			                        "kind": "String",
			                        "value": "foo"
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

			"HoudiniHash=85351c80364eb41f7eae70628dd67dedfc2057a39ef3967c9e9b739e568b0f42";
		`)
	})

	test('tracks paginate name', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					usersByCursor(first: 10) @paginate(name: "All_Users") {
						edges {
							node {
								firstName
							}
						}
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[1]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "6ca70e636d72875139c7d7bb34b4a9f59d88e2b518613aa136fda4b0ed539936",

			    "refetch": {
			        "path": ["usersByCursor"],
			        "method": "cursor",
			        "pageSize": 10,
			        "embedded": false,
			        "targetType": "Query",
			        "paginated": true,
			        "direction": "both",
			        "mode": "Infinite"
			    },

			    "raw": \`query TestQuery($first: Int = 10, $after: String, $last: Int, $before: String) {
			  usersByCursor(first: $first, after: $after, last: $last, before: $before) {
			    edges {
			      node {
			        firstName
			        id
			      }
			    }
			    edges {
			      cursor
			      node {
			        __typename
			        id
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
			\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "usersByCursor": {
			                "type": "UserConnection",
			                "keyRaw": "usersByCursor::paginated",

			                "directives": [{
			                    "name": "paginate",

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
			                            "updates": ["append", "prepend"],

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
			                                        "updates": ["append", "prepend"],
			                                        "visible": true
			                                    },

			                                    "hasNextPage": {
			                                        "type": "Boolean",
			                                        "keyRaw": "hasNextPage",
			                                        "updates": ["append", "prepend"],
			                                        "visible": true
			                                    },

			                                    "startCursor": {
			                                        "type": "String",
			                                        "keyRaw": "startCursor",
			                                        "updates": ["append", "prepend"],
			                                        "visible": true
			                                    },

			                                    "endCursor": {
			                                        "type": "String",
			                                        "keyRaw": "endCursor",
			                                        "updates": ["append", "prepend"],
			                                        "visible": true
			                                    }
			                                }
			                            },

			                            "visible": true
			                        }
			                    }
			                },

			                "filters": {
			                    "first": {
			                        "kind": "Variable",
			                        "value": "first"
			                    },

			                    "after": {
			                        "kind": "Variable",
			                        "value": "after"
			                    },

			                    "last": {
			                        "kind": "Variable",
			                        "value": "last"
			                    },

			                    "before": {
			                        "kind": "Variable",
			                        "value": "before"
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

			    "input": {
			        "fields": {
			            "first": "Int",
			            "after": "String",
			            "last": "Int",
			            "before": "String"
			        },

			        "types": {},

			        "defaults": {
			            "first": 10
			        },

			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=9aec53bb0325a811ba8adfc41b04524f0ed859aa1b0f9d5e04d4bc02f639e52f";
		`)
	})

	test('tracks paginate mode', async function () {
		const config = testConfig()

		const docs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					usersByCursor(first: 10) @paginate(name: "All_Users", mode: SinglePage) {
						edges {
							node {
								firstName
							}
						}
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, docs)

		// load the contents of the file
		expect(docs[1]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "6ca70e636d72875139c7d7bb34b4a9f59d88e2b518613aa136fda4b0ed539936",

			    "refetch": {
			        "path": ["usersByCursor"],
			        "method": "cursor",
			        "pageSize": 10,
			        "embedded": false,
			        "targetType": "Query",
			        "paginated": true,
			        "direction": "both",
			        "mode": "SinglePage"
			    },

			    "raw": \`query TestQuery($first: Int = 10, $after: String, $last: Int, $before: String) {
			  usersByCursor(first: $first, after: $after, last: $last, before: $before) {
			    edges {
			      node {
			        firstName
			        id
			      }
			    }
			    edges {
			      cursor
			      node {
			        __typename
			        id
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
			\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "usersByCursor": {
			                "type": "UserConnection",
			                "keyRaw": "usersByCursor(after: $after, before: $before, first: $first, last: $last)::paginated",

			                "directives": [{
			                    "name": "paginate",

			                    "arguments": {
			                        "name": {
			                            "kind": "StringValue",
			                            "value": "All_Users"
			                        },

			                        "mode": {
			                            "kind": "EnumValue",
			                            "value": "SinglePage"
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
			                            "updates": ["append", "prepend"],

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
			                                        "updates": ["append", "prepend"],
			                                        "visible": true
			                                    },

			                                    "hasNextPage": {
			                                        "type": "Boolean",
			                                        "keyRaw": "hasNextPage",
			                                        "updates": ["append", "prepend"],
			                                        "visible": true
			                                    },

			                                    "startCursor": {
			                                        "type": "String",
			                                        "keyRaw": "startCursor",
			                                        "updates": ["append", "prepend"],
			                                        "visible": true
			                                    },

			                                    "endCursor": {
			                                        "type": "String",
			                                        "keyRaw": "endCursor",
			                                        "updates": ["append", "prepend"],
			                                        "visible": true
			                                    }
			                                }
			                            },

			                            "visible": true
			                        }
			                    }
			                },

			                "filters": {
			                    "first": {
			                        "kind": "Variable",
			                        "value": "first"
			                    },

			                    "after": {
			                        "kind": "Variable",
			                        "value": "after"
			                    },

			                    "last": {
			                        "kind": "Variable",
			                        "value": "last"
			                    },

			                    "before": {
			                        "kind": "Variable",
			                        "value": "before"
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

			    "input": {
			        "fields": {
			            "first": "Int",
			            "after": "String",
			            "last": "Int",
			            "before": "String"
			        },

			        "types": {},

			        "defaults": {
			            "first": 10
			        },

			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=930593f99a19ddef0943d66ce3c4539f18938a25410028bfd4cf68554552f1d0";
		`)
	})

	test('field args', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`query TestQuery($value: String!) {
					users(
						stringValue: $value,
						boolValue: true,
						floatValue: 1.2,
						intValue: 1,
					) @list(name: "All_Users") {
						firstName
					}
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
			    "hash": "d773bead4120baa620dc05347fba277faaa5bb555e10943507a393eaa3399c52",

			    "raw": \`query TestQuery($value: String!) {
			  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
			    firstName
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
			                "keyRaw": "users(boolValue: true, floatValue: 1.2, intValue: 1, stringValue: $value)",

			                "directives": [{
			                    "name": "list",

			                    "arguments": {
			                        "name": {
			                            "kind": "StringValue",
			                            "value": "All_Users"
			                        }
			                    }
			                }],

			                "list": {
			                    "name": "All_Users",
			                    "connection": false,
			                    "type": "User"
			                },

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
			                        }
			                    }
			                },

			                "filters": {
			                    "stringValue": {
			                        "kind": "Variable",
			                        "value": "value"
			                    },

			                    "boolValue": {
			                        "kind": "Boolean",
			                        "value": true
			                    },

			                    "floatValue": {
			                        "kind": "Float",
			                        "value": 1.2
			                    },

			                    "intValue": {
			                        "kind": "Int",
			                        "value": 1
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},

			    "input": {
			        "fields": {
			            "value": "String"
			        },

			        "types": {},
			        "defaults": {},
			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=f0b0082b38e66bc9fcefcd11741b874cacb74a1a939221c1618b499df139b356";
		`)
	})

	test('sveltekit', async function () {
		// the config to use in tests
		const config = testConfig({ module: 'esm' })

		const docs = [
			mockCollectedDoc(
				`query TestQuery($value: String!) {
					users(
						stringValue: $value,
						boolValue: true,
						floatValue: 1.2,
						intValue: 1,
					) @list(name: "All_Users") {
						firstName
					}
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
			    "hash": "d773bead4120baa620dc05347fba277faaa5bb555e10943507a393eaa3399c52",

			    "raw": \`query TestQuery($value: String!) {
			  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
			    firstName
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
			                "keyRaw": "users(boolValue: true, floatValue: 1.2, intValue: 1, stringValue: $value)",

			                "directives": [{
			                    "name": "list",

			                    "arguments": {
			                        "name": {
			                            "kind": "StringValue",
			                            "value": "All_Users"
			                        }
			                    }
			                }],

			                "list": {
			                    "name": "All_Users",
			                    "connection": false,
			                    "type": "User"
			                },

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
			                        }
			                    }
			                },

			                "filters": {
			                    "stringValue": {
			                        "kind": "Variable",
			                        "value": "value"
			                    },

			                    "boolValue": {
			                        "kind": "Boolean",
			                        "value": true
			                    },

			                    "floatValue": {
			                        "kind": "Float",
			                        "value": 1.2
			                    },

			                    "intValue": {
			                        "kind": "Int",
			                        "value": 1
			                    }
			                },

			                "visible": true
			            }
			        }
			    },

			    "pluginData": {},

			    "input": {
			        "fields": {
			            "value": "String"
			        },

			        "types": {},
			        "defaults": {},
			        "runtimeScalars": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=f0b0082b38e66bc9fcefcd11741b874cacb74a1a939221c1618b499df139b356";
		`)
	})
})

test('custom scalar shows up in artifact', async function () {
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`query TestQuery { version }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]

	// define a config with a custom scalar
	const localConfig = testConfig({
		schema: `
			scalar DateTime
			type TodoItem {
				text: String!
				createdAt: DateTime!
			}
			type Query {
				allItems: [TodoItem!]!
			}
		`,
		scalars: {
			DateTime: {
				type: 'Date',
				unmarshal(val: number): Date {
					return new Date(val)
				},
				marshal(date: Date): number {
					return date.getTime()
				},
			},
		},
	})

	// execute the generator
	await runPipeline(localConfig, [mockCollectedDoc(`query TestQuery { allItems { createdAt } }`)])

	// load the contents of the file
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "b8314df1f7d924f76e6dfe6e7e3c8efd593db931c67c892311e97a9ec1d429b4",

		    "raw": \`query TestQuery {
		  allItems {
		    createdAt
		  }
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "allItems": {
		                "type": "TodoItem",
		                "keyRaw": "allItems",

		                "selection": {
		                    "fields": {
		                        "createdAt": {
		                            "type": "DateTime",
		                            "keyRaw": "createdAt",
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

		"HoudiniHash=5eb3e999f486aba5c66170642f3d99537b7c17d793a9d8553533e3d949860213";
	`)
})

describe('subscription artifacts', function () {
	test('happy path', async function () {
		// the config to use in tests
		const config = testConfig()
		const docs = [
			mockCollectedDoc(
				`subscription B {
					newUser {
						user {
							firstName
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
			    "name": "B",
			    "kind": "HoudiniSubscription",
			    "hash": "755fb65bebc83835db68921b7e193809246fb6f9ee2e37cc66d7314b91a501e7",

			    "raw": \`subscription B {
			  newUser {
			    user {
			      firstName
			      id
			    }
			  }
			}
			\`,

			    "rootType": "Subscription",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "newUser": {
			                "type": "NewUserResult",
			                "keyRaw": "newUser",

			                "selection": {
			                    "fields": {
			                        "user": {
			                            "type": "User",
			                            "keyRaw": "user",

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

			    "pluginData": {}
			};

			"HoudiniHash=df5bc6be33a8a16e9353ff30c07e45d5e54531ab53157208255fdfec52c7b168";
		`)
	})
})

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

test('nested recursive fragments', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query MyAnimalQuery {
				node(id: "some_id") {
					id

					...NodeDetails

					... on User {
						...UserThings
					}
				}
			}
		`),
		mockCollectedDoc(`
			fragment UserThings on User {
				id
				name

				...NodeDetails
			}
		`),
		mockCollectedDoc(`
			fragment NodeDetails on Node {
				id

				... on User {
					id
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "MyAnimalQuery",
		    "kind": "HoudiniQuery",
		    "hash": "bef32f9431c60063291fea8375de73b98c703421a89721d8b03a9e5e0ae373bd",

		    "raw": \`query MyAnimalQuery {
		  node(id: "some_id") {
		    id
		    ...NodeDetails
		    ... on User {
		      ...UserThings
		      id
		    }
		    __typename
		  }
		}

		fragment NodeDetails on Node {
		  id
		  ... on User {
		    id
		  }
		  __typename
		}

		fragment UserThings on User {
		  id
		  name
		  ...NodeDetails
		  __typename
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: \\"some_id\\")",
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
		                    },

		                    "abstractFields": {
		                        "fields": {
		                            "User": {
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
		                                    "keyRaw": "__typename",
		                                    "visible": true
		                                }
		                            }
		                        },

		                        "typeMap": {}
		                    },

		                    "fragments": {
		                        "NodeDetails": {
		                            "arguments": {}
		                        },

		                        "UserThings": {
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

		"HoudiniHash=5bffb5d88b4646c49637e5f92f601ee632823009b7bf5fdfafb1f107b5fc35cd";
	`)
})

test('leave @include and @skip alone', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query MyAnimalQuery {
				node(id: "some_id") {
					id @skip(if: true)

					...NodeDetails @include(if:true)
				}
			}
		`),
		mockCollectedDoc(`
			fragment NodeDetails on Node {
				id

				... on User {
					id
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "MyAnimalQuery",
		    "kind": "HoudiniQuery",
		    "hash": "ece1546c435cde03fdfb659b202fba2393b0b9828e8efbbe24f803a0707f3e02",

		    "raw": \`query MyAnimalQuery {
		  node(id: "some_id") {
		    id @skip(if: true)
		    ...NodeDetails @include(if: true)
		    __typename
		  }
		}

		fragment NodeDetails on Node {
		  id
		  ... on User {
		    id
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: \\"some_id\\")",
		                "nullable": true,

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true,

		                            "directives": [{
		                                "name": "skip",

		                                "arguments": {
		                                    "if": {
		                                        "kind": "BooleanValue",
		                                        "value": true
		                                    }
		                                }
		                            }]
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename",
		                            "visible": true
		                        }
		                    },

		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "id": {
		                                    "type": "ID",
		                                    "keyRaw": "id",
		                                    "visible": true,

		                                    "directives": [{
		                                        "name": "skip",

		                                        "arguments": {
		                                            "if": {
		                                                "kind": "BooleanValue",
		                                                "value": true
		                                            }
		                                        }
		                                    }]
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
		                        "NodeDetails": {
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

		"HoudiniHash=45c8890ba76a34c30028cbaa75e8ba78ca8884a3651a5c1f77d103969eff5855";
	`)
})

test('fragment references are embedded in artifact', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query MyAnimalQuery {
				node(id: "some_id") {
					id

					...NodeDetails

				}
			}
		`),
		mockCollectedDoc(`
			fragment NodeDetails on Node {
				id

				... on User {
					id
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "MyAnimalQuery",
		    "kind": "HoudiniQuery",
		    "hash": "d5c8c7b13dddb230796354b42cd0a86ac0beed1d3a40e8b9288545908f96370d",

		    "raw": \`query MyAnimalQuery {
		  node(id: "some_id") {
		    id
		    ...NodeDetails
		    __typename
		  }
		}

		fragment NodeDetails on Node {
		  id
		  ... on User {
		    id
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: \\"some_id\\")",
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
		                    },

		                    "abstractFields": {
		                        "fields": {
		                            "User": {
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
		                        "NodeDetails": {
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

		"HoudiniHash=3756d5c29fa6c05ef3636a9ccaf165e6f7800cc5d91d7faf40f51c8bb1a73f57";
	`)
})

test('fragment variables are embedded in artifact', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query MyAnimalQuery {
				node(id: "some_id") {
					id
					...NodeDetails @with(name: "Foo")

				}
			}
		`),
		mockCollectedDoc(`
			fragment NodeDetails on Node @arguments(name: { type: "String" }){
				... on User {
					field(filter: $name)
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "MyAnimalQuery",
		    "kind": "HoudiniQuery",
		    "hash": "4b37690e134a34ea1c717ee69ed60772d979a81120bfbed99b20a68e9c8ea738",

		    "raw": \`query MyAnimalQuery {
		  node(id: "some_id") {
		    id
		    ...NodeDetails_32RKor
		    __typename
		  }
		}

		fragment NodeDetails_32RKor on Node {
		  ... on User {
		    field(filter: "Foo")
		    id
		  }
		  id
		  __typename
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "node": {
		                "type": "Node",
		                "keyRaw": "node(id: \\"some_id\\")",
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
		                    },

		                    "abstractFields": {
		                        "fields": {
		                            "User": {
		                                "field": {
		                                    "type": "String",
		                                    "keyRaw": "field(filter: \\"Foo\\")",
		                                    "nullable": true
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
		                        "NodeDetails": {
		                            "arguments": {
		                                "name": {
		                                    "kind": "StringValue",
		                                    "value": "Foo"
		                                }
		                            }
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

		"HoudiniHash=444c42cc7214c06f0976b8a252e4f1c1fcba074d1afc1543acf0fc88f56e4f31";
	`)
})

test('fragment nested in root', async function () {
	// the config to use in tests
	const config = testConfig()
	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			fragment UserBase on User {
				id
				firstName
				...UserMore
			}
		`),
		mockCollectedDoc(`
			fragment UserMore on User {
				id
				firstName
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "UserBase",
		    "kind": "HoudiniFragment",
		    "hash": "15225d2e5cba866e1a588cd399a03d5b2124156ac7003d3510544f22b7b9262c",

		    "raw": \`fragment UserBase on User {
		  id
		  firstName
		  ...UserMore
		  __typename
		}

		fragment UserMore on User {
		  id
		  firstName
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

		            "firstName": {
		                "type": "String",
		                "keyRaw": "firstName",
		                "visible": true
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename",
		                "visible": true
		            }
		        },

		        "fragments": {
		            "UserMore": {
		                "arguments": {}
		            }
		        }
		    },

		    "pluginData": {}
		};

		"HoudiniHash=05ec5090d31f77c3f2bdcbd26aff116588f63d4b3789ae752759dd172974a628";
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

test('nested abstract fragment on connection', async function () {
	// the config to use in tests
	const config = testConfig()

	// the documents to test
	const docs: Document[] = [
		mockCollectedDoc(`
			query AnimalQuery {
				animals {
					pageInfo {
					  hasPreviousPage
					  hasNextPage
					  startCursor
					  endCursor
					}
					...MonkeyList
				}
			}
		`),
		mockCollectedDoc(`
			fragment MonkeyList on MonkeyConnection {
				edges {
					node {
						hasBanana
					}
				}
				...AnimalList
			}
		`),
		mockCollectedDoc(`
			fragment AnimalList on AnimalConnection {
				edges {
					node {
						id
						...AnimalProps
					}
				}
			}
		`),
		mockCollectedDoc(`
			fragment AnimalProps on Animal {
				name
			}
		`),
	]

	await runPipeline(config, docs)
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "AnimalQuery",
		    "kind": "HoudiniQuery",
		    "hash": "2f4654d4b23645ef3f39803cee2f770aea08e3b1716b5d4fa5efcbdf98a7ad08",

		    "raw": \`query AnimalQuery {
		  animals {
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		    ...MonkeyList
		    __typename
		  }
		}

		fragment MonkeyList on MonkeyConnection {
		  edges {
		    node {
		      hasBanana
		      id
		    }
		  }
		  ...AnimalList
		  __typename
		}

		fragment AnimalList on AnimalConnection {
		  edges {
		    node {
		      id
		      ...AnimalProps
		      __typename
		    }
		    __typename
		  }
		  __typename
		}

		fragment AnimalProps on Animal {
		  name
		  id
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
		                    "abstractFields": {
		                        "fields": {
		                            "MonkeyConnection": {
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
		                                                        "hasBanana": {
		                                                            "type": "Boolean",
		                                                            "keyRaw": "hasBanana"
		                                                        },

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
		                                                    },

		                                                    "fragments": {
		                                                        "AnimalProps": {
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

		                        "typeMap": {}
		                    },

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
		                                            "fields": {
		                                                "name": {
		                                                    "type": "String",
		                                                    "keyRaw": "name"
		                                                },

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
		                                                "AnimalProps": {
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
		                    },

		                    "fragments": {
		                        "MonkeyList": {
		                            "arguments": {}
		                        },

		                        "AnimalList": {
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

		"HoudiniHash=5ffbbc9f49c89384d57cfdc0eda0fe097d251b216c6958707226dfa1090c454f";
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
