import { parseJS, fs, path } from 'houdini'
import { mockCollectedDoc, testConfig } from 'houdini/test'
import { test, expect } from 'vitest'

import generate from '..'

const config = testConfig()
const pluginRoot = config.pluginDirectory('hodini-svelte')

test('generates types for fragments', async function () {
	// create the mock filesystem
	await fs.mock({
		[path.join(config.pluginDirectory('houdini-svelte'), 'runtime', 'fragments.d.ts')]: `
			import { Fragment } from '$houdini/runtime/lib/types';
			import { Readable } from 'svelte/store';
			import { FragmentStore } from './stores';
			import type { FragmentStorePaginated } from './stores/pagination/fragment';

			export declare function fragment<_Fragment extends Fragment<any>>(ref: _Fragment, fragment: FragmentStore<_Fragment['shape']>): Readable<NonNullable<_Fragment['shape']>> & {
				data: Readable<_Fragment>;
			};
			export declare function fragment<_Fragment extends Fragment<any>>(ref: _Fragment | null, fragment: FragmentStore<_Fragment['shape']>): Readable<NonNullable<_Fragment['shape']> | null> & {
				data: Readable<_Fragment | null>;
			};
			export declare function paginatedFragment<_Fragment extends Fragment<any>>(initialValue: _Fragment | null, document: FragmentStore<_Fragment['shape']>): FragmentStorePaginated<_Fragment['shape'], {}>;
			export declare function paginatedFragment<_Fragment extends Fragment<any>>(initialValue: _Fragment, document: FragmentStore<_Fragment['shape']>): FragmentStorePaginated<_Fragment['shape'], {}>;
		`,
	})

	// execute the generator
	await generate({
		config,
		documents: [mockCollectedDoc(`fragment TestFragment on Query { viewer { id } } `)],
		framework: 'kit',
		pluginRoot,
	})

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(config.pluginRuntimeDirectory('houdini-svelte'), 'fragments.d.ts')
	)

	expect(queryContents).toBeTruthy()

	//the parser doesn't work right but the type imports are correct.
	const parsedQuery = (await parseJS(queryContents!))?.script

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import { TestFragment$input, TestFragment$data } from "../../../artifacts/TestFragment";
		import { TestFragmentStore } from "../stores/TestFragment";
		import type { FragmentStoreInstance } from "./types";
		import { Fragment } from "$houdini/runtime/lib/types";
		import { Readable } from "svelte/store";
		import { FragmentStore } from "./stores";
		import type { FragmentStorePaginated } from "./stores/pagination/fragment";

		export function fragment(
		    initialValue: {
		        $fragments: {
		            TestFragment: any;
		        };
		    },
		    document: TestFragmentStore
		): FragmentStoreInstance<TestFragment$data>;

		export function fragment(
		    initialValue: {
		        $fragments: {
		            TestFragment: any;
		        };
		    } | null,
		    document: TestFragmentStore
		): FragmentStoreInstance<TestFragment$data | null>;

		export declare function fragment<_Fragment extends Fragment<any>>(ref: _Fragment, fragment: FragmentStore<_Fragment["shape"]>): Readable<NonNullable<_Fragment["shape"]>> & {
		    data: Readable<_Fragment>;
		};

		export declare function fragment<_Fragment extends Fragment<any>>(ref: _Fragment | null, fragment: FragmentStore<_Fragment["shape"]>): Readable<NonNullable<_Fragment["shape"]> | null> & {
		    data: Readable<_Fragment | null>;
		};

		export declare function paginatedFragment<_Fragment extends Fragment<any>>(
		    initialValue: _Fragment | null,
		    document: FragmentStore<_Fragment["shape"]>
		): FragmentStorePaginated<_Fragment["shape"], {}>;

		export declare function paginatedFragment<_Fragment extends Fragment<any>>(initialValue: _Fragment, document: FragmentStore<_Fragment["shape"]>): FragmentStorePaginated<_Fragment["shape"], {}>;
	`)
})

test('generates types for paginated fragments', async function () {
	// create the mock filesystem
	await fs.mock({
		[path.join(config.pluginDirectory('houdini-svelte'), 'runtime', 'fragments.d.ts')]: `
			import { Fragment } from '$houdini/runtime/lib/types';
			import { Readable } from 'svelte/store';
			import { FragmentStore } from './stores';
			import type { FragmentStorePaginated } from './stores/pagination/fragment';

			export declare function fragment<_Fragment extends Fragment<any>>(ref: _Fragment, fragment: FragmentStore<_Fragment['shape']>): Readable<NonNullable<_Fragment['shape']>> & {
				data: Readable<_Fragment>;
			};
			export declare function fragment<_Fragment extends Fragment<any>>(ref: _Fragment | null, fragment: FragmentStore<_Fragment['shape']>): Readable<NonNullable<_Fragment['shape']> | null> & {
				data: Readable<_Fragment | null>;
			};
			export declare function paginatedFragment<_Fragment extends Fragment<any>>(initialValue: _Fragment | null, document: FragmentStore<_Fragment['shape']>): FragmentStorePaginated<_Fragment['shape'], {}>;
			export declare function paginatedFragment<_Fragment extends Fragment<any>>(initialValue: _Fragment, document: FragmentStore<_Fragment['shape']>): FragmentStorePaginated<_Fragment['shape'], {}>;
		`,
	})

	// execute the generator
	await generate({
		config,
		documents: [
			mockCollectedDoc(
				`
				fragment TestFragment on Query { 
					friendsByCursor(first:10) @paginate { 
						edges { 
							node { 
								id  
							}
						}
					}
				} 
			`,
				{
					refetch: {
						method: 'cursor',
						direction: 'forward',
						embedded: true,
						path: ['friendsByCursor', 'edges', 'node'],
						paginated: true,
						pageSize: 10,
						targetType: 'User',
					},
				}
			),
		],
		framework: 'kit',
		pluginRoot,
	})

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(config.pluginRuntimeDirectory('houdini-svelte'), 'fragments.d.ts')
	)

	expect(queryContents).toBeTruthy()

	//the parser doesn't work right but the type imports are correct.
	const parsedQuery = (await parseJS(queryContents!))?.script

	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import { TestFragment$input, TestFragment$data } from "../../../artifacts/TestFragment";
		import { TestFragmentStore } from "../stores/TestFragment";
		import type { CursorFragmentStoreInstance } from "./types";
		import { Fragment } from "$houdini/runtime/lib/types";
		import { Readable } from "svelte/store";
		import { FragmentStore } from "./stores";
		import type { FragmentStorePaginated } from "./stores/pagination/fragment";

		export function fragment(
		    initialValue: {
		        $fragments: {
		            TestFragment: any;
		        };
		    },
		    document: TestFragmentStore
		): CursorFragmentStoreInstance<TestFragment$data, TestFragment$input>;

		export function fragment(
		    initialValue: {
		        $fragments: {
		            TestFragment: any;
		        };
		    } | null,
		    document: TestFragmentStore
		): CursorFragmentStoreInstance<TestFragment$data | null, TestFragment$input>;

		export declare function fragment<_Fragment extends Fragment<any>>(ref: _Fragment, fragment: FragmentStore<_Fragment["shape"]>): Readable<NonNullable<_Fragment["shape"]>> & {
		    data: Readable<_Fragment>;
		};

		export declare function fragment<_Fragment extends Fragment<any>>(ref: _Fragment | null, fragment: FragmentStore<_Fragment["shape"]>): Readable<NonNullable<_Fragment["shape"]> | null> & {
		    data: Readable<_Fragment | null>;
		};

		export function paginatedFragment(
		    initialValue: {
		        $fragments: {
		            TestFragment: any;
		        };
		    },
		    document: TestFragmentStore
		): CursorFragmentStoreInstance<TestFragment$data, TestFragment$input>;

		export function paginatedFragment(
		    initialValue: {
		        $fragments: {
		            TestFragment: any;
		        };
		    } | null,
		    document: TestFragmentStore
		): CursorFragmentStoreInstance<TestFragment$data | null, TestFragment$input>;

		export declare function paginatedFragment<_Fragment extends Fragment<any>>(
		    initialValue: _Fragment | null,
		    document: FragmentStore<_Fragment["shape"]>
		): FragmentStorePaginated<_Fragment["shape"], {}>;

		export declare function paginatedFragment<_Fragment extends Fragment<any>>(initialValue: _Fragment, document: FragmentStore<_Fragment["shape"]>): FragmentStorePaginated<_Fragment["shape"], {}>;
	`)
})
