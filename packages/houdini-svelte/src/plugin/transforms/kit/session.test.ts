import { test, expect } from 'vitest'

import { test_transform_js, test_transform_svelte } from '../../../test'

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
		import { extractSession, setClientSession } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { onMount } from "svelte";
		import { setClientStarted } from "$houdini/plugins/houdini-svelte/runtime/adapter";
		export let data;
		onMount(() => setClientStarted());

		page.subscribe(val => {
		    setClientSession(extractSession(val.data));
		});
	`)
})

test('export const load', async function () {
	const result = await test_transform_js(
		'src/routes/+layout.server.js',
		`
		export const load = loadFlash(async () => {
				"some random stuff that's valid javascript"
			})
		`
	)

	expect(result).toMatchInlineSnapshot(`
		import { buildSessionObject } from "$houdini/plugins/houdini-svelte/runtime/session";

		export const load = loadFlash(async event => {
		    "some random stuff that's valid javascript";
		    return {
		        ...buildSessionObject(event),
		        ...{}
		    };
		});
	`)
})

test('modifies root +layout.svelte without data prop', async function () {
	// run the test
	const result = await test_transform_svelte('src/routes/+layout.svelte', ``)

	expect(result).toMatchInlineSnapshot(`
		import { page } from "$app/stores";
		import { extractSession, setClientSession } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { onMount } from "svelte";
		import { setClientStarted } from "$houdini/plugins/houdini-svelte/runtime/adapter";
		onMount(() => setClientStarted());

		page.subscribe(val => {
		    setClientSession(extractSession(val.data));
		});
	`)
})

test('adds load to +layout.server.js', async function () {
	const result = await test_transform_js('src/routes/+layout.server.js', ``)

	expect(result).toMatchInlineSnapshot(`
		import { buildSessionObject } from "$houdini/plugins/houdini-svelte/runtime/session";

		export async function load(event) {
		    return {
		        ...buildSessionObject(event),
		        ...{}
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
		import { buildSessionObject } from "$houdini/plugins/houdini-svelte/runtime/session";

		export async function load(event) {
		    "some random stuff that's valid javascript";
		    return {
		        ...buildSessionObject(event),

		        ...{
		            hello: "world"
		        }
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
		import { buildSessionObject } from "$houdini/plugins/houdini-svelte/runtime/session";

		export async function load(event) {
		    "some random stuff that's valid javascript";
		    return {
		        ...buildSessionObject(event),
		        ...{}
		    };
		}
	`)
})

test('modifies existing load +layout.server.js - satisfies operator', async function () {
	const result = await test_transform_js(
		'src/routes/+layout.server.js',
		`
			import type { LayoutServerLoad } from "./$types";

			export const load = (() => ({ test: "Hello" })) satisfies LayoutServerLoad;
		`
	)

	expect(result).toMatchInlineSnapshot(`
		import { buildSessionObject } from "$houdini/plugins/houdini-svelte/runtime/session";
		import type { LayoutServerLoad } from "./$types";

		export const load = (event => {
		    return {
		        ...buildSessionObject(event),

		        ...({
		            test: "Hello"
		        })
		    };
		}) satisfies LayoutServerLoad;
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
		import { buildSessionObject } from "$houdini/plugins/houdini-svelte/runtime/session";

		export async function load(event) {
		    let {
		        foo,
		        bar,
		        ...baz
		    } = event;

		    console.log(foo);

		    return {
		        ...buildSessionObject(event),

		        ...{
		            some: "value"
		        }
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
		import { buildSessionObject } from "$houdini/plugins/houdini-svelte/runtime/session";

		export const load = event => {
		    let {
		        foo,
		        bar,
		        ...baz
		    } = event;

		    console.log(foo);

		    return {
		        ...buildSessionObject(event),

		        ...{
		            some: "value"
		        }
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
		import { buildSessionObject } from "$houdini/plugins/houdini-svelte/runtime/session";

		export const load = function(event) {
		    let {
		        foo,
		        bar,
		        ...baz
		    } = event;

		    console.log(foo);

		    return {
		        ...buildSessionObject(event),

		        ...{
		            some: "value"
		        }
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
		import { buildSessionObject } from "$houdini/plugins/houdini-svelte/runtime/session";

		export const load = event => {
		    return {
		        ...buildSessionObject(event),

		        ...({
		            hello: "world"
		        })
		    };
		};
	`)
})

test('passes session from root client-side layout', async function () {
	const result = await test_transform_js('src/routes/+layout.js', ``)

	expect(result).toMatchInlineSnapshot(`
		export async function load(event) {
		    return {
		        ...event.data,
		        ...{}
		    };
		}
	`)
})

test('augments load function in root layout load', async function () {
	const result = await test_transform_js(
		'src/routes/+layout.js',
		`
		import { browser } from '$app/environment';

		export const load = async ({ url }) => {
			console.log('routes/+layout.js start');
			if (!browser) return;

			console.log('this should only run in the browser');
		};

	`
	)

	expect(result).toMatchInlineSnapshot(`
		import { browser } from "$app/environment";

		export const load = async event => {
		    let {
		        url
		    } = event;

		    console.log("routes/+layout.js start");

		    if (!browser) return {
		        ...event.data,
		        ...{}
		    };

		    console.log("this should only run in the browser");

		    return {
		        ...event.data,
		        ...{}
		    };
		};
	`)
})
