import { parse as parseJavascript, ParserOptions } from '@babel/parser'

import type { Maybe, Script } from './types'

export type ParsedFile = Maybe<{ script: Script; start: number; end: number }>

export async function parseJS(str: string, config?: ParserOptions): Promise<ParsedFile> {
	return {
		start: 0,
		// @ts-ignore
		script: parseJavascript(str || '', {
			plugins: ['typescript'],
			sourceType: 'module',
			...config,
		}).program,
		end: str.length,
	}
}
