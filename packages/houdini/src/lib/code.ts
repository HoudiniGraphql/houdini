import type { Options } from 'recast'
import { parse, print, prettyPrint } from 'recast'
import parser from 'recast/parsers/typescript'

import type { Script } from './types'

type PrintOptions = Options & { pretty?: boolean }

export async function parseJS(code: string): Promise<Script> {
	const { program: script } = parse(code, { parser })
	return script
}

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
