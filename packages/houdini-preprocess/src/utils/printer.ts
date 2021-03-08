import * as svelte from 'svelte/compiler'
import { Ast as SvelteAst } from 'svelte/types/compiler/interfaces'
// @ts-ignore
import * as prettierPlugin from 'prettier-plugin-svelte'
import prettier, { Doc, FastPath } from 'prettier'
// @ts-ignore
import LocalFastPath from './fastPath.js'

// note: this file is mostly scratch notes for a time when we might
// want to use the prettier plugin to format the html bits of a
// svelte document

export function printSvelteDocument(originalText: string, parsed: SvelteAst): string {
	// wrap the result in a fast path so we can play by prettier's rules
	const path = new LocalFastPath({ ...parsed, __isRoot: true })

	const config = {
		...opts,
		originalText: originalText,
	}

	// we need to define a recursion save version of the printer
	const printDoc: (path: FastPath) => Doc = (path: FastPath) =>
		pluginPrinter(path, config, printDoc)

	return printDocToString(printDoc(path)).formatted
}

// wrap the prettier internal in something we can use
const printDocToString: (doc: Doc) => { formatted: string } = (doc) =>
	// @ts-ignore
	prettier.__debug.printDocToString(doc, {
		parser: 'svelte',
	})

// the configuration for the printer
const opts = {
	...Object.keys(prettierPlugin.options).reduce(
		(acc, key) => ({
			...acc,
			[key]: prettierPlugin.options[key].default,
		}),
		{}
	),

	locStart(node: any) {
		return node.start
	},

	locEnd(node: any) {
		return node.end
	},
}

// pull the printer out of the prettier plugin (note: this isn't ready for prettier yet)
const pluginPrinter = prettierPlugin.printers['svelte-ast'].print

processSvelteContent(`
<script>
	console.log('hello')
</script>
    {#if foo }
        <div>
            hello
        </div>
    {/if}
`)
