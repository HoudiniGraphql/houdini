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
		    readonly id: string | number;
		    readonly firstName: string;
		    readonly parent: {
		        readonly id: string | number;
		        readonly parent: {
		            readonly id: string | number;
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
		    "hash": "804efdc961c91ee475e10e36885000037cb849e9fa03bd5835677138c61cc23c";
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
		}\`;
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
		            readonly id: string | number;
		            readonly parent: {
		                readonly id: string | number;
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
		    "hash": "76caf0974dc9624ef6e86259654ec1b89ac5a43a57585d53fe475216566f1a51";
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
		}\`;
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
		        readonly id: string | number;
		    })[];
		} | {
		    readonly users: LoadingType[];
		};

		export type UserQuery$input = null;

		export type UserQuery$artifact = {
		    "name": "UserQuery";
		    "kind": "HoudiniQuery";
		    "hash": "b32722ef3875fa6a5913b1244198df6ccc0155c978b7af5e4fe850ce156382e3";
		    "raw": \`query UserQuery {
		  users {
		    id
		  }
		}\`;
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
		    "hash": "3ae38ce5b89395aa599412acd9aa84e16942ee4c4c9439705423fed0eca564cd";
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
		}\`;
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
		    "hash": "3ae38ce5b89395aa599412acd9aa84e16942ee4c4c9439705423fed0eca564cd";
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
		}\`;
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
