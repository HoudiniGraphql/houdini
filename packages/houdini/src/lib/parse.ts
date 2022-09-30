import { parse as parseJavascript } from '@babel/parser'

import type { Maybe, Script } from './types'

export type ParsedFile = Maybe<{ script: Script; start: number; end: number }>

export async function parseJS(str: string): Promise<ParsedFile> {
	return {
		start: 0,
		// @ts-ignore
		script: parseJavascript(str || '', {
			plugins: ['typescript'],
			sourceType: 'module',
		}).program,
		end: str.length,
	}
}
