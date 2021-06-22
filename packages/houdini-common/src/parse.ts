// external imports
import typescript from 'typescript'
import { parse, preprocess } from 'svelte/compiler'
import { Ast } from 'svelte/types/compiler/interfaces'

export async function parseFile(content: string): Promise<Ast> {
	// in order to push the code through svelte's compiler, we need to first
	// handle the typescript source code
	const processed = await preprocess(content, [
		{
			script({ content: fileContents }) {
				const { outputText: code } = typescript.transpileModule(fileContents, {})
				return {
					code,
				}
			},
		},
	])

	// run the processed source through svelte's compiler to pull out the instance and module
	return parse(processed.code)
}
