import { parseJS, fs, path } from 'houdini'
import { testConfig } from 'houdini/test'
import { test, expect } from 'vitest'

import generate from '..'
import { type_route_dir } from '../../kit'

const config = testConfig()
const plugin_root = config.pluginDirectory('test-plugin')

test('generates types for inline queries', async function () {
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
							'$types.d.ts': `import type * as Kit from '@sveltejs/kit';

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type RouteParams = {  }
type MaybeWithVoid<T> = {} extends T ? T | void : T;
export type RequiredKeys<T> = { [K in keyof T]-?: {} extends { [P in K]: T[K] } ? never : K; }[keyof T];
type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>
type EnsureDefined<T> = T extends null | undefined ? {} : T;
type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? { [P in Exclude<A, keyof U>]?: never } & U : never;
type PageParentData = EnsureDefined<import('../$types.js').LayoutData>;

export type PageServerData = null;
export type PageData = Expand<PageParentData>;
`,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', plugin_root })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts'))
	)

	expect(queryContents).toBeTruthy()

	//the parser doesn't work right but the type imports are correct.
	const parsedQuery = (await parseJS(queryContents!))?.script

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`import type * as Kit from "@sveltejs/kit";
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
type PageParams = PageLoadEvent["params"];
export type PageServerData = null;

export type PageData = Expand<Expand<PageParentData> & {
    MyInlineQuery: MyInlineQueryStore
}>;`)
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

	// generate empty page to ensure that types are generated.
	// see https://github.com/HoudiniGraphql/houdini/pull/702#issuecomment-1318298323
	// await fs.mock({
	// 	[config.routesDir]: {
	// 		myProfile: {
	// 			'+page.ts': ``,
	// 		},
	// 	},
	// })

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': `import type * as Kit from '@sveltejs/kit';

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

export type PageData = Expand<Expand<Omit<PageParentData, keyof PageParentData & EnsureDefined<PageServerData>> & OptionalUnion<EnsureDefined<PageParentData & EnsureDefined<PageServerData>>>> & {
    MyPageQuery: MyPageQueryStore
}>;"
`,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', plugin_root })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts'))
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = (await parseJS(queryContents!))?.script

	//verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`import type * as Kit from "@sveltejs/kit";
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
type PageParams = PageLoadEvent["params"];
export type PageServerData = null;
export type PageLoad<OutputData extends OutputDataShape<PageParentData> = OutputDataShape<PageParentData>> = Kit.Load<RouteParams, PageServerData, PageParentData, OutputData>;
export type PageLoadEvent = Parameters<PageLoad>[0];
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

	// generate empty layout to ensure that types are generated
	// see https://github.com/HoudiniGraphql/houdini/pull/702#issuecomment-1318298323
	// await fs.mock({
	// 	[config.routesDir]: {
	// 		myProfile: {
	// 			'+layout.ts': ``,
	// 		},
	// 	},
	// })

	await fs.mock({
		[path.join(config.projectRoot, '.svelte-kit')]: {
			types: {
				src: {
					routes: {
						myProfile: {
							'$types.d.ts': `import type * as Kit from '@sveltejs/kit';

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
`,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', plugin_root })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts'))
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = (await parseJS(queryContents!))?.script
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`import type * as Kit from "@sveltejs/kit";
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
export type LayoutServerData = null;
export type LayoutLoad<OutputData extends OutputDataShape<LayoutParentData> = OutputDataShape<LayoutParentData>> = Kit.Load<LayoutParams, LayoutServerData, LayoutParentData, OutputData>;
export type LayoutLoadEvent = Parameters<LayoutLoad>[0];

export type LayoutData = Expand<Expand<Omit<LayoutParentData, keyof LayoutParentData & EnsureDefined<LayoutServerData>> & OptionalUnion<EnsureDefined<LayoutParentData & EnsureDefined<LayoutServerData>>>> & {
    MyLayoutQuery: MyLayoutQueryStore
}>;
`)
})

test('generates types for after load', async function () {
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

                    export const houdini_load = [ store1, store2 ]

                    export function afterLoad() {
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
							'$types.d.ts': `import type * as Kit from '@sveltejs/kit';

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
`,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', plugin_root })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts')
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = (await parseJS(queryContents!))?.script

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`import type * as Kit from "@sveltejs/kit";
import type { AfterLoadFunction } from "../../../../plugins/houdini-svelte/runtime/types";
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
type PageParams = PageLoadEvent["params"];
export type PageServerData = null;
export type PageLoad<OutputData extends OutputDataShape<PageParentData> = OutputDataShape<PageParentData>> = Kit.Load<RouteParams, PageServerData, PageParentData, OutputData>;
export type PageLoadEvent = Parameters<PageLoad>[0];

export type PageData = Expand<Expand<Omit<PageParentData, keyof PageParentData & EnsureDefined<PageServerData>> & OptionalUnion<EnsureDefined<PageParentData & EnsureDefined<PageServerData>>>> & {
    MyPageLoad1Query: MyPageLoad1QueryStore
    MyPageLoad2Query: MyPageLoad2QueryStore
} & AfterLoadReturn>;

type LoadInput = {
    MyPageLoad1Query: MyPageLoad1Query$input
};

type AfterLoadReturn = ReturnType<typeof import("./+page").afterLoad>;

type AfterLoadData = {
    MyPageLoad1Query: MyPageLoad1Query$result
    MyPageLoad2Query: MyPageLoad2Query$result
};

export type AfterLoadEvent = {
    event: PageLoadEvent
    data: AfterLoadData
    input: LoadInput
};

export type MyPageLoad1QueryVariables = VariableFunction<PageParams, MyPageLoad1Query$input>;
`)
})

test('generates types for onError', async function () {
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

                    export const houdini_load = [ store1, store2 ]

                    export function onError() {
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
							'$types.d.ts': `import type * as Kit from '@sveltejs/kit';

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
`,
						},
					},
				},
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', plugin_root })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts')
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = (await parseJS(queryContents!))?.script

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`import type * as Kit from "@sveltejs/kit";
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
type PageParams = PageLoadEvent["params"];
export type PageServerData = null;
export type PageLoad<OutputData extends OutputDataShape<PageParentData> = OutputDataShape<PageParentData>> = Kit.Load<RouteParams, PageServerData, PageParentData, OutputData>;
export type PageLoadEvent = Parameters<PageLoad>[0];

export type PageData = Expand<Expand<Omit<PageParentData, keyof PageParentData & EnsureDefined<PageServerData>> & OptionalUnion<EnsureDefined<PageParentData & EnsureDefined<PageServerData>>>> & {
    MyPageLoad1Query: MyPageLoad1QueryStore
    MyPageLoad2Query: MyPageLoad2QueryStore
} & OnErrorReturn>;

type LoadInput = {
    MyPageLoad1Query: MyPageLoad1Query$input
};

type OnErrorReturn = ReturnType<typeof import("./+page").onError>;

export type OnErrorEvent = {
    event: Kit.LoadEvent
    input: LoadInput
    error: Error | Error[]
};

export type MyPageLoad1QueryVariables = VariableFunction<PageParams, MyPageLoad1Query$input>;
`)
})
