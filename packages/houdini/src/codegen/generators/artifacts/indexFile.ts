import { Config, fs, CollectedGraphQLDocument, path } from '../../../lib'
import { cjsIndexFilePreamble, exportDefaultFrom } from '../../utils'

export default async function writeIndexFile(config: Config, docs: CollectedGraphQLDocument[]) {
	const docsToGenerate = docs
		.filter((doc) => doc.generateArtifact)
		.sort((a, b) => a.name.localeCompare(b.name))

	// we want to export every artifact from the index file.
	let body =
		config.module === 'esm'
			? docsToGenerate.reduce(
					(content, doc) =>
						content + `\n export { default as ${doc.name}} from './${doc.name}'`,
					''
			  )
			: docsToGenerate.reduce(
					(content, doc) => content + `\n${exportDefaultFrom(`./${doc.name}`, doc.name)}`,
					cjsIndexFilePreamble
			  )

	// write the result to the artifact path we're configured to write to
	await fs.writeFile(path.join(config.artifactDirectory, 'index.js'), body)
}
