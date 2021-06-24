// externals
import * as recast from 'recast'
// locals
import '../../../jest.setup'
import { parseFile, ParsedSvelteFile } from './parse'

describe('parser tests', () => {
	test('happy path - separate module and instance script', () => {
		const doc = `
		<script context="module">
			console.log('module')
		</script>

		<script>
			console.log('instance')
		</script>
	`

		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("instance");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`69`)
		expect(result.instance?.end).toMatchInlineSnapshot(`115`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.module?.start).toMatchInlineSnapshot(`3`)
		expect(result.module?.end).toMatchInlineSnapshot(`64`)

		checkScriptBounds(doc, result)
	})

	test('happy path - start on first character', () => {
		const doc = `<script context="module">
				console.log('module')
			</script>`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.module?.start).toMatchInlineSnapshot(`0`)
		expect(result.module?.end).toMatchInlineSnapshot(`63`)

		checkScriptBounds(doc, result)
	})

	test('happy path - only module', () => {
		const doc = `
			<script context="module">
				console.log('module')
			</script>
		`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`67`)

		checkScriptBounds(doc, result)
	})

	test('happy path - only instance', () => {
		const doc = `
			<script>
				console.log('module')
			</script>
		`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`4`)
		expect(result.instance?.end).toMatchInlineSnapshot(`50`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})

	test('single quotes', () => {
		const doc = `
			<script context='module'>
				console.log('module')
			</script>
		`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("module");`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`67`)

		checkScriptBounds(doc, result)
	})

	test('happy path - typescript', () => {
		const doc = `
			<script context="module" lang="ts">
				type Foo = { hello: string}
			</script>
		`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`
		type Foo = {
		    hello: string
		};
	`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`83`)

		checkScriptBounds(doc, result)
	})

	test('nested script block', () => {
		const doc = `
			<div>
				<script>
					console.log('inner')
				</script>
			</div>
		`

		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})

	test('script next to html', () => {
		const doc = `
			<script>
				console.log('script')
			</script>
			<div>
			</div>
		`

		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("script");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`4`)
		expect(result.instance?.end).toMatchInlineSnapshot(`50`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})

	test("logic in script doesn't break things", () => {
		const doc = `
			<script context='module'>
				if (1<2) {
					console.log('hello')
				}
			</script>
		`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`
		if (1 < 2) {
		    console.log("hello");
		}
	`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`88`)

		checkScriptBounds(doc, result)
	})

	test("logic in template doesn't break things", () => {
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
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`66`)

		checkScriptBounds(doc, result)
	})

	test('self-closing tags', () => {
		const doc = `
			<svelte:head>
				<link />
			</svelte:head>
			<script>
				console.log('hello')
			</script>
		`

		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`52`)
		expect(result.instance?.end).toMatchInlineSnapshot(`97`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})

	test('comments', () => {
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
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.instance?.start).toMatchInlineSnapshot(`42`)
		expect(result.instance?.end).toMatchInlineSnapshot(`87`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})

	test("else in template doesn't break things", () => {
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
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`66`)

		checkScriptBounds(doc, result)
	})

	test('expression in content', () => {
		const doc = `
			<script context='module'>
				console.log('hello')
			</script>
			<div>
				{hello}
			</div>
		`
		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.module?.start).toMatchInlineSnapshot(`4`)
		expect(result.module?.end).toMatchInlineSnapshot(`66`)

		checkScriptBounds(doc, result)
	})

	test('expression attribute', () => {
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
				<div attribute={foo > && <div 2} foo>
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
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.instance?.end).toMatchInlineSnapshot(`undefined`)

		expect(result.module?.content).toMatchInlineSnapshot(`console.log("hello");`)
		expect(result.module?.start).toMatchInlineSnapshot(`306`)
		expect(result.module?.end).toMatchInlineSnapshot(`368`)

		checkScriptBounds(doc, result)
	})

	test('pixelmund 1', () => {
		const doc = `<script lang="ts">
			import Menu from './Menu.svelte';
		
			import { session } from '$app/stores';
		
			import { graphql, Logout, mutation, ToggleTheme } from '$houdini';
			import MenuItem from './MenuItem.svelte';
		
			const toggleTheme = mutation<ToggleTheme>(graphql\`
				mutation ToggleTheme {
					toggleTheme
				}
			\`);
		
			const logout = mutation<Logout>(graphql\`
				mutation Logout {
					logout {
						ok
					}
				}
			\`);
		
			async function signOut() {
				const result = await logout(null);
				window.location.reload();
			}
		
			async function changeTheme() {
				const response = await toggleTheme(null);
				document.documentElement.classList.remove('dark', 'light');
				document.documentElement.classList.add(response.toggleTheme);
				session.update((cur) => ({
					...cur,
					session: {
						...cur.session,
						external: {
							...cur.session.external,
							darkmode: response.toggleTheme === 'dark',
						},
					},
				}));
			}
		
		</script>
		
		<header
			class="sticky flex items-center justify-between h-16 top-0 inset-x-0 max-w-7xl px-2 xl:px-0 mx-auto"
		>
			<a href="/">
				<div class="font-bold italic text-lg">noods</div>
			</a>
			<nav>
				<ul>
					<li />
				</ul>
			</nav>
			<div class="flex items-center space-x-4">
				{#if $session?.user}
					<Menu>
						<button
							slot="trigger"
							let:trigger
							let:active
							on:click={trigger}
							class="focus:outline-none focus:text-brand-400 {active
								? 'text-brand-500'
								: 'text-gray-400'}"
						>
							<svg
								class="w-6 h-6"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								xmlns="http://www.w3.org/2000/svg"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
								/>
							</svg>
						</button>
						<div
							class="h-32 w-64 bg-gray-50 dark:bg-gray-800 mt-1 shadow rounded-md"
						/>
					</Menu>
					<Menu>
						<button
							slot="trigger"
							let:trigger
							let:active
							on:click={trigger}
							class="focus:outline-none group {active
								? 'text-brand-500'
								: 'text-gray-400'}"
						>
							<img
								class="rounded-full w-10 h-10 object-cover border-2 border-transparent transition group-focus:border-brand-400 {active
									? 'border-brand-500'
									: ''}"
								src={$session?.user?.avatar ??
									'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=150&q=80'}
								alt={$session?.user?.username}
							/>
						</button>
						<div
							class="h-32 w-48 bg-gray-50 dark:bg-gray-800 mt-1 shadow rounded-md space-y-1"
						>
							<MenuItem tag="button" on:click={changeTheme}>Toggle Theme</MenuItem>
							<MenuItem tag="button" on:click={signOut}>Sign out</MenuItem>
						</div>
					</Menu>
				{:else}
					<a href="/auth/sign-in">Sign in</a>
				{/if}
			</div>
		</header>
	`

		// parse the string
		const result = parseFile(doc)

		expect(result.instance?.content).toMatchInlineSnapshot(`
		import Menu from "./Menu.svelte";
		import { session } from "$app/stores";
		import { graphql, Logout, mutation, ToggleTheme } from "$houdini";
		import MenuItem from "./MenuItem.svelte";

		const toggleTheme = mutation<ToggleTheme>(graphql\`
						mutation ToggleTheme {
							toggleTheme
						}
					\`);

		const logout = mutation<Logout>(graphql\`
						mutation Logout {
							logout {
								ok
							}
						}
					\`);

		async function signOut() {
		    const result = await logout(null);
		    window.location.reload();
		}

		async function changeTheme() {
		    const response = await toggleTheme(null);
		    document.documentElement.classList.remove("dark", "light");
		    document.documentElement.classList.add(response.toggleTheme);

		    session.update(cur => ({
		        ...cur,

		        session: {
		            ...cur.session,

		            external: {
		                ...cur.session.external,
		                darkmode: response.toggleTheme === "dark"
		            }
		        }
		    }));
		}
	`)
		expect(result.instance?.start).toMatchInlineSnapshot(`0`)
		expect(result.instance?.end).toMatchInlineSnapshot(`991`)

		expect(result.module?.content).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.start).toMatchInlineSnapshot(`undefined`)
		expect(result.module?.end).toMatchInlineSnapshot(`undefined`)

		checkScriptBounds(doc, result)
	})
})

function checkScriptBounds(doc: string, result?: ParsedSvelteFile | null | undefined) {
	if (!result) {
		return
	}

	if (result.module) {
		expect(doc[result.module.start]).toEqual('<')
		expect(doc[result.module.end]).toEqual('>')
	}

	if (result.instance) {
		expect(doc[result.instance.start]).toEqual('<')
		expect(doc[result.instance.end]).toEqual('>')
	}
}
