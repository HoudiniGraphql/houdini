import type { GraphQLObject } from '$houdini';

export function applyPatch<_Source extends GraphQLObject>(source: _Source, patch: any): _Source {
	return source;
}
