import * as recast from 'recast'
const typeBuilders = recast.types.builders

export default function memberExpression(root: string, next: string, ...rest: string[]) {
	// the object we are accessing
	let target = typeBuilders.memberExpression(
		typeBuilders.identifier(root),
		typeBuilders.identifier(next)
	)
	for (const member of rest) {
		target = typeBuilders.memberExpression(target, typeBuilders.identifier(member))
	}

	return target
}
