// external imports
import { Pipeline } from 'houdini-common'
// local imports
import { TransformDocument } from '../types'
import fragmentProcessor from './fragment'
import queryProcessor from './query'
import mutationProcessor from './mutation'

export const defaultTransforms: Pipeline<TransformDocument> = [
	fragmentProcessor,
	queryProcessor,
	mutationProcessor,
]
