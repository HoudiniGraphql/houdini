import type { Record } from './record'

export type CacheTypeDef = {
	types: {
		[typeName: string]: {
			idFields: {
				[fieldName: string]: any
			}
			fields: {
				[fieldName: string]: {
					args: any
					type: any
				}
			}
			// the fragments we know about are passed as a list of pairs
			// that map the tag return type to the data shape and input
			fragments: [any, any, any][]
		}
	}
	lists: {
		[listName: string]: {
			types: any
			filters: any
		}
	}
	// we need to map query tag values to their result
	// to pass be able to pass queries to the read and write methods
	// entries in the tuple are graphql tag, query shape, query input
	queries: [any, any, any][]
}

export type ValidTypes<Def extends CacheTypeDef> = keyof Def['types']

export type TypeFields<
	Def extends CacheTypeDef,
	Type extends keyof Def['types']
> = Def['types'][Type]['fields']

export type TypeFieldNames<
	Def extends CacheTypeDef,
	Type extends keyof Def['types']
	// Extract is necessary because javascript allows numbers to be used as strings when indexing objects
	// for more information: https://stackoverflow.com/questions/51808160/keyof-inferring-string-number-when-key-is-only-a-string
> = Extract<keyof TypeFields<Def, Type>, string>

export type TypeNames<Def extends CacheTypeDef> = Extract<
	Exclude<ValidTypes<Def>, '__ROOT__'>,
	string
>

export type FragmentList<
	Def extends CacheTypeDef,
	Type extends ValidTypes<Def>
> = Def['types'][Type]['fragments']

export type QueryList<Def extends CacheTypeDef> = Def['queries']

export type IDFields<
	Def extends CacheTypeDef,
	Type extends keyof Def['types']
> = Def['types'][Type]['idFields']

export type ProxyUnion<Def extends CacheTypeDef, U> = U extends null
	? null
	: U extends TypeNames<Def>
	? Record<Def, U>
	: never

export type FieldType<
	Def extends CacheTypeDef,
	Type extends keyof Def['types'],
	Field extends keyof TypeFields<Def, Type>
> = TypeFields<Def, Type>[Field]['type']

export type ArgType<
	Def extends CacheTypeDef,
	Type extends keyof Def['types'],
	Field extends keyof TypeFields<Def, Type>
> = TypeFields<Def, Type>[Field]['args']

export type ValidLists<Def extends CacheTypeDef> = Extract<keyof Def['lists'], string>

export type ListFilters<
	Def extends CacheTypeDef,
	ListName extends ValidLists<Def>
> = Def['lists'][ListName]['filters'] extends any
	? {
			must?: Def['lists'][ListName]['filters']
			must_not?: Def['lists'][ListName]['filters']
	  }
	: never

export type ListType<Def extends CacheTypeDef, Name extends ValidLists<Def>> = ProxyUnion<
	Def,
	Def['lists'][Name]['types']
>

// This same structure is repeated because when I dry'd the structure to
//
// type FragmentDefinition<_List, _Index, _Target>
// type FragmentVariables<_Def, _Type, _Target> = FragmentDefinition<FragmentList<...>>
//
// then typescript wasn't responding on every change... Having the duplication makes
// it very responsive.

export type FragmentVariables<_List, _Target> = _List extends [infer Head, ...infer Rest]
	? Head extends [infer _Key, infer _Value, infer _Input]
		? _Key extends _Target
			? _Input
			: FragmentValue<Rest, _Target>
		: 'Encountered unknown fragment. Please make sure your runtime is up to date (ie, `vite dev` or `vite build`).'
	: 'Encountered unknown fragment. Please make sure your runtime is up to date (ie, `vite dev` or `vite build`).'

export type FragmentValue<List, _Target> = List extends [infer Head, ...infer Rest]
	? Head extends [infer _Key, infer _Value, infer _Input]
		? _Key extends _Target
			? _Value
			: FragmentValue<Rest, _Target>
		: 'Encountered unknown fragment. Please make sure your runtime is up to date (ie, `vite dev` or `vite build`).'
	: 'Encountered unknown fragment. Please make sure your runtime is up to date (ie, `vite dev` or `vite build`).'

export type QueryValue<List, _Target> = List extends [infer Head, ...infer Rest]
	? Head extends [infer _Key, infer _Value, infer _Input]
		? _Key extends _Target
			? _Value
			: QueryValue<Rest, _Target>
		: 'Encountered unknown query'
	: 'Encountered unknown query'

export type QueryInput<List, _Target> = List extends [infer Head, ...infer Rest]
	? Head extends [infer _Key, infer _Value, infer _Input]
		? _Key extends _Target
			? _Input
			: QueryValue<Rest, _Target>
		: 'Encountered unknown query'
	: 'Encountered unknown query'
