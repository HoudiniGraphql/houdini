import { test, expect } from 'vitest'

import { test_transform_js, test_transform_svelte } from '../../tests'

test('modifies root +layout.svelte with data prop', async function () {
	// run the test
	const result = await test_transform_svelte(
		'src/routes/+layout.svelte',
		`
			<script>
				export let data
			</script>
		`
	)

	expect(result).toMatchInlineSnapshot(`
		import "$houdini/runtime/adapter";
		import __houdini_client__ from "PROJECT_ROOT/my/client/path";
		export let data;

		$:
		__houdini_client__.receiveServerSession(data);
	`)
})

test('modifies root +layout.svelte without data prop', async function () {
	// run the test
	const result = await test_transform_svelte('src/routes/+layout.svelte', ``)

	expect(result).toMatchInlineSnapshot(`
		import "$houdini/runtime/adapter";
		import __houdini_client__ from "PROJECT_ROOT/my/client/path";
		export let data;

		$:
		__houdini_client__.receiveServerSession(data);
	`)
})

test('adds load to +layout.server.js', async function () {
	const result = await test_transform_js('src/routes/+layout.server.js', ``)

	expect(result).toMatchInlineSnapshot(`
		import __houdini_client__ from "PROJECT_ROOT/my/client/path";

		export async function load(event) {
		    const __houdini__vite__plugin__return__value__ = {};

		    return {
		        ...__houdini_client__.passServerSession(event),
		        ...__houdini__vite__plugin__return__value__
		    };
		}
	`)
})

test('modifies existing load +layout.server.js', async function () {
	const result = await test_transform_js(
		'src/routes/+layout.server.js',
		`
			export async function load() {
				"some random stuff that's valid javascript" 
				return { 
					hello: "world",
				}
				
			}
		`
	)

	expect(result).toMatchInlineSnapshot(`
		import __houdini_client__ from "PROJECT_ROOT/my/client/path";

		export async function load(event) {
		    "some random stuff that's valid javascript";
		    const __houdini__vite__plugin__return__value__ = {
		        hello: "world"
		    };

		    return {
		        ...__houdini_client__.passServerSession(event),
		        ...__houdini__vite__plugin__return__value__
		    };
		}
	`)
})

test('modifies existing load +layout.server.js - no return', async function () {
	const result = await test_transform_js(
		'src/routes/+layout.server.js',
		`
			export async function load() {
				"some random stuff that's valid javascript" 
			}
		`
	)

	expect(result).toMatchInlineSnapshot(`
		import __houdini_client__ from "PROJECT_ROOT/my/client/path";

		export async function load(event) {
		    "some random stuff that's valid javascript";
		    const __houdini__vite__plugin__return__value__ = {};

		    return {
		        ...__houdini_client__.passServerSession(event),
		        ...__houdini__vite__plugin__return__value__
		    };
		}
	`)
})

test('modifies existing load +layout.server.js - rest params', async function () {
	const result = await test_transform_js(
		'src/routes/+layout.server.js',
		`
			export async function load({ foo, bar, ...baz }) {
				console.log(foo)
				return { 
					some: 'value'
				}
			}
		`
	)

	expect(result).toMatchInlineSnapshot(`
		import __houdini_client__ from "PROJECT_ROOT/my/client/path";

		export async function load(event) {
		    let {
		        foo,
		        bar,
		        ...baz
		    } = event;

		    console.log(foo);

		    const __houdini__vite__plugin__return__value__ = {
		        some: "value"
		    };

		    return {
		        ...__houdini_client__.passServerSession(event),
		        ...__houdini__vite__plugin__return__value__
		    };
		}
	`)
})

test('modifies existing load +layout.server.js - const arrow function', async function () {
	const result = await test_transform_js(
		'src/routes/+layout.server.js',
		`
			export const load = ({ foo, bar, ...baz }) => {
				console.log(foo)
				return { 
					some: 'value'
				}
			}
		`
	)

	expect(result).toMatchInlineSnapshot(`
		import __houdini_client__ from "PROJECT_ROOT/my/client/path";

		export const load = event => {
		    let {
		        foo,
		        bar,
		        ...baz
		    } = event;

		    console.log(foo);

		    const __houdini__vite__plugin__return__value__ = {
		        some: "value"
		    };

		    return {
		        ...__houdini_client__.passServerSession(event),
		        ...__houdini__vite__plugin__return__value__
		    };
		};
	`)
})

test('modifies existing load +layout.server.js - const function', async function () {
	const result = await test_transform_js(
		'src/routes/+layout.server.js',
		`
			export const load = function({ foo, bar, ...baz }) {
				console.log(foo)
				return { 
					some: 'value'
				}
			}
		`
	)

	expect(result).toMatchInlineSnapshot(`
		import __houdini_client__ from "PROJECT_ROOT/my/client/path";

		export const load = function(event) {
		    let {
		        foo,
		        bar,
		        ...baz
		    } = event;

		    console.log(foo);

		    const __houdini__vite__plugin__return__value__ = {
		        some: "value"
		    };

		    return {
		        ...__houdini_client__.passServerSession(event),
		        ...__houdini__vite__plugin__return__value__
		    };
		};
	`)
})
