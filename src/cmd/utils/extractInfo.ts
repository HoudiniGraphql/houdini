import { Config, DocumentDefinition, StoreMode } from '../../common'
import { getArg, getDirective } from './graphql'
import * as graphql from 'graphql'

export function extractInfo(
	operations: graphql.OperationDefinitionNode[],
	config: Config,
	filepath: string
) {
	let documentDefinition = DocumentDefinition.External
	if (filepath.endsWith('.svelte')) {
		documentDefinition = config.isRoute(filepath)
			? DocumentDefinition.InlineSvelteRoute
			: DocumentDefinition.InlineSvelteComponent
	} else if (filepath.endsWith('.js') || filepath.endsWith('.ts')) {
		documentDefinition = DocumentDefinition.InlineScript
	} else if (filepath.endsWith('page.gql')) {
		documentDefinition = DocumentDefinition.ExternalRoute
	}

	// store mode 'Isolated' | 'Global' (will be needed in artefacts & stores)
	const houdiniDirective = getDirective(operations, config.houdiniDirective)
	const houdiniStoreModeArg = getArg(filepath, houdiniDirective, config.houdiniStoreModeArg)

	// Apply the store mode we found in the directive or go to the default config value
	let storeMode = StoreMode.Global
	if (houdiniStoreModeArg) {
		storeMode = houdiniStoreModeArg.value as StoreMode
	} else {
		if (documentDefinition === DocumentDefinition.InlineSvelteComponent) {
			storeMode = config.storeModeInlineComponent
		} else {
			storeMode = config.storeMode
		}
	}

	return {
		documentDefinition,
		storeMode,
	}
}
