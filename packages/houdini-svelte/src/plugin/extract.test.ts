import { test, expect, describe } from 'vitest'

import { parseSvelte } from './extract'

describe('parser tests', () => {
	test('happy path - separate module and instance script', async () => {
		const doc = `
		<script>
			console.log('instance')
		</script>
	`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot('console.log("instance");')
	})

	test('happy path - start on first character', async () => {
		const doc = `<script>
				console.log('module')
			</script>`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot('console.log("module");')
	})

	test('single quotes', async () => {
		const doc = `
			<script context='module'>
				console.log('module')
			</script>
		`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test('happy path - typescript', async () => {
		const doc = `
			<script lang="ts">
				type Foo = { hello: string }
			</script>
		`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`
			type Foo = {
			    hello: string;
			};
		`)
	})

	test('happy path - typescript with generics', async () => {
		const doc = `
			<script lang="ts" generics="T extends Record<string, unknown>">
				export let x: T
			</script>
		`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot('export let x: T;')
	})

	test('happy path - typescript with generics over several lines', async () => {
		const doc = `
				<script lang="ts" context="module">
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					import type { FormPath, SuperForm } from 'sveltekit-superforms';
					type T = Record<string, unknown>;
					type U = unknown;
				</script>
				
				<script
					lang="ts"
					generics="T extends Record<string, unknown>, U extends FormPath<T>"
				>
					import * as FormPrimitive from 'formsnap';
					import { cn } from '$lib/utils.js';
				
					type $$Props = FormPrimitive.FieldsetProps<T, U>;
				
					export let form: SuperForm<T>;
					export let name: U;
				
					let className: $$Props['class'] = undefined;
					export { className as class };
				</script>
			`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`
			import * as FormPrimitive from "formsnap";
			import { cn } from "$lib/utils.js";
			type $$Props = FormPrimitive.FieldsetProps<T, U>;
			export let form: SuperForm<T>;
			export let name: U;
			let className: $$Props["class"] = undefined;
			export { className as class };
		`)
	})

	test('nested script block', async () => {
		const doc = `
			<div>
				<script>
					console.log('inner')
				</script>
			</div>
		`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test('script next to html', async () => {
		const doc = `
			<script>
				console.log('script')
			</script>
			<div>
			</div>
		`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot('console.log("script");')
	})

	test("logic in script doesn't break things", async () => {
		const doc = `
			<script context='module'>
				if (1<2) {
					console.log('hello')
				}
			</script>
		`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test("logic in template doesn't break things", async () => {
		const doc = `
			<script context='module'>
				console.log('hello')
			</script>
			{#if foo < 2}
				<div>
					hello
				</div>
			{/if}
		`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test('self-closing tags', async () => {
		const doc = `
			<svelte:head>
				<link />
			</svelte:head>
			<script>
				console.log('hello')
			</script>
		`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot('console.log("hello");')
	})

	test('comments', async () => {
		const doc = `
			<!-- <script context='module'> -->
			<script>
				console.log('hello')
			</script>
			{#if foo < 2}
				<div>
					hello
				</div>
			{/if}
		`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot('console.log("hello");')
	})

	test("else in template doesn't break things", async () => {
		const doc = `
			<script context='module'>
				console.log('hello')
			</script>
			{#if foo < 2}
				<div>
					hello
				</div>
			{:else if foo < 4}
				<div>
					hello
				</div>
			{/if}
		`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test('expression in content', async () => {
		const doc = `
			<script context='module'>
				console.log('hello')
			</script>
			<div>
				{hello}
			</div>
		`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test('expression attribute', async () => {
		const doc = `
			{#if foo < 2}
				<div>
					hello
				</div>
			{:else if foo < 4}
				<!--
					the crazy <div is to trick the parser into thinking there's
					a new tag inside of an expression
				-->
				<div attribute={foo > 2 && div < 2} foo>
					hello
					<div>
						inner
					</div>
				</div>
			{/if}
			<script context='module'>
				console.log('hello')
			</script>
		`
		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`undefined`)
	})

	test('tabs to end tags', async () => {
		const doc = `<script lang="ts">
			console.log('hello')
		</script>

		<header
			class="sticky flex items-center justify-between h-16 top-0 inset-x-0 max-w-7xl px-2 xl:px-0 mx-auto"
		>

			<svg
			class="w-6 h-6"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			><path
			/>
				hello
			</svg>
		</header>
	`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot('console.log("hello");')
	})

	test("styling tag parse errors don't fail (postcss support)", async () => {
		const doc = `<script lang="ts">
		const example = object({});
	</script>
	<style>
		.test { 
			&_title {
				width: 500px;
				@media (max-width: 500px) {
					width: auto;
				}
				body.is_dark & {
					color: white;
				}
			}
			img {
				display: block;
			}
		}
	</style>

	<div>hello</div>
	`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`const example = object({});`)
	})

	test('empty object in script', async () => {
		const doc = `<script lang="ts">
		const example = object({});
	</script>

	<div>hello</div>
	`

		// parse the string
		const result = await parseSvelte(doc)

		expect(result?.script).toMatchInlineSnapshot(`const example = object({});`)
	})
})

describe('parser svelte 5 runes detection', () => {
	test("shouldn't detect runes where applicable", async () => {
		const testCases = [
			{
				title: "shouldn't detect runes when there are none",
				document: `<script>
                let count = 0;
            </script>
            
            <button on:click={() => count++}>
                clicks: {count}
            </button>`,
			},
			{
				title: "shouldn't detect runes that are commented out",
				document: `<script>
                // we should replace this with const count = $state(0);
                let count = 0;
            </script>`,
			},
		]

		await Promise.all(
			testCases.map(async (testCase) => {
				const result = await parseSvelte(testCase.document)

				expect(result?.useRunes, testCase.title).toBe(false)
			})
		)
	})

	test('should detect usage of runes where applicable', async () => {
		const testCases = [
			{
				runeName: '$state',
				document: `<script>
                let count = $state(0);
            </script>`,
			},
			{
				runeName: '$state.frozen',
				document: `<script>
                let count = $state.frozen(0);
            </script>`,
			},
			{
				runeName: '$state.snapshot',
				document: `<script>
                const isHoudiniAwesome = true;
                console.log($state.snapshot(isHoudiniAwesome));
            </script>`,
			},
			{
				runeName: '$props',
				document: `<script>
                const { prop1, prop2 } = $props();
            </script>`,
			},
			{
				runeName: '$bindable',
				document: `<script>
                let { bindableProp = $bindable() } = $props();
            </script>`,
			},
			{
				runeName: '$derived',
				document: `<script>
                let doubled = $derived(1 + 2);
            </script>`,
			},
			{
				runeName: '$derived.by',
				document: `<script>
                let derived = $derived.by(() => 1 + 2);
            </script>`,
			},
			{
				runeName: '$effect',
				document: `<script>
                $effect(() => console.log("hello world"));
            </script>`,
			},
			{
				runeName: '$effect.pre',
				document: `<script>
                $effect.pre(() => console.log("hello world"));
            </script>`,
			},
			{
				runeName: '$effect.active',
				document: `<script>
                const isActive = $effect.active();
            </script>`,
			},
			{
				runeName: '$effect.root',
				document: `<script>
                const cleanup = $effect.root(() => {
                    $effect(() => console.log("effect"));

                    return () => console.log("cleanup");
                });
            </script>`,
			},
			{
				runeName: '$inspect',
				document: `<script>
                let count = 0;
                $inspect(count);
            </script>`,
			},
			{
				runeName: '$inspect.with',
				document: `<script>
                let count = 0;
                $inspect(count).with((type) => console.log(count));
            </script>`,
			},
			{
				runeName: '$host',
				document: `<script>
                    function greet(greeting) {
                        $host().dispatchEvent(
                            new CustomEvent('greeting', { detail: greeting })
                        );
                    }
                </script>`,
			},
		]

		await Promise.all(
			testCases.map(async (testCase) => {
				const result = await parseSvelte(testCase.document)

				expect(result?.useRunes, `detects usage with ${testCase.runeName} rune`).toBe(true)
			})
		)
	})
})
