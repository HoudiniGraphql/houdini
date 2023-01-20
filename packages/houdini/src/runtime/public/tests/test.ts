import { testConfigFile } from '../../../test'
import { Cache as _Cache } from '../../cache/cache'
import { Cache } from '../cache'
import type { Record } from '../record'

// the type definition for our test cache
export type CacheTypeDefTest = {
	types: {
		__ROOT__: {
			idFields: {}
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
