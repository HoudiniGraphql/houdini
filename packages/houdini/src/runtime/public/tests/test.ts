import { testConfigFile } from '../../../test'
import { Cache as _Cache } from '../../cache/cache'
import { Cache } from '../cache'

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
					type: { type: 'User' }
					args: never
				}
				pets: {
					type: { list: 'Cat' | 'User' }
					args: never
				}
				pet: {
					type: { type: 'Cat' | 'User' }
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
					type: { type: 'User' }
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
					type: { type: 'User' | null }
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
			when: never
		}
		All_Users: {
			types: 'User'
			when: {
				foo?: string
			}
		}
	}
}

export const testCache = () => new Cache<CacheTypeDef>(new _Cache(testConfigFile()))
