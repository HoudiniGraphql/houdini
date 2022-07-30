import type { Program } from '@babel/types'
import { Config } from './config'

export type Maybe<T> = T | null | undefined

export type Script = {
	content: Program
	start: number
	end: number
}

export type TransformDocument = {
	instance: Maybe<Script>
	module: Maybe<Script>
	config: Config
	dependencies: string[]
	filename: string
}
