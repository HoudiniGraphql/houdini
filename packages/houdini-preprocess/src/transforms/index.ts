// external imports
import { TransformPipeline } from 'houdini-compiler'

// local imports
import fragmentProcessor from './fragment'
import queryProcessor from './query'
import mutationProcessor from './mutation'
import { TransformDocument } from '../types'

export const defaultTransforms: TransformPipeline<TransformDocument> = {
	transforms: [fragmentProcessor, queryProcessor, mutationProcessor],
}
