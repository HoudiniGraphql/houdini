import * as recast from 'recast'

import { Config } from './config'

type Program = recast.types.namedTypes.Program

export type Maybe<T> = T | null | undefined

export type Script = Program

export type TransformDocument = {
	instance: Maybe<Script>
	config: Config
	dependencies: string[]
	filename: string
}
