import { testConfigFile } from '../../../test'
import { Cache as _Cache } from '../../cache/cache'
import {
	ArtifactKind,
	type SubscriptionSelection,
	type FragmentArtifact,
	type QueryArtifact,
} from '../../lib'
import { Cache } from '../cache'
import type { Record } from '../record'

// the type definition for our test cache
export type CacheTypeDefTest = {
	types: {
		__ROOT__: {
			idFields: {}
			fragments: []
			fields: {
				test: {
					type: number | null
					args: never
				}
				testDate: {
					type: Date
					args: never
				}
				viewer: {
					type: Record<CacheTypeDefTest, 'User'> | null
					args: never
				}
				pets: {
					type: (Record<CacheTypeDefTest, 'Cat'> | Record<CacheTypeDefTest, 'User'>)[]
					args: never
				}
				listOfLists: {
					type: (
						| (
								| Record<CacheTypeDefTest, 'Cat'>
								| Record<CacheTypeDefTest, 'User'>
								| null
								| (null | Record<CacheTypeDefTest, 'User'>)[]
						  )[]
						| Record<CacheTypeDefTest, 'Cat'>
						| Record<CacheTypeDefTest, 'User'>
						| null
					)[]
					args: never
				}
				users: {
					type: Record<CacheTypeDefTest, 'User'>[] | null
					args: never
				}
				pet: {
					type: Record<CacheTypeDefTest, 'Cat'> | Record<CacheTypeDefTest, 'User'>
					args: never
				}
			}
		}
		User: {
			idFields: {
				id: string
			}
			fragments: [
				[{ artifact: FragmentArtifact }, { firstName: string }, { pattern: string }]
			]
			fields: {
				firstName: {
					type: string
					args: never
				}
				parent: {
					type: Record<CacheTypeDefTest, 'User'>
					args: never
				}
				id: {
					type: string
					args: never
				}
				__typename: {
					type: string
					args: never
				}
			}
		}
		Cat: {
			idFields: {
				id: string
			}
			fragments: []
			fields: {
				name: {
					type: string | null
					args: never
				}
				parent: {
					type: Record<CacheTypeDefTest, 'User'> | null
					args: never
				}
				id: {
					type: string
					args: never
				}
				__typename: {
					type: string
					args: never
				}
			}
		}
		Ghost: {
			idFields: {
				id: string
			}
			fragments: []
			fields: {
				name: {
					type: string | null
					args: never
				}
				__typename: {
					type: string
					args: never
				}
			}
		}
	}
	queries: [
		[
			{ artifact: QueryArtifact },
			{
				viewer: {
					id: string
					firstName: string
					__typename: string
					parent: {
						id: string
						firstName: string
						__typename: string
					}
				}
			},
			any
		]
	]
	lists: {
		All_Pets: {
			types: 'User' | 'Cat'
			filters: never
		}
		All_Users: {
			types: 'User'
			filters: {
				foo?: string
			}
		}
	}
}

export const testCache = () => new Cache<CacheTypeDefTest>(new _Cache(testConfigFile()))

export const testFragment = (selection: SubscriptionSelection): { artifact: FragmentArtifact } => ({
	artifact: {
		kind: ArtifactKind.Fragment,
		hash: '',
		raw: '',
		name: '',
		rootType: 'User',
		selection,
		pluginData: {},
	},
})

export const testQuery = (selection: SubscriptionSelection): { artifact: QueryArtifact } => ({
	artifact: {
		kind: ArtifactKind.Query,
		hash: '',
		raw: '',
		name: '',
		rootType: 'Query',
		selection,
		pluginData: {},
	},
})
