// external imports
// import typescript from 'typescript'
// import { parse, preprocess } from 'svelte/compiler'
// import { Ast } from 'svelte/types/compiler/interfaces'

import { parse, preprocess } from 'svelte/compiler'
import sveltePreprocess from 'svelte-preprocess'

export async function parseFile(content: string): Promise<Ast> {
	// // in order to push the code through svelte's compiler, we need to first
	// // handle the typescript source code
	// const processed = await preprocess(content, [
	// 	{
	// 		script({ content: fileContents }) {
	// 			const { outputText: code } = typescript.transpileModule(fileContents, {})
	// 			return {
	// 				code,
	// 			}
	// 		},
	// 	},
	// ])

	// // run the processed source through svelte's compiler to pull out the instance and module
	// return parse(processed.code)

	const fakePreprocessor = {
		async script({ content: input }) {
			return {
				code: Array(input.length)
					.fill()
					.map(() => ' ')
					.join(''),
			}
		},
	}

	const fakePreprocessed = await preprocess(content, fakePreprocessor, { filename: 'App.ts' })
	const fakeParsed = parse(fakePreprocessed.code)

	const preprocessed = await preprocess(content, sveltePreprocess(), { filename: 'App.ts' })
	const parsed = parse(preprocessed.code)

	const processScriptBlock = (type) => {
		const script = parsed[type]
		if (script) {
			const {start, end} = fakeParsed[type];
			const content = preprocessed.code.substr(script.content.start, script.content.end - script.content.start).trim();
			return {content, start, end}
		}
	}
	return {
		module: processScriptBlock('module'),
		instance: processScriptBlock('instance'),
	}

}
