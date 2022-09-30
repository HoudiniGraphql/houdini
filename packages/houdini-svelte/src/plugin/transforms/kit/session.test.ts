import { test_transform_js, test_transform_svelte } from 'houdini/vite/tests'
import { test, expect } from 'vitest'

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
		import { page } from "$app/stores";
		import { extractSession, setSession } from "$houdini/runtime/lib/network";
		import { onMount } from "svelte";
		import { setClientStarted } from "$houdini/runtime/adapter";
		export let data;
		onMount(() => setClientStarted());

		page.subscribe(val => {
		    setSession(extractSession(val.data));
		});
	`)
})

test('modifies root +layout.svelte without data prop', async function () {
	// run the test
	const result = await test_transform_svelte('src/routes/+layout.svelte', ``)

	expect(result).toMatchInlineSnapshot(`
		import { page } from "$app/stores";
		import { extractSession, setSession } from "$houdini/runtime/lib/network";
		import { onMount } from "svelte";
		import { setClientStarted } from "$houdini/runtime/adapter";
		onMount(() => setClientStarted());

		page.subscribe(val => {
		    setSession(extractSession(val.data));
		});
	`)
})

test('adds load to +layout.server.js', async function () {
	const result = await test_transform_js('src/routes/+layout.server.js', ``)

	expect(result).toMatchInlineSnapshot(`
		import { buildSessionObject } from "$houdini/runtime/lib/network";

		export async function load(event) {
		    const __houdini__vite__plugin__return__value__ = {};

		    return {
		        ...buildSessionObject(event),
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
		import { buildSessionObject } from "$houdini/runtime/lib/network";

		export async function load(event) {
		    "some random stuff that's valid javascript";
		    const __houdini__vite__plugin__return__value__ = {
		        hello: "world"
		    };

		    return {
		        ...buildSessionObject(event),
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
		import { buildSessionObject } from "$houdini/runtime/lib/network";

		export async function load(event) {
		    "some random stuff that's valid javascript";
		    const __houdini__vite__plugin__return__value__ = {};

		    return {
		        ...buildSessionObject(event),
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
		import { buildSessionObject } from "$houdini/runtime/lib/network";

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
		        ...buildSessionObject(event),
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
		import { buildSessionObject } from "$houdini/runtime/lib/network";

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
		        ...buildSessionObject(event),
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
		import { buildSessionObject } from "$houdini/runtime/lib/network";

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
		        ...buildSessionObject(event),
		        ...__houdini__vite__plugin__return__value__
		    };
		};
	`)
})

test('modifies existing load +layout.server.js - implicit return', async function () {
	const result = await test_transform_js(
		'src/routes/+layout.server.js',
		`
			export const load = () => ({ hello: 'world'})
		`
	)

	expect(result).toMatchInlineSnapshot(`
		import { buildSessionObject } from "$houdini/runtime/lib/network";

		export const load = event => {
		    const __houdini__vite__plugin__return__value__ = ({
		        hello: "world"
		    });

		    return {
		        ...buildSessionObject(event),
		        ...__houdini__vite__plugin__return__value__
		    };
		};
	`)
})

test('passes session from root client-side layout', async function () {
	const result = await test_transform_js('src/routes/+layout.js', ``)

	expect(result).toMatchInlineSnapshot(`
		export async function load(event) {
		    const __houdini__vite__plugin__return__value__ = {};

		    return {
		        ...event.data,
		        ...__houdini__vite__plugin__return__value__
		    };
		}
	`)
})
