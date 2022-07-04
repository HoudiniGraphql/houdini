import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'

// the enum generator creates runtime definitions and centralizes the type definitions in a
// single place to avoid conflicting exported types
export default async function enumGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// grab every enum definition in the project's schema
	// const enums = config.schema.astNode!.
}
