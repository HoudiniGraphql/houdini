import { IdentifierKind } from 'ast-types/gen/kinds'
import { StatementKind } from 'ast-types/gen/kinds'
import { namedTypes } from 'ast-types/gen/namedTypes'
import * as graphql from 'graphql'
import * as recast from 'recast'

import { Config } from '../../../common'
import { TransformPage } from '../../plugin'
import init from './init'
import load from './load'
import session from './session'

export default async function SvelteKitProcessor(config: Config, page: TransformPage) {
	// if we aren't running on a kit project, don't do anything
	if (page.config.framework !== 'kit') {
		return
	}

	await Promise.all([load(page), session(page), init(page)])
}
