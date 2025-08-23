export function dedent(indentString: string, input?: string): string {
	if (input === undefined) {
		input = indentString
		indentString = ''
	}

	const lines = input.split('\n')
	const nonEmptyLines = lines.filter((line) => line.trim())
	const minIndent = Math.min(...nonEmptyLines.map((line) => line.search(/\S/)))

	return (
		indentString +
		lines
			.map((line) => (line.trim() ? indentString + line.slice(minIndent) : line))
			.join('\n')
			.trim()
	)
}
