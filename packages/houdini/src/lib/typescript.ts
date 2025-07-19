import type { StatementKind, TSTypeKind } from 'ast-types/lib/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import type { Config } from './config'
import * as fs from './fs'
import { unwrapType, TypeWrapper } from './graphql'
import { ensureImports } from './imports'
import * as path from './path'

const AST = recast.types.builders

export function unwrappedTsTypeReference(
	config: Config,
	filepath: string,
	missingScalars: Set<string>,
	{
		type,
		wrappers,
	}: {
		type: graphql.GraphQLNamedType
		wrappers: TypeWrapper[]
	},
	body: StatementKind[]
) {
	// convert the inner type
	let result
	// if we're looking at a scalar
	if (graphql.isScalarType(type)) {
		result = scalarPropertyValue(config, filepath, missingScalars, type, body, null)
	}
	//  enums need to be passed to ValueOf
	else if (graphql.isEnumType(type)) {
		result = enumReference(config, body, type.name)
	}
	// we're looking at an object
	else {
		// the fields of the object end up as properties in the type literal
		result = AST.tsTypeReference(AST.identifier(type.name))
	}
	for (const toWrap of wrappers) {
		// if its a non-null we don't need to add anything
		if (toWrap === TypeWrapper.NonNull) {
			continue
		} else if (toWrap === TypeWrapper.Nullable) {
			result = nullableField(result, true)
		}
		// it could be a list
		else if (toWrap === TypeWrapper.List) {
			result = AST.tsArrayType(AST.tsParenthesizedType(result))
		}
	}

	return result
}

// return the property
export function tsTypeReference(
	config: Config,
	filepath: string,
	missingScalars: Set<string>,
	definition: {
		type:
			| graphql.GraphQLScalarType
			| graphql.GraphQLInputType
			| graphql.GraphQLNamedType
			| graphql.TypeNode
	},
	body: StatementKind[]
): TSTypeKind {
	const { type, wrappers } = unwrapType(config, definition.type)

	return unwrappedTsTypeReference(
		config,
		filepath,
		missingScalars,
		{ type: type, wrappers },
		body
	)
}

export function enumReference(config: Config, body: StatementKind[], name: string) {
	// if we looking at an enum we need ValueOf<enum>
	ensureImports({
		config,
		body,
		import: ['ValueOf'],
		importKind: 'type',
		sourceModule: '$houdini/runtime/lib/types',
	})
	return AST.tsTypeReference(
		AST.identifier('ValueOf'),
		AST.tsTypeParameterInstantiation([AST.tsTypeQuery(AST.identifier(name))])
	)
}

export function readonlyProperty(
	prop: recast.types.namedTypes.TSPropertySignature,
	enable: boolean = true
): recast.types.namedTypes.TSPropertySignature {
	if (enable) {
		prop.readonly = true
	}
	return prop
}

export function nullableField(inner: TSTypeKind, input = false) {
	// the members of the union
	const members = [inner, AST.tsNullKeyword()]
	if (input) {
		members.push(AST.tsUndefinedKeyword())
	}

	return AST.tsUnionType(members)
}

export function scalarPropertyValue(
	config: Config,
	filepath: string,
	missingScalars: Set<string>,
	target: graphql.GraphQLNamedType,
	body: StatementKind[],
	field: { parent: string; field: string } | null
): TSTypeKind {
	// before we get to the generic behavior, let's process components when we want to
	if (config.configFile.features?.componentFields && target.name === config.componentScalar) {
		// if we are importing a component we need to make sure we have a reference to
		// component
		if (!field) {
			return AST.tsNeverKeyword()
		}

		// look up the component field information
		const component = config.componentFields[field.parent][field.field]
		const sourcePathRelative = path.relative(
			path.join(config.projectRoot, 'src'),
			component.filepath
		)

		let sourcePathParsed = path.parse(sourcePathRelative)
		let sourcePath = path.join(sourcePathParsed.dir, sourcePathParsed.name)

		// add the import
		const localImport =
			ensureImports({
				config,
				body,
				import: '__component__' + component.fragment,
				sourceModule: path.join(
					path.relative(path.dirname(filepath), config.projectRoot),
					'src',
					sourcePath
				),
			}) ?? '__component__' + component.fragment

		// build up the AST for the parameter type
		const parameters = AST.tsTypeReference(AST.identifier('Parameters'))
		parameters.typeParameters = AST.tsTypeParameterInstantiation([
			AST.tsTypeQuery(AST.identifier(localImport)),
		])
		const indexed = AST.tsIndexedAccessType(
			parameters,
			AST.tsLiteralType(AST.numericLiteral(0))
		)
		const omit = AST.tsTypeReference(AST.identifier('Omit'))
		omit.typeParameters = AST.tsTypeParameterInstantiation([
			indexed,
			AST.tsLiteralType(AST.stringLiteral(component.prop)),
		])
		const arg = AST.identifier('props')
		arg.typeAnnotation = AST.tsTypeAnnotation(omit)

		// build up the AST for the return type
		const returnType = AST.tsTypeReference(AST.identifier('ReturnType'))
		returnType.typeParameters = AST.tsTypeParameterInstantiation([
			AST.tsTypeQuery(AST.identifier(localImport)),
		])

		const fnType = AST.tsFunctionType([arg])
		fnType.typeAnnotation = AST.tsTypeAnnotation(returnType)

		return fnType
	}

	switch (target.name) {
		case 'String': {
			return AST.tsStringKeyword()
		}
		case 'Int': {
			return AST.tsNumberKeyword()
		}
		case 'Float': {
			return AST.tsNumberKeyword()
		}
		case 'Boolean': {
			return AST.tsBooleanKeyword()
		}
		case 'ID': {
			return  AST.tsUnionType([AST.tsStringKeyword(), AST.tsNumberKeyword()])
		}
		default: {
			// if we're looking at a non-null type
			if (graphql.isNonNullType(target) && 'ofType' in target) {
				return scalarPropertyValue(
					config,
					filepath,
					missingScalars,
					target.ofType as graphql.GraphQLNamedType,
					body,
					field
				)
			}

			// the type could be a custom scalar we know about
			if (config.scalars?.[target.name]) {
				return AST.tsTypeReference(AST.identifier(config.scalars?.[target.name].type))
			}

			// don't ever consider the Component scalar missing
			if (target.name !== config.componentScalar) {
				missingScalars.add(target.name)
			}

			return AST.tsAnyKeyword()
		}
	}
}

export async function writeTsConfig(config: Config) {
	await fs.mkdirp(config.rootDir)
	await fs.writeFile(
		path.join(config.rootDir, 'tsconfig.json'),
		JSON.stringify(
			{
				compilerOptions: {
					baseUrl: '.',
					paths: {
						$houdini: ['.'],
						'$houdini/*': ['./*'],
						'~': ['../src'],
						'~/*': ['../src/*'],
					},
					rootDirs: ['..', './types'],
					target: 'ESNext',
					useDefineForClassFields: true,
					lib: ['DOM', 'DOM.Iterable', 'ESNext'],
					allowJs: false,
					skipLibCheck: true,
					esModuleInterop: false,
					allowSyntheticDefaultImports: true,
					strict: true,
					forceConsistentCasingInFileNames: true,
					module: 'ESNext',
					moduleResolution: 'Node',
					resolveJsonModule: true,
					isolatedModules: true,
					noEmit: true,
					jsx: 'react-jsx',
				},
				include: [
					'ambient.d.ts',
					'./types/**/$types.d.ts',
					'../vite.config.ts',
					'../src/**/*.js',
					'../src/**/*.ts',
					'../src/**/*.jsx',
					'../src/**/*.tsx',
					'../src/+app.d.ts',
				],
				exclude: ['../node_modules/**', './[!ambient.d.ts]**'],
			},
			null,
			4
		)
	)
}
