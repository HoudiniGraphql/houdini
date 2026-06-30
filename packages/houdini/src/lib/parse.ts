import { parse as parseJavascript, type ParserOptions } from '@babel/parser'
import type { Options } from 'recast'
import { parse as recastParse, print, prettyPrint } from 'recast'

import { deepMerge } from './deepMerge.js'
import type { Maybe, Script } from './types.js'

export type ParsedFile = Maybe<{ script: Script; start: number; end: number }>

const defaultBabelConfig: ParserOptions = {
	plugins: ['typescript', 'importAssertions', 'decorators-legacy', 'explicitResourceManagement'],
	sourceType: 'module',
}

export function parseJS(
	str: string,
	config?: Partial<ParserOptions>,
	// sourceFileName names the original source so recast's generated source map points
	// back at it — pass the file path when the printed output needs to map to the source
	// (e.g. the vite transform that rewrites graphql() tags and shifts line numbers).
	sourceFileName?: string
): Script {
	const mergedConfig = config ? deepMerge('', defaultBabelConfig, config) : defaultBabelConfig
	// Use recast.parse with babel as the custom parser so recast can track original node positions.
	// This lets recast.print() preserve unchanged nodes verbatim and generate accurate source maps.
	return (
		recastParse(str || '', {
			sourceFileName,
			parser: {
				// tokens: true is required so recast doesn't fall back to esprima's tokenizer,
				// which can't handle TypeScript syntax.
				parse: (src: string) =>
					parseJavascript(src, { ...(mergedConfig as ParserOptions), tokens: true }),
			},
		}) as any
	).program
}

type PrintOptions = Options & { pretty?: boolean }

export async function printJS(
	script: Script,
	options?: PrintOptions
): Promise<{ code: string; map?: any }> {
	// sourceMapName makes recast emit `.map`. Together with sourceFileName (set at parse
	// time) the map translates the printed output's positions back to the original source,
	// so stack traces / breakpoints stay accurate after we rewrite nodes. Callers that
	// parsed without a sourceFileName simply get a map they can ignore.
	const defaultOptions: PrintOptions = { tabWidth: 4, sourceMapName: 'houdini-transform' }
	if (options?.pretty) {
		return prettyPrint(
			script,
			options ? deepMerge('', defaultOptions, options) : defaultOptions
		)
	} else {
		return print(script, options ? deepMerge('', defaultOptions, options) : defaultOptions)
	}
}
