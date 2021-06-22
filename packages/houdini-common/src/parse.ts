import { parse, preprocess } from 'svelte/compiler'
import sveltePreprocess from 'svelte-preprocess'

export async function parseFile(content: string): Promise<Ast> {
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
