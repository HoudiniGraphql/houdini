import * as recast from 'recast'

import { Config } from '../../common'
import { TransformPage } from '../plugin'
import { walk_graphql_tags } from '../walk'

const AST = recast.types.builders

export default async function FragmentProcessor(config: Config, page: TransformPage) {}
