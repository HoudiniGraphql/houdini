// strip_named_export removes a top-level named export (declaration or specifier)
// from a parsed program in place. It is used to drop the server-only headers()
// export of a +page/+layout from the client build.
export function strip_named_export(script: any, name: string): void {
	const body = script.body
	for (let i = body.length - 1; i >= 0; i--) {
		const node = body[i]
		if (node.type !== 'ExportNamedDeclaration') {
			continue
		}

		// export function headers() {} / export const headers = ...
		if (node.declaration) {
			const decl = node.declaration
			if (decl.type === 'FunctionDeclaration' && decl.id?.name === name) {
				body.splice(i, 1)
				continue
			}
			if (decl.type === 'VariableDeclaration') {
				decl.declarations = decl.declarations.filter(
					(d: any) => !(d.id?.type === 'Identifier' && d.id.name === name)
				)
				if (decl.declarations.length === 0) {
					body.splice(i, 1)
				}
				continue
			}
			continue
		}

		// export { headers } / export { foo as headers }
		if (node.specifiers?.length) {
			node.specifiers = node.specifiers.filter((s: any) => s.exported?.name !== name)
			if (node.specifiers.length === 0) {
				body.splice(i, 1)
			}
		}
	}
}
