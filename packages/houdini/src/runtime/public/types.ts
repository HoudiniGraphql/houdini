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

// if the result of the field type is a {target: string} then the value of the field
// is a RecordProxy<Def, string>. Otherwise, just use the type in in the field map
export type FieldType<
	Def extends CacheTypeDef,
	Type extends keyof Def['types'],
	Field extends keyof Def['types'][Type]['fields']
> = Def['types'][Type]['fields'][Field]['type'] extends { target: infer Target }
	? RecordProxy<Def, Target extends string ? Target : never>
	: Def['types'][Type]['fields'][Field]['type']

export type ArgType<
	Def extends CacheTypeDef,
	Type extends keyof Def['types'],
	Field extends keyof Def['types'][Type]['fields']
> = Def['types'][Type]['fields'][Field]['args']
