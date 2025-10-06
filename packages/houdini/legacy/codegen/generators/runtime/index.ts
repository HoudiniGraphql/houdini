import generateGraphqlReturnTypes from './graphqlFunction'

export default async function runtimeGenerator(config: Config, docs: Document[]) {

	await generateGraphqlReturnTypes(config, docs)
}

