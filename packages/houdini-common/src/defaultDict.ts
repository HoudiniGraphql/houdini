export class DefaultDict<_Value> {
	[key: string]: _Value

	constructor(defaultVal: _Value) {
		return new Proxy(
			{},
			{
				get: (target: { [key: string]: _Value }, name: string) =>
					name in target ? target[name] : defaultVal,
			}
		)
	}
}
