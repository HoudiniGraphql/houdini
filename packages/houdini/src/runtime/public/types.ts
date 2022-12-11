import type { RecordProxy } from './record'

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
			types: string[]
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

export type IDFields<
	Def extends CacheTypeDef,
	Type extends keyof Def['types']
> = Def['types'][Type]['idFields']

// if the result of the field type is a {target: string} then the value of the field
// is a RecordProxy<Def, string>. Otherwise, just use the type in in the field map
export type FieldType<
	Def extends CacheTypeDef,
	Type extends keyof Def['types'],
	Field extends keyof TypeFields<Def, Type>
> = TypeFields<Def, Type>[Field]['type'] extends { target: infer Target }
	? RecordProxy<Def, Target extends string ? Target : never>
	: TypeFields<Def, Type>[Field]['type']

export type ArgType<
	Def extends CacheTypeDef,
	Type extends keyof Def['types'],
	Field extends keyof TypeFields<Def, Type>
> = TypeFields<Def, Type>[Field]['args']
