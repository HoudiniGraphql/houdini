import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import { fs } from '../../../lib'
import { mockCollectedDoc, testConfig } from '../../../test'

const config = testConfig({
	schema: `
		type Query {
			user: User
			users: [User!]!
		}

		type User {
			id: ID!
			firstName: String!
			parent: User
		}
	`,
})

test('@loading on fragment - happy path', async function () {
	const docs = [
		mockCollectedDoc(`
			fragment UserBase on User {
				id
				firstName @loading
				parent @loading {
					id @loading
					parent @loading {
						id
					}
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const fragmentFileContents = await fs.readFile(config.artifactTypePath(docs[0].document))

	expect(
		recast.parse(fragmentFileContents!, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		import { LoadingType } from "$houdini/runtime/lib/types";
		export type UserBase$input = {};

		export type UserBase = {
		    readonly "shape"?: UserBase$data;
		    readonly " $fragments": {
		        "UserBase": any;
		    };
		};

		export type UserBase$data = {
		    readonly id: string;
		    readonly firstName: string;
		    readonly parent: {
		        readonly id: string;
		        readonly parent: {
		            readonly id: string;
		        } | null;
		    } | null;
		} | {
		    readonly firstName: LoadingType;
		    readonly parent: {
		        readonly id: LoadingType;
		        readonly parent: LoadingType;
		    };
		};

		export type UserBase$artifact = {
		    "name": "UserBase";
		    "kind": "HoudiniFragment";
		    "hash": "f3b27ed1e597b43045a4a70e3c163b01b4e73a9049714ae12cfe72f49356a3ca";
		    "raw": \`fragment UserBase on User {
		  id
		  firstName
		  parent {
		    id
		    parent {
		      id
		    }
		  }
		  __typename
		}
		\`;
		    "rootType": "User";
		    "stripVariables": [];
		    "selection": {
		        "fields": {
		            "id": {
		                "type": "ID";
		                "keyRaw": "id";
		                "visible": true;
		            };
		            "firstName": {
		                "type": "String";
		                "keyRaw": "firstName";
		                "directives": [{
		                    "name": "loading";
		                    "arguments": {};
		                }];
		                "loading": {
		                    "kind": "value";
		                };
		                "visible": true;
		            };
		            "parent": {
		                "type": "User";
		                "keyRaw": "parent";
		                "directives": [{
		                    "name": "loading";
		                    "arguments": {};
		                }];
		                "nullable": true;
		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID";
		                            "keyRaw": "id";
		                            "directives": [{
		                                "name": "loading";
		                                "arguments": {};
		                            }];
		                            "visible": true;
		                            "loading": {
		                                "kind": "value";
		                            };
		                        };
		                        "parent": {
		                            "type": "User";
		                            "keyRaw": "parent";
		                            "directives": [{
		                                "name": "loading";
		                                "arguments": {};
		                            }];
		                            "nullable": true;
		                            "selection": {
		                                "fields": {
		                                    "id": {
		                                        "type": "ID";
		                                        "keyRaw": "id";
		                                        "visible": true;
		                                    };
		                                };
		                            };
		                            "loading": {
		                                "kind": "value";
		                            };
		                            "visible": true;
		                        };
		                    };
		                };
		                "loading": {
		                    "kind": "continue";
		                };
		                "visible": true;
		            };
		            "__typename": {
		                "type": "String";
		                "keyRaw": "__typename";
		                "visible": true;
		            };
		        };
		    };
		    "pluginData": {};
		    "enableLoadingState": "local";
		};
	`)
})

test('@loading on query - happy path', async function () {
	const docs = [
		mockCollectedDoc(`
			query UserQuery {
				user @loading {
					firstName @loading
					parent @loading {
						id @loading
						parent @loading {
							id
						}
					}
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const fragmentFileContents = await fs.readFile(config.artifactTypePath(docs[0].document))

	expect(
		recast.parse(fragmentFileContents!, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		import { LoadingType } from "$houdini/runtime/lib/types";

		export type UserQuery = {
		    readonly "input": UserQuery$input;
		    readonly "result": UserQuery$result | undefined;
		};

		export type UserQuery$result = {
		    readonly user: {
		        readonly firstName: string;
		        readonly parent: {
		            readonly id: string;
		            readonly parent: {
		                readonly id: string;
		            } | null;
		        } | null;
		    } | null;
		} | {
		    readonly user: {
		        readonly firstName: LoadingType;
		        readonly parent: {
		            readonly id: LoadingType;
		            readonly parent: LoadingType;
		        };
		    };
		};

		export type UserQuery$input = null;

		export type UserQuery$artifact = {
		    "name": "UserQuery";
		    "kind": "HoudiniQuery";
		    "hash": "b006074a693174db5ac944de421fa6d91c93eecbd0182757b87f761a8f136d3e";
		    "raw": \`query UserQuery {
		  user {
		    firstName
		    parent {
		      id
		      parent {
		        id
		      }
		    }
		    id
		  }
		}
		\`;
		    "rootType": "Query";
		    "stripVariables": [];
		    "selection": {
		        "fields": {
		            "user": {
		                "type": "User";
		                "keyRaw": "user";
		                "directives": [{
		                    "name": "loading";
		                    "arguments": {};
		                }];
		                "nullable": true;
		                "selection": {
		                    "fields": {
		                        "firstName": {
		                            "type": "String";
		                            "keyRaw": "firstName";
		                            "directives": [{
		                                "name": "loading";
		                                "arguments": {};
		                            }];
		                            "loading": {
		                                "kind": "value";
		                            };
		                            "visible": true;
		                        };
		                        "parent": {
		                            "type": "User";
		                            "keyRaw": "parent";
		                            "directives": [{
		                                "name": "loading";
		                                "arguments": {};
		                            }];
		                            "nullable": true;
		                            "selection": {
		                                "fields": {
		                                    "id": {
		                                        "type": "ID";
		                                        "keyRaw": "id";
		                                        "directives": [{
		                                            "name": "loading";
		                                            "arguments": {};
		                                        }];
		                                        "visible": true;
		                                        "loading": {
		                                            "kind": "value";
		                                        };
		                                    };
		                                    "parent": {
		                                        "type": "User";
		                                        "keyRaw": "parent";
		                                        "directives": [{
		                                            "name": "loading";
		                                            "arguments": {};
		                                        }];
		                                        "nullable": true;
		                                        "selection": {
		                                            "fields": {
		                                                "id": {
		                                                    "type": "ID";
		                                                    "keyRaw": "id";
		                                                    "visible": true;
		                                                };
		                                            };
		                                        };
		                                        "loading": {
		                                            "kind": "value";
		                                        };
		                                        "visible": true;
		                                    };
		                                };
		                            };
		                            "loading": {
		                                "kind": "continue";
		                            };
		                            "visible": true;
		                        };
		                        "id": {
		                            "type": "ID";
		                            "keyRaw": "id";
		                            "visible": true;
		                        };
		                    };
		                };
		                "loading": {
		                    "kind": "continue";
		                };
		                "visible": true;
		            };
		        };
		    };
		    "pluginData": {};
		    "enableLoadingState": "local";
		    "policy": "CacheOrNetwork";
		    "partial": false;
		};
	`)
})

test('@loading on list', async function () {
	const docs = [
		mockCollectedDoc(`
			query UserQuery {
				users @loading {
					id
				}
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const fragmentFileContents = await fs.readFile(config.artifactTypePath(docs[0].document))

	expect(
		recast.parse(fragmentFileContents!, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		import { LoadingType } from "$houdini/runtime/lib/types";

		export type UserQuery = {
		    readonly "input": UserQuery$input;
		    readonly "result": UserQuery$result | undefined;
		};

		export type UserQuery$result = {
		    readonly users: ({
		        readonly id: string;
		    })[];
		} | {
		    readonly users: LoadingType[];
		};

		export type UserQuery$input = null;

		export type UserQuery$artifact = {
		    "name": "UserQuery";
		    "kind": "HoudiniQuery";
		    "hash": "bed2ad01e11cc58eae893e8866fc2e7c895e4f99f71a4b627989c0d983ec436e";
		    "raw": \`query UserQuery {
		  users {
		    id
		  }
		}
		\`;
		    "rootType": "Query";
		    "stripVariables": [];
		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User";
		                "keyRaw": "users";
		                "directives": [{
		                    "name": "loading";
		                    "arguments": {};
		                }];
		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID";
		                            "keyRaw": "id";
		                            "visible": true;
		                        };
		                    };
		                };
		                "loading": {
		                    "kind": "value";
		                    "list": {
		                        "depth": 1;
		                        "count": 3;
		                    };
		                };
		                "visible": true;
		            };
		        };
		    };
		    "pluginData": {};
		    "enableLoadingState": "local";
		    "policy": "CacheOrNetwork";
		    "partial": false;
		};
	`)
})

test('generated types include fragment loading state', async function () {
	const docs = [
		mockCollectedDoc(`
			query UserQuery {
				users @loading {
					...UserBase @loading
				}
			}
		`),
		mockCollectedDoc(`
			fragment UserBase on User {
				firstName
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const fragmentFileContents = await fs.readFile(config.artifactTypePath(docs[0].document))

	expect(
		recast.parse(fragmentFileContents!, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		import { LoadingType } from "$houdini/runtime/lib/types";

		export type UserQuery = {
		    readonly "input": UserQuery$input;
		    readonly "result": UserQuery$result | undefined;
		};

		export type UserQuery$result = {
		    readonly users: ({
		        readonly " $fragments": {
		            UserBase: {};
		        };
		    })[];
		} | {
		    readonly users: {
		        readonly " $fragments": {
		            UserBase: {};
		        };
		    }[];
		};

		export type UserQuery$input = null;

		export type UserQuery$artifact = {
		    "name": "UserQuery";
		    "kind": "HoudiniQuery";
		    "hash": "86082adf511d5a5985928ef1ca367422c3a9ce6d89e3c40f190635366c1e0cb7";
		    "raw": \`query UserQuery {
		  users {
		    ...UserBase
		    id
		  }
		}

		fragment UserBase on User {
		  firstName
		  id
		  __typename
		}
		\`;
		    "rootType": "Query";
		    "stripVariables": [];
		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User";
		                "keyRaw": "users";
		                "directives": [{
		                    "name": "loading";
		                    "arguments": {};
		                }];
		                "selection": {
		                    "fields": {
		                        "firstName": {
		                            "type": "String";
		                            "keyRaw": "firstName";
		                        };
		                        "id": {
		                            "type": "ID";
		                            "keyRaw": "id";
		                            "visible": true;
		                        };
		                        "__typename": {
		                            "type": "String";
		                            "keyRaw": "__typename";
		                        };
		                    };
		                    "fragments": {
		                        "UserBase": {
		                            "arguments": {};
		                            "loading": true;
		                        };
		                    };
		                };
		                "loading": {
		                    "kind": "continue";
		                    "list": {
		                        "depth": 1;
		                        "count": 3;
		                    };
		                };
		                "visible": true;
		            };
		        };
		    };
		    "pluginData": {};
		    "enableLoadingState": "local";
		    "policy": "CacheOrNetwork";
		    "partial": false;
		};
	`)
})

test('global @loading on fragment', async function () {
	const docs = [
		mockCollectedDoc(`
			query UserQuery @loading {
				users {
					...UserBase 
				}
			}
		`),
		mockCollectedDoc(`
			fragment UserBase on User {
				firstName
			}
		`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const queryContents = await fs.readFile(config.artifactTypePath(docs[0].document))

	expect(
		recast.parse(queryContents!, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		import { LoadingType } from "$houdini/runtime/lib/types";

		export type UserQuery = {
		    readonly "input": UserQuery$input;
		    readonly "result": UserQuery$result | undefined;
		};

		export type UserQuery$result = {
		    readonly users: ({
		        readonly " $fragments": {
		            UserBase: {};
		        };
		    })[];
		} | {
		    readonly users: {
		        readonly firstName: LoadingType;
		        readonly id: LoadingType;
		        readonly __typename: LoadingType;
		        readonly " $fragments": {
		            UserBase: {};
		        };
		    }[];
		};

		export type UserQuery$input = null;

		export type UserQuery$artifact = {
		    "name": "UserQuery";
		    "kind": "HoudiniQuery";
		    "hash": "86082adf511d5a5985928ef1ca367422c3a9ce6d89e3c40f190635366c1e0cb7";
		    "raw": \`query UserQuery {
		  users {
		    ...UserBase
		    id
		  }
		}

		fragment UserBase on User {
		  firstName
		  id
		  __typename
		}
		\`;
		    "rootType": "Query";
		    "stripVariables": [];
		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User";
		                "keyRaw": "users";
		                "selection": {
		                    "fields": {
		                        "firstName": {
		                            "type": "String";
		                            "keyRaw": "firstName";
		                            "loading": {
		                                "kind": "value";
		                            };
		                        };
		                        "id": {
		                            "type": "ID";
		                            "keyRaw": "id";
		                            "visible": true;
		                            "loading": {
		                                "kind": "value";
		                            };
		                        };
		                        "__typename": {
		                            "type": "String";
		                            "keyRaw": "__typename";
		                            "loading": {
		                                "kind": "value";
		                            };
		                        };
		                    };
		                    "fragments": {
		                        "UserBase": {
		                            "arguments": {};
		                            "loading": true;
		                        };
		                    };
		                };
		                "loading": {
		                    "kind": "continue";
		                    "list": {
		                        "depth": 1;
		                        "count": 3;
		                    };
		                };
		                "visible": true;
		            };
		        };
		    };
		    "pluginData": {};
		    "enableLoadingState": "global";
		    "policy": "CacheOrNetwork";
		    "partial": false;
		};
	`)
})
