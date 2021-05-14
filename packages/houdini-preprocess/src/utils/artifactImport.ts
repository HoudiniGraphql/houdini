import { Config } from 'houdini-common'
import * as recast from 'recast'
import { Statement } from '@babel/types'
import artifactIdentifier from './artifactIdentifier'

const AST = recast.types.builders

export default function artifactImport(config: Config, { name }: { name: string }): Statement {
	// the kind of import depends on the mode
	const importStatement = AST.importDefaultSpecifier

	return {
		type: 'ImportDeclaration',
		// @ts-ignore
		source: AST.literal(config.artifactImportPath(name)),
		specifiers: [
			// @ts-ignore
			importStatement(AST.identifier(artifactIdentifier({ name }))),
		],
	}
}
