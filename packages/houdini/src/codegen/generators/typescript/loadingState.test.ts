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
		    "hash": "816b288a1c0d7aebceb496f0b6dd5177dc3509d3b3ad220ddd99ed73fca6b7b9";
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
		    "enableLoadingState": true;
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
		    "hash": "251fe62c21d1e54da09c7f58540ba37ac3b6734faedc4758a133b21605afb7d6";
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
		    "enableLoadingState": true;
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
		    "hash": "cb4e1e2d8139730eea3407cecd6f2af01d55ced6376c72dd038cc3a084d08eae";
		    "raw": \`query UserQuery {
		  users {
		    id
		  }
		}
		\`;
		    "rootType": "Query";
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
		    "enableLoadingState": true;
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
		    "hash": "67d2da76e8db669876d7cdb832336d5dcfed3c4964ab8baabd2763dfb68c58e8";
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
		    "enableLoadingState": true;
		    "policy": "CacheOrNetwork";
		    "partial": false;
		};
	`)
})
