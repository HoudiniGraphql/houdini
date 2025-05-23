import { parseJS, fs, path } from 'houdini'
import { testConfig } from 'houdini/test'
import { test, expect } from 'vitest'

import generate from '..'
import { type_route_dir } from '../../storeConfig'

const config = testConfig()
const pluginRoot = config.pluginDirectory('test-plugin')

const default_layout_types = `import type * as Kit from '@sveltejs/kit';

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type RouteParams = {  }
type MaybeWithVoid<T> = {} extends T ? T | void : T;
export type RequiredKeys<T> = { [K in keyof T]-?: {} extends { [P in K]: T[K] } ? never : K; }[keyof T];
type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>
type EnsureDefined<T> = T extends null | undefined ? {} : T;
type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? { [P in Exclude<A, keyof U>]?: never } & U : never;
type LayoutParams = RouteParams & {  }
type LayoutParentData = EnsureDefined<{}>;

export type LayoutServerData = null;
export type LayoutLoad<OutputData extends OutputDataShape<LayoutParentData> = OutputDataShape<LayoutParentData>> = Kit.Load<LayoutParams, LayoutServerData, LayoutParentData, OutputData>;
export type LayoutLoadEvent = Parameters<LayoutLoad>[0];
export type LayoutData = Expand<Omit<LayoutParentData, keyof LayoutParentData & EnsureDefined<LayoutServerData>> & OptionalUnion<EnsureDefined<LayoutParentData & EnsureDefined<LayoutServerData>>>>;
`
const default_page_types = `import type * as Kit from '@sveltejs/kit';

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type RouteParams = {  }
type MaybeWithVoid<T> = {} extends T ? T | void : T;
export type RequiredKeys<T> = { [K in keyof T]-?: {} extends { [P in K]: T[K] } ? never : K; }[keyof T];
type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>
type EnsureDefined<T> = T extends null | undefined ? {} : T;
type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? { [P in Exclude<A, keyof U>]?: never } & U : never;
type PageParentData = EnsureDefined<import('../$types.js').LayoutData>;

export type PageServerData = null;
export type PageLoad<OutputData extends OutputDataShape<PageParentData> = OutputDataShape<PageParentData>> = Kit.Load<RouteParams, PageServerData, PageParentData, OutputData>;
export type PageLoadEvent = Parameters<PageLoad>[0];
export type PageData = Expand<Omit<PageParentData, keyof PageParentData & EnsureDefined<PageServerData>> & OptionalUnion<EnsureDefined<PageParentData & EnsureDefined<PageServerData>>>>;
`

test('generates types for inline layout queries', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+layout.svelte': `
<script>
    import { query, graphql } from '$houdini'

    const result = query(graphql\`query MyInlineQuery { viewer { id } } \`)
</script>
`,
			},
		},
	})

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': default_layout_types,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', pluginRoot })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts'))
	)

	expect(queryContents).toBeTruthy()

	//the parser doesn't work right but the type imports are correct.
	const parsedQuery = await parseJS(queryContents!)

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import { MyInlineQuery$result, MyInlineQuery$input } from "../../../../artifacts/MyInlineQuery";
		import { MyInlineQueryStore } from "../../../../plugins/houdini-svelte/stores/MyInlineQuery";

		type Expand<T> = T extends infer O ? {
		    [K in keyof O]: O[K];
		} : never;

		type RouteParams = {};
		type MaybeWithVoid<T> = {} extends T ? T | void : T;

		export type RequiredKeys<T> = {
		    [K in keyof T]?: {} extends {
		        [P in K]: T[K];
		    } ? never : K;
		}[keyof T];

		type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>;
		type EnsureDefined<T> = T extends null | undefined ? {} : T;

		type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? {
		    [P in Exclude<A, keyof U>]?: never;
		} & U : never;

		type LayoutParams = RouteParams & {};
		type LayoutParentData = EnsureDefined<{}>;

		type MakeOptional<Target, Keys extends keyof Target> = Omit<Target, Keys> & {
		    [Key in Keys]?: Target[Key] | undefined | null;
		};

		export type LayoutServerData = null;
		export type LayoutLoad<OutputData extends OutputDataShape<LayoutParentData> = OutputDataShape<LayoutParentData>> = Kit.Load<LayoutParams, LayoutServerData, LayoutParentData, OutputData>;
		export type LayoutLoadEvent = Parameters<LayoutLoad>[0];

		export type LayoutData = Expand<Expand<Omit<LayoutParentData, keyof LayoutParentData & EnsureDefined<LayoutServerData>> & OptionalUnion<EnsureDefined<LayoutParentData & EnsureDefined<LayoutServerData>>>> & {
		    MyInlineQuery: MyInlineQueryStore;
		}>;
	`)
})

test('generates types for inline page queries', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+page.svelte': `
<script>
    import { query, graphql } from '$houdini'

    const result = query(graphql\`query MyInlineQuery { viewer { id } } \`)
</script>
`,
			},
		},
	})

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': default_page_types,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', pluginRoot })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts'))
	)

	expect(queryContents).toBeTruthy()

	//the parser doesn't work right but the type imports are correct.
	const parsedQuery = await parseJS(queryContents!)

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import { MyInlineQuery$result, MyInlineQuery$input } from "../../../../artifacts/MyInlineQuery";
		import { MyInlineQueryStore } from "../../../../plugins/houdini-svelte/stores/MyInlineQuery";

		type Expand<T> = T extends infer O ? {
		    [K in keyof O]: O[K];
		} : never;

		type RouteParams = {};
		type MaybeWithVoid<T> = {} extends T ? T | void : T;

		export type RequiredKeys<T> = {
		    [K in keyof T]?: {} extends {
		        [P in K]: T[K];
		    } ? never : K;
		}[keyof T];

		type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>;
		type EnsureDefined<T> = T extends null | undefined ? {} : T;

		type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? {
		    [P in Exclude<A, keyof U>]?: never;
		} & U : never;

		type PageParentData = EnsureDefined<import("../$houdini").LayoutData>;

		type MakeOptional<Target, Keys extends keyof Target> = Omit<Target, Keys> & {
		    [Key in Keys]?: Target[Key] | undefined | null;
		};

		export type PageServerData = null;
		export type PageLoad<OutputData extends OutputDataShape<PageParentData> = OutputDataShape<PageParentData>> = Kit.Load<RouteParams, PageServerData, PageParentData, OutputData>;
		export type PageLoadEvent = Parameters<PageLoad>[0];

		export type PageData = Expand<Expand<Omit<PageParentData, keyof PageParentData & EnsureDefined<PageServerData>> & OptionalUnion<EnsureDefined<PageParentData & EnsureDefined<PageServerData>>>> & {
		    MyInlineQuery: MyInlineQueryStore;
		}>;
	`)
})

test('generates types for layout queries', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+layout.gql': `
query MyLayoutQuery {
    viewer {
        id
    }
}
`,
			},
		},
	})

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': default_layout_types,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', pluginRoot })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts'))
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = await parseJS(queryContents!)
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import { MyLayoutQuery$result, MyLayoutQuery$input } from "../../../../artifacts/MyLayoutQuery";
		import { MyLayoutQueryStore } from "../../../../plugins/houdini-svelte/stores/MyLayoutQuery";

		type Expand<T> = T extends infer O ? {
		    [K in keyof O]: O[K];
		} : never;

		type RouteParams = {};
		type MaybeWithVoid<T> = {} extends T ? T | void : T;

		export type RequiredKeys<T> = {
		    [K in keyof T]?: {} extends {
		        [P in K]: T[K];
		    } ? never : K;
		}[keyof T];

		type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>;
		type EnsureDefined<T> = T extends null | undefined ? {} : T;

		type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? {
		    [P in Exclude<A, keyof U>]?: never;
		} & U : never;

		type LayoutParams = RouteParams & {};
		type LayoutParentData = EnsureDefined<{}>;

		type MakeOptional<Target, Keys extends keyof Target> = Omit<Target, Keys> & {
		    [Key in Keys]?: Target[Key] | undefined | null;
		};

		export type LayoutServerData = null;
		export type LayoutLoad<OutputData extends OutputDataShape<LayoutParentData> = OutputDataShape<LayoutParentData>> = Kit.Load<LayoutParams, LayoutServerData, LayoutParentData, OutputData>;
		export type LayoutLoadEvent = Parameters<LayoutLoad>[0];

		export type LayoutData = Expand<Expand<Omit<LayoutParentData, keyof LayoutParentData & EnsureDefined<LayoutServerData>> & OptionalUnion<EnsureDefined<LayoutParentData & EnsureDefined<LayoutServerData>>>> & {
		    MyLayoutQuery: MyLayoutQueryStore;
		}>;
	`)
})

test('generates types for page queries', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+page.gql': `
query MyPageQuery {
    viewer {
        id
    }
}
`,
			},
		},
	})

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': default_page_types,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', pluginRoot })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts'))
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = await parseJS(queryContents!)

	//verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import { MyPageQuery$result, MyPageQuery$input } from "../../../../artifacts/MyPageQuery";
		import { MyPageQueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageQuery";

		type Expand<T> = T extends infer O ? {
		    [K in keyof O]: O[K];
		} : never;

		type RouteParams = {};
		type MaybeWithVoid<T> = {} extends T ? T | void : T;

		export type RequiredKeys<T> = {
		    [K in keyof T]?: {} extends {
		        [P in K]: T[K];
		    } ? never : K;
		}[keyof T];

		type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>;
		type EnsureDefined<T> = T extends null | undefined ? {} : T;

		type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? {
		    [P in Exclude<A, keyof U>]?: never;
		} & U : never;

		type PageParentData = EnsureDefined<import("../$houdini").LayoutData>;

		type MakeOptional<Target, Keys extends keyof Target> = Omit<Target, Keys> & {
		    [Key in Keys]?: Target[Key] | undefined | null;
		};

		export type PageServerData = null;
		export type PageLoad<OutputData extends OutputDataShape<PageParentData> = OutputDataShape<PageParentData>> = Kit.Load<RouteParams, PageServerData, PageParentData, OutputData>;
		export type PageLoadEvent = Parameters<PageLoad>[0];

		export type PageData = Expand<Expand<Omit<PageParentData, keyof PageParentData & EnsureDefined<PageServerData>> & OptionalUnion<EnsureDefined<PageParentData & EnsureDefined<PageServerData>>>> & {
		    MyPageQuery: MyPageQueryStore;
		}>;
	`)
})

test('generates types for component queries defined in a route', async function () {
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'UserCard.svelte': `
<script lang="ts">
	import { graphql } from '$houdini';
	import type { UserCardVariables } from './$houdini';

	export let id: string;

	export const _UserCardVariables: UserCardVariables = ({ props }) => {
		return {
			userId: props.id
		};
	};

	$: data = graphql(\`
		query UserCard($userId: ID!) {
			user(id: $userId, snapshot: "UserCard") {
				name
			}
		}
	\`);
</script>
`,
				'+page.svelte': `
<script lang="ts">
	import UserCard from './UserCard.svelte';
</script>

<UserCard id="1" />
`,
			},
		},
	})

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': default_page_types,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', pluginRoot })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts'))
	)

	expect(queryContents).toBeTruthy()

	const parsedQuery = await parseJS(queryContents!)

	//verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { ComponentProps } from "svelte";
		import UserCard from "./UserCard.svelte";
		import type { UserCard$input } from "../../../artifacts/UserCard";

		type Expand<T> = T extends infer O ? {
		    [K in keyof O]: O[K];
		} : never;

		type RouteParams = {};
		type MaybeWithVoid<T> = {} extends T ? T | void : T;

		export type RequiredKeys<T> = {
		    [K in keyof T]?: {} extends {
		        [P in K]: T[K];
		    } ? never : K;
		}[keyof T];

		type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>;
		type EnsureDefined<T> = T extends null | undefined ? {} : T;

		type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? {
		    [P in Exclude<A, keyof U>]?: never;
		} & U : never;

		type PageParentData = EnsureDefined<import("../$houdini").LayoutData>;

		type MakeOptional<Target, Keys extends keyof Target> = Omit<Target, Keys> & {
		    [Key in Keys]?: Target[Key] | undefined | null;
		};

		export type PageServerData = null;
		export type PageLoad<OutputData extends OutputDataShape<PageParentData> = OutputDataShape<PageParentData>> = Kit.Load<RouteParams, PageServerData, PageParentData, OutputData>;
		export type PageLoadEvent = Parameters<PageLoad>[0];
		export type PageData = Expand<Expand<Omit<PageParentData, keyof PageParentData & EnsureDefined<PageServerData>> & OptionalUnion<EnsureDefined<PageParentData & EnsureDefined<PageServerData>>>> & {}>;
		type UserCardProps = ComponentProps<UserCard>;

		export type UserCardVariables = <_Props extends UserCardProps>(
		    args: {
		        props: _Props;
		    }
		) => UserCard$input;
	`)
})

test('generates types for layout onError', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+layout.js': `
                    import { graphql } from '$houdini'

                    const store1 = graphql\`query MyPageLoad1Query($id: ID!) {
                        viewer(id: $id) {
                            id
                        }
                    }\`

                    const store2 = graphql\`query MyPageLoad2Query {
                        viewer {
                            id
                        }
                    }\`

                    export const _houdini_load = [ store1, store2 ]

                    export function _houdini_onError() {
                        return {
                            hello: 'world'
                        }
                    }
                `,
			},
		},
	})

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': default_layout_types,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', pluginRoot })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts'))
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = await parseJS(queryContents!)
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction } from "../../../../plugins/houdini-svelte/runtime/types";
		import { MyPageLoad1Query$result, MyPageLoad1Query$input } from "../../../../artifacts/MyPageLoad1Query";
		import { MyPageLoad1QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad1Query";
		import { MyPageLoad2Query$result, MyPageLoad2Query$input } from "../../../../artifacts/MyPageLoad2Query";
		import { MyPageLoad2QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad2Query";

		type Expand<T> = T extends infer O ? {
		    [K in keyof O]: O[K];
		} : never;

		type RouteParams = {};
		type MaybeWithVoid<T> = {} extends T ? T | void : T;

		export type RequiredKeys<T> = {
		    [K in keyof T]?: {} extends {
		        [P in K]: T[K];
		    } ? never : K;
		}[keyof T];

		type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>;
		type EnsureDefined<T> = T extends null | undefined ? {} : T;

		type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? {
		    [P in Exclude<A, keyof U>]?: never;
		} & U : never;

		type LayoutParams = RouteParams & {};
		type LayoutParentData = EnsureDefined<{}>;

		type MakeOptional<Target, Keys extends keyof Target> = Omit<Target, Keys> & {
		    [Key in Keys]?: Target[Key] | undefined | null;
		};

		export type LayoutServerData = null;
		export type LayoutLoad<OutputData extends OutputDataShape<LayoutParentData> = OutputDataShape<LayoutParentData>> = Kit.Load<LayoutParams, LayoutServerData, LayoutParentData, OutputData>;
		export type LayoutLoadEvent = Parameters<LayoutLoad>[0];

		export type LayoutData = Expand<Expand<Omit<LayoutParentData, keyof LayoutParentData & EnsureDefined<LayoutServerData>> & OptionalUnion<EnsureDefined<LayoutParentData & EnsureDefined<LayoutServerData>>>> & {
		    MyPageLoad1Query: MyPageLoad1QueryStore;
		    MyPageLoad2Query: MyPageLoad2QueryStore;
		} & OnErrorReturn>;

		type LoadInput = {
		    MyPageLoad1Query: MyPageLoad1Query$input;
		};

		type OnErrorReturn = Awaited<ReturnType<typeof import("./+layout")._houdini_onError>>;

		export type OnErrorEvent = {
		    event: Kit.LoadEvent;
		    input: LoadInput;
		    error: Kit.HttpError;
		};

		export type MyPageLoad1QueryVariables = VariableFunction<LayoutLoadEvent, MyPageLoad1Query$input>;
	`)
})

test('generates types for page onError', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+page.js': `
                    import { graphql } from '$houdini'

                    const store1 = graphql\`query MyPageLoad1Query($id: ID!) {
                        viewer(id: $id) {
                            id
                        }
                    }\`

                    const store2 = graphql\`query MyPageLoad2Query {
                        viewer {
                            id
                        }
                    }\`

                    export const _houdini_load = [ store1, store2 ]

                    export function _houdini_onError() {
                        return {
                            hello: 'world'
                        }
                    }
                `,
			},
		},
	})

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': default_page_types,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', pluginRoot })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts')
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = await parseJS(queryContents!)

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction } from "../../../../plugins/houdini-svelte/runtime/types";
		import { MyPageLoad1Query$result, MyPageLoad1Query$input } from "../../../../artifacts/MyPageLoad1Query";
		import { MyPageLoad1QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad1Query";
		import { MyPageLoad2Query$result, MyPageLoad2Query$input } from "../../../../artifacts/MyPageLoad2Query";
		import { MyPageLoad2QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad2Query";

		type Expand<T> = T extends infer O ? {
		    [K in keyof O]: O[K];
		} : never;

		type RouteParams = {};
		type MaybeWithVoid<T> = {} extends T ? T | void : T;

		export type RequiredKeys<T> = {
		    [K in keyof T]?: {} extends {
		        [P in K]: T[K];
		    } ? never : K;
		}[keyof T];

		type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>;
		type EnsureDefined<T> = T extends null | undefined ? {} : T;

		type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? {
		    [P in Exclude<A, keyof U>]?: never;
		} & U : never;

		type PageParentData = EnsureDefined<import("../$houdini").LayoutData>;

		type MakeOptional<Target, Keys extends keyof Target> = Omit<Target, Keys> & {
		    [Key in Keys]?: Target[Key] | undefined | null;
		};

		export type PageServerData = null;
		export type PageLoad<OutputData extends OutputDataShape<PageParentData> = OutputDataShape<PageParentData>> = Kit.Load<RouteParams, PageServerData, PageParentData, OutputData>;
		export type PageLoadEvent = Parameters<PageLoad>[0];

		export type PageData = Expand<Expand<Omit<PageParentData, keyof PageParentData & EnsureDefined<PageServerData>> & OptionalUnion<EnsureDefined<PageParentData & EnsureDefined<PageServerData>>>> & {
		    MyPageLoad1Query: MyPageLoad1QueryStore;
		    MyPageLoad2Query: MyPageLoad2QueryStore;
		} & OnErrorReturn>;

		type LoadInput = {
		    MyPageLoad1Query: MyPageLoad1Query$input;
		};

		type OnErrorReturn = Awaited<ReturnType<typeof import("./+page")._houdini_onError>>;

		export type OnErrorEvent = {
		    event: Kit.LoadEvent;
		    input: LoadInput;
		    error: Kit.HttpError;
		};

		export type MyPageLoad1QueryVariables = VariableFunction<PageLoadEvent, MyPageLoad1Query$input>;
	`)
})

test('generates types for layout beforeLoad', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+layout.js': `
                    import { graphql } from '$houdini'

                    const store1 = graphql\`query MyPageLoad1Query($id: ID!) {
                        viewer(id: $id) {
                            id
                        }
                    }\`

                    const store2 = graphql\`query MyPageLoad2Query {
                        viewer {
                            id
                        }
                    }\`

                    export const _houdini_load = [ store1, store2 ]

                    export function _houdini_beforeLoad() {
                        return {
                            hello: 'world'
                        }
                    }
                `,
			},
		},
	})

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': default_layout_types,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', pluginRoot })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts')
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = await parseJS(queryContents!)

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, BeforeLoadFunction } from "../../../../plugins/houdini-svelte/runtime/types";
		import { MyPageLoad1Query$result, MyPageLoad1Query$input } from "../../../../artifacts/MyPageLoad1Query";
		import { MyPageLoad1QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad1Query";
		import { MyPageLoad2Query$result, MyPageLoad2Query$input } from "../../../../artifacts/MyPageLoad2Query";
		import { MyPageLoad2QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad2Query";

		type Expand<T> = T extends infer O ? {
		    [K in keyof O]: O[K];
		} : never;

		type RouteParams = {};
		type MaybeWithVoid<T> = {} extends T ? T | void : T;

		export type RequiredKeys<T> = {
		    [K in keyof T]?: {} extends {
		        [P in K]: T[K];
		    } ? never : K;
		}[keyof T];

		type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>;
		type EnsureDefined<T> = T extends null | undefined ? {} : T;

		type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? {
		    [P in Exclude<A, keyof U>]?: never;
		} & U : never;

		type LayoutParams = RouteParams & {};
		type LayoutParentData = EnsureDefined<{}>;

		type MakeOptional<Target, Keys extends keyof Target> = Omit<Target, Keys> & {
		    [Key in Keys]?: Target[Key] | undefined | null;
		};

		export type LayoutServerData = null;
		export type LayoutLoad<OutputData extends OutputDataShape<LayoutParentData> = OutputDataShape<LayoutParentData>> = Kit.Load<LayoutParams, LayoutServerData, LayoutParentData, OutputData>;
		export type LayoutLoadEvent = Parameters<LayoutLoad>[0];

		export type LayoutData = Expand<Expand<Omit<LayoutParentData, keyof LayoutParentData & EnsureDefined<LayoutServerData>> & OptionalUnion<EnsureDefined<LayoutParentData & EnsureDefined<LayoutServerData>>>> & {
		    MyPageLoad1Query: MyPageLoad1QueryStore;
		    MyPageLoad2Query: MyPageLoad2QueryStore;
		} & BeforeLoadReturn>;

		type LoadInput = {
		    MyPageLoad1Query: MyPageLoad1Query$input;
		};

		export type BeforeLoadEvent = LayoutLoadEvent;
		type BeforeLoadReturn = Awaited<ReturnType<typeof import("./+layout")._houdini_beforeLoad>>;
		export type MyPageLoad1QueryVariables = VariableFunction<LayoutLoadEvent, MyPageLoad1Query$input>;
	`)
})

test('generates types for page beforeLoad', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+page.js': `
                    import { graphql } from '$houdini'

                    const store1 = graphql\`query MyPageLoad1Query($id: ID!) {
                        viewer(id: $id) {
                            id
                        }
                    }\`

                    const store2 = graphql\`query MyPageLoad2Query {
                        viewer {
                            id
                        }
                    }\`

                    export const _houdini_load = [ store1, store2 ]

                    export function _houdini_beforeLoad() {
                        return {
                            hello: 'world'
                        }
                    }
                `,
			},
		},
	})

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': default_page_types,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', pluginRoot })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts')
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = await parseJS(queryContents!)

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, BeforeLoadFunction } from "../../../../plugins/houdini-svelte/runtime/types";
		import { MyPageLoad1Query$result, MyPageLoad1Query$input } from "../../../../artifacts/MyPageLoad1Query";
		import { MyPageLoad1QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad1Query";
		import { MyPageLoad2Query$result, MyPageLoad2Query$input } from "../../../../artifacts/MyPageLoad2Query";
		import { MyPageLoad2QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad2Query";

		type Expand<T> = T extends infer O ? {
		    [K in keyof O]: O[K];
		} : never;

		type RouteParams = {};
		type MaybeWithVoid<T> = {} extends T ? T | void : T;

		export type RequiredKeys<T> = {
		    [K in keyof T]?: {} extends {
		        [P in K]: T[K];
		    } ? never : K;
		}[keyof T];

		type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>;
		type EnsureDefined<T> = T extends null | undefined ? {} : T;

		type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? {
		    [P in Exclude<A, keyof U>]?: never;
		} & U : never;

		type PageParentData = EnsureDefined<import("../$houdini").LayoutData>;

		type MakeOptional<Target, Keys extends keyof Target> = Omit<Target, Keys> & {
		    [Key in Keys]?: Target[Key] | undefined | null;
		};

		export type PageServerData = null;
		export type PageLoad<OutputData extends OutputDataShape<PageParentData> = OutputDataShape<PageParentData>> = Kit.Load<RouteParams, PageServerData, PageParentData, OutputData>;
		export type PageLoadEvent = Parameters<PageLoad>[0];

		export type PageData = Expand<Expand<Omit<PageParentData, keyof PageParentData & EnsureDefined<PageServerData>> & OptionalUnion<EnsureDefined<PageParentData & EnsureDefined<PageServerData>>>> & {
		    MyPageLoad1Query: MyPageLoad1QueryStore;
		    MyPageLoad2Query: MyPageLoad2QueryStore;
		} & BeforeLoadReturn>;

		type LoadInput = {
		    MyPageLoad1Query: MyPageLoad1Query$input;
		};

		export type BeforeLoadEvent = PageLoadEvent;
		type BeforeLoadReturn = Awaited<ReturnType<typeof import("./+page")._houdini_beforeLoad>>;
		export type MyPageLoad1QueryVariables = VariableFunction<PageLoadEvent, MyPageLoad1Query$input>;
	`)
})

test('generates types for layout afterLoad', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+layout.js': `
                    import { graphql } from '$houdini'

                    const store1 = graphql\`query MyPageLoad1Query($id: ID!) {
                        viewer(id: $id) {
                            id
                        }
                    }\`

                    const store2 = graphql\`query MyPageLoad2Query {
                        viewer {
                            id
                        }
                    }\`

                    export const _houdini_load = [ store1, store2 ]

                    export function _houdini_afterLoad(event) {
                        return {
                            hello: 'world'
                        }
                    }
                `,
			},
		},
	})

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': default_layout_types,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', pluginRoot })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts')
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = await parseJS(queryContents!)

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, AfterLoadFunction } from "../../../../plugins/houdini-svelte/runtime/types";
		import { MyPageLoad1Query$result, MyPageLoad1Query$input } from "../../../../artifacts/MyPageLoad1Query";
		import { MyPageLoad1QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad1Query";
		import { MyPageLoad2Query$result, MyPageLoad2Query$input } from "../../../../artifacts/MyPageLoad2Query";
		import { MyPageLoad2QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad2Query";

		type Expand<T> = T extends infer O ? {
		    [K in keyof O]: O[K];
		} : never;

		type RouteParams = {};
		type MaybeWithVoid<T> = {} extends T ? T | void : T;

		export type RequiredKeys<T> = {
		    [K in keyof T]?: {} extends {
		        [P in K]: T[K];
		    } ? never : K;
		}[keyof T];

		type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>;
		type EnsureDefined<T> = T extends null | undefined ? {} : T;

		type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? {
		    [P in Exclude<A, keyof U>]?: never;
		} & U : never;

		type LayoutParams = RouteParams & {};
		type LayoutParentData = EnsureDefined<{}>;

		type MakeOptional<Target, Keys extends keyof Target> = Omit<Target, Keys> & {
		    [Key in Keys]?: Target[Key] | undefined | null;
		};

		export type LayoutServerData = null;
		export type LayoutLoad<OutputData extends OutputDataShape<LayoutParentData> = OutputDataShape<LayoutParentData>> = Kit.Load<LayoutParams, LayoutServerData, LayoutParentData, OutputData>;
		export type LayoutLoadEvent = Parameters<LayoutLoad>[0];

		export type LayoutData = Expand<Expand<Omit<LayoutParentData, keyof LayoutParentData & EnsureDefined<LayoutServerData>> & OptionalUnion<EnsureDefined<LayoutParentData & EnsureDefined<LayoutServerData>>>> & {
		    MyPageLoad1Query: MyPageLoad1QueryStore;
		    MyPageLoad2Query: MyPageLoad2QueryStore;
		} & AfterLoadReturn>;

		type LoadInput = {
		    MyPageLoad1Query: MyPageLoad1Query$input;
		};

		type AfterLoadReturn = Awaited<ReturnType<typeof import("./+layout")._houdini_afterLoad>>;

		type AfterLoadData = {
		    MyPageLoad1Query: MyPageLoad1Query$result;
		    MyPageLoad2Query: MyPageLoad2Query$result;
		};

		export type AfterLoadEvent = {
		    event: LayoutLoadEvent;
		    data: AfterLoadData;
		    input: LoadInput;
		};

		export type MyPageLoad1QueryVariables = VariableFunction<LayoutLoadEvent, MyPageLoad1Query$input>;
	`)
})

test('generates types for page afterLoad', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+page.js': `
                    import { graphql } from '$houdini'

                    const store1 = graphql\`query MyPageLoad1Query($id: ID!) {
                        viewer(id: $id) {
                            id
                        }
                    }\`

                    const store2 = graphql\`query MyPageLoad2Query {
                        viewer {
                            id
                        }
                    }\`

                    export const _houdini_load = [ store1, store2 ]

                    export function _houdini_afterLoad(event) {
                        return {
                            hello: 'world'
                        }
                    }
                `,
			},
		},
	})

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': default_page_types,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', pluginRoot })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts')
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = await parseJS(queryContents!)

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, AfterLoadFunction } from "../../../../plugins/houdini-svelte/runtime/types";
		import { MyPageLoad1Query$result, MyPageLoad1Query$input } from "../../../../artifacts/MyPageLoad1Query";
		import { MyPageLoad1QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad1Query";
		import { MyPageLoad2Query$result, MyPageLoad2Query$input } from "../../../../artifacts/MyPageLoad2Query";
		import { MyPageLoad2QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad2Query";

		type Expand<T> = T extends infer O ? {
		    [K in keyof O]: O[K];
		} : never;

		type RouteParams = {};
		type MaybeWithVoid<T> = {} extends T ? T | void : T;

		export type RequiredKeys<T> = {
		    [K in keyof T]?: {} extends {
		        [P in K]: T[K];
		    } ? never : K;
		}[keyof T];

		type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>;
		type EnsureDefined<T> = T extends null | undefined ? {} : T;

		type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? {
		    [P in Exclude<A, keyof U>]?: never;
		} & U : never;

		type PageParentData = EnsureDefined<import("../$houdini").LayoutData>;

		type MakeOptional<Target, Keys extends keyof Target> = Omit<Target, Keys> & {
		    [Key in Keys]?: Target[Key] | undefined | null;
		};

		export type PageServerData = null;
		export type PageLoad<OutputData extends OutputDataShape<PageParentData> = OutputDataShape<PageParentData>> = Kit.Load<RouteParams, PageServerData, PageParentData, OutputData>;
		export type PageLoadEvent = Parameters<PageLoad>[0];

		export type PageData = Expand<Expand<Omit<PageParentData, keyof PageParentData & EnsureDefined<PageServerData>> & OptionalUnion<EnsureDefined<PageParentData & EnsureDefined<PageServerData>>>> & {
		    MyPageLoad1Query: MyPageLoad1QueryStore;
		    MyPageLoad2Query: MyPageLoad2QueryStore;
		} & AfterLoadReturn>;

		type LoadInput = {
		    MyPageLoad1Query: MyPageLoad1Query$input;
		};

		type AfterLoadReturn = Awaited<ReturnType<typeof import("./+page")._houdini_afterLoad>>;

		type AfterLoadData = {
		    MyPageLoad1Query: MyPageLoad1Query$result;
		    MyPageLoad2Query: MyPageLoad2Query$result;
		};

		export type AfterLoadEvent = {
		    event: PageLoadEvent;
		    data: AfterLoadData;
		    input: LoadInput;
		};

		export type MyPageLoad1QueryVariables = VariableFunction<PageLoadEvent, MyPageLoad1Query$input>;
	`)
})

test('Marks required query arguments as optional if the url param provides it', async function () {
	// create the mock filesystem
	await fs.mock({
		[path.join(config.routesDir, '[userID]', '+layout.js')]: `
			import { graphql } from '$houdini'

			export const _houdini_load = graphql\`query MyPageLoad1Query($userID: ID!) {
				viewer(id: $userID) {
					id
				}
			}\`
		`,
	})

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						'[userID]': {
							'$types.d.ts': default_layout_types,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', pluginRoot })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(type_route_dir(config), '[userID]', '$houdini.d.ts')
	)
	expect(queryContents).toBeTruthy()
	const parsedQuery = await parseJS(queryContents!)

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction } from "../../../../plugins/houdini-svelte/runtime/types";
		import { MyPageLoad1Query$result, MyPageLoad1Query$input } from "../../../../artifacts/MyPageLoad1Query";
		import { MyPageLoad1QueryStore } from "../../../../plugins/houdini-svelte/stores/MyPageLoad1Query";

		type Expand<T> = T extends infer O ? {
		    [K in keyof O]: O[K];
		} : never;

		type RouteParams = {};
		type MaybeWithVoid<T> = {} extends T ? T | void : T;

		export type RequiredKeys<T> = {
		    [K in keyof T]?: {} extends {
		        [P in K]: T[K];
		    } ? never : K;
		}[keyof T];

		type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>;
		type EnsureDefined<T> = T extends null | undefined ? {} : T;

		type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? {
		    [P in Exclude<A, keyof U>]?: never;
		} & U : never;

		type LayoutParams = RouteParams & {};
		type LayoutParentData = EnsureDefined<{}>;

		type MakeOptional<Target, Keys extends keyof Target> = Omit<Target, Keys> & {
		    [Key in Keys]?: Target[Key] | undefined | null;
		};

		export type LayoutServerData = null;
		export type LayoutLoad<OutputData extends OutputDataShape<LayoutParentData> = OutputDataShape<LayoutParentData>> = Kit.Load<LayoutParams, LayoutServerData, LayoutParentData, OutputData>;
		export type LayoutLoadEvent = Parameters<LayoutLoad>[0];

		export type LayoutData = Expand<Expand<Omit<LayoutParentData, keyof LayoutParentData & EnsureDefined<LayoutServerData>> & OptionalUnion<EnsureDefined<LayoutParentData & EnsureDefined<LayoutServerData>>>> & {
		    MyPageLoad1Query: MyPageLoad1QueryStore;
		}>;

		type LoadInput = {
		    MyPageLoad1Query: MyPageLoad1Query$input;
		};

		export type MyPageLoad1QueryVariables = VariableFunction<LayoutLoadEvent, MakeOptional<MyPageLoad1Query$input, "userID">>;
	`)
})
