import type { Program } from '@babel/types'

export type Maybe<T> = T | null | undefined

export type Script = {
	content: Program
	start: number
	end: number
}

export enum CachePolicy {
	CacheOrNetwork = 'CacheOrNetwork',
	CacheOnly = 'CacheOnly',
	NetworkOnly = 'NetworkOnly',
	CacheAndNetwork = 'CacheAndNetwork',
}
