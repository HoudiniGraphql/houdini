export type Fragment<_Result> = {
	readonly shape: _Result
}

export type Operation<_Result, _Input> = {
	readonly result: _Result
	readonly input: _Input
}

export interface _FragmentRefs<Refs extends string> {
	' $fragments': FragmentRefs<Refs>
}

// a field used to track references to fragments
export type FragmentRefs<Refs extends string> = {
	[ref in Refs]: true
}
