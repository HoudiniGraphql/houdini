import { parse as parseJavascript, type ParserOptions } from '@babel/parser'
import type { Options } from 'recast'
import { print, prettyPrint } from 'recast'

import { deepMerge } from './deepMerge'
import type { Maybe, Script } from './types'

export type ParsedFile = Maybe<{ script: Script; start: number; end: number }>

// we can't use the recast parser because it normalizes template strings which break the graphql function
// overload definitions
export function parseJS(str: string, config?: Partial<ParserOptions>): Script {
	const defaultConfig: ParserOptions = {
		plugins: ['typescript', 'importAssertions', 'decorators-legacy'],
		sourceType: 'module',
	}
	// @ts-ignore: babel doesn't perfectly match recast's types (the comments don't line up)
	return parseJavascript(str || '', config ? deepMerge('', defaultConfig, config) : defaultConfig)
		.program
}

export function parseJSON(str: string): any {
	// remove all comments to be able to parse the file, and add stuff to it.
	str = str.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => (g ? '' : m))
	return JSON.parse(str)
}

type PrintOptions = Options & { pretty?: boolean }

export async function printJS(
	script: Script,
	options?: PrintOptions
): Promise<{ code: string; map?: any }> {
	if (options?.pretty) {
		return prettyPrint(script, options)
	} else {
		return print(script, options)
	}
}
