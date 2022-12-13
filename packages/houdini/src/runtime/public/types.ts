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
		}
	}
	lists: {
		[listName: string]: {
			types: any
			when: any
		}
	}
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

export type IDFields<
	Def extends CacheTypeDef,
	Type extends keyof Def['types']
> = Def['types'][Type]['idFields']

export type ProxyUnion<Def extends CacheTypeDef, U> = U extends null
	? null
	: U extends TypeNames<Def>
	? Record<Def, U>
	: never

type _FieldType<
	Def extends CacheTypeDef,
	Type extends keyof Def['types'],
	Field extends keyof TypeFields<Def, Type>
> = TypeFields<Def, Type>[Field]['type']

// - if the result of the field type is a { type: string } then the value of the field is a RecordProxy<Def, string>
// - if the value is { abstract: stringA | stringB }, then the result is a union of those types as proxies
// - if the value is { list: stringA | stringB }, then the result is a list of those types
// - otherwise, just use the type in in the field map
export type FieldType<
	Def extends CacheTypeDef,
	Type extends keyof Def['types'],
	Field extends keyof TypeFields<Def, Type>
> = _FieldType<Def, Type, Field> extends { type: infer Target }
	? ProxyUnion<Def, Target>
	: _FieldType<Def, Type, Field> extends { list: infer Target }
	? ProxyUnion<Def, Target>[]
	: _FieldType<Def, Type, Field>

export type ArgType<
	Def extends CacheTypeDef,
	Type extends keyof Def['types'],
	Field extends keyof TypeFields<Def, Type>
> = TypeFields<Def, Type>[Field]['args']

export type ValidLists<Def extends CacheTypeDef> = Extract<keyof Def['lists'], string>

export type ListWhen<
	Def extends CacheTypeDef,
	ListName extends ValidLists<Def>
> = Def['lists'][ListName]['when'] extends any
	? {
			must?: Def['lists'][ListName]['when']
			must_not?: Def['lists'][ListName]['when']
	  }
	: never

export type ListType<Def extends CacheTypeDef, Name extends ValidLists<Def>> = ProxyUnion<
	Def,
	Def['lists'][Name]['types']
>
