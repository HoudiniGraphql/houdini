import { testConfigFile } from '../../../test'
import { Cache as _Cache } from '../../cache/cache'
import { Cache } from '../cache'
import type { Record } from '../record'

// the type definition for our test cache
type CacheTypeDef = {
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
					type: Record<CacheTypeDef, 'User'> | null
					args: never
				}
				pets: {
					type: (Record<CacheTypeDef, 'Cat'> | Record<CacheTypeDef, 'User'>)[]
					args: never
				}
				listOfLists: {
					type: (
						| (
								| Record<CacheTypeDef, 'Cat'>
								| Record<CacheTypeDef, 'User'>
								| null
								| (null | Record<CacheTypeDef, 'User'>)[]
						  )[]
						| Record<CacheTypeDef, 'Cat'>
						| Record<CacheTypeDef, 'User'>
						| null
					)[]
					args: never
				}
				users: {
					type: Record<CacheTypeDef, 'User'>[] | null
					args: never
				}
				pet: {
					type: Record<CacheTypeDef, 'Cat'> | Record<CacheTypeDef, 'User'>
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
					type: Record<CacheTypeDef, 'User'>
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
					type: Record<CacheTypeDef, 'User'> | null
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

export const testCache = () => new Cache<CacheTypeDef>(new _Cache(testConfigFile()))
