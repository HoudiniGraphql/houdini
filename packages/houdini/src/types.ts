export type Fragment<_Result> = {
	readonly shape?: _Result
}

export type Operation<_Result, _Input> = {
	readonly result: _Result
	readonly input: _Input
}
