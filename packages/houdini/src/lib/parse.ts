import { parse as parseJavascript, type ParserOptions } from '@babel/parser'

import { deepMerge } from './deepMerge'
import type { Maybe, Script } from './types'

export type ParsedFile = Maybe<{ script: Script; start: number; end: number }>

export async function parseJS(str: string, config?: Partial<ParserOptions>): Promise<ParsedFile> {
	const defaultConfig: ParserOptions = {
		plugins: ['typescript'],
		sourceType: 'module',
	}
	return {
		start: 0,
		// @ts-ignore
		script: parseJavascript(
			str || '',
			config ? deepMerge('', defaultConfig, config) : defaultConfig
		).program,
		end: str.length,
	}
}

export function parseJSON(str: string): any {
	// remove all comments to be able to parse the file, and add stuff to it.
	str = str.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => (g ? '' : m))
	return JSON.parse(str)
}
