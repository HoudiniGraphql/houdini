/**
 * Check if a file has changed graphql documents
 * @param source the source code of the file
 * @param previousDocuments previous documents
 * @returns [documents changed?, new documents object]
 */
export function graphQLDocumentsChanged(
	source: string,
	previousDocuments: Record<string, string> | undefined
): [boolean, Record<string, string>] {
	const newDocuments = extractDocuments(source)
	if (previousDocuments === undefined) return [true, newDocuments]
	const newNames = Object.keys(newDocuments)
	const oldNames = Object.keys(previousDocuments)

	if (newNames.length !== oldNames.length) return [true, newDocuments]

	return [
		!newNames.every(
			(key) => key in previousDocuments && previousDocuments[key] === newDocuments[key]
		),
		newDocuments,
	]
}

/**
 * Extract graphql documents from graphql(`...`) calls in the file
 * does not attempt to do ast-level parsing, so that Svelte components, JSX and whatever else is supported, and the function stays fast.
 * @param source the source code
 * @returns an object mapping document names to their content
 */
export function extractDocuments(source: string): Record<string, string> {
	let extracted: Record<string, string> = {}
	for (const document of extractGraphQLStrings(source)) {
		const name = extractGraphQLDocumentName(document)
		if (!name) throw new Error('❌ All GraphQL documents must be named for Houdini to work')
		extracted[name] = document
	}
	return extracted
}

/**
 * Extracts the name of a GraphQL document (operation or fragment)
 * @param documentString The GraphQL document string
 * @returns The name of the document or null if no name is found
 * @throws Error if the document type cannot be determined
 */
export function extractGraphQLDocumentName(documentString: string): string | null {
	// Remove comments and normalize whitespace
	const normalized = documentString
		.replace(/#.*$/gm, '') // Remove line comments
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim()

	// Match patterns for different document types
	const patterns = {
		query: /(?:query|mutation|subscription)\s+([_A-Za-z][_0-9A-Za-z]*)/,
		fragment: /fragment\s+([_A-Za-z][_0-9A-Za-z]*)\s+on\s+/,
	}

	// Try to match operation definition
	const operationMatch = normalized.match(patterns.query)
	if (operationMatch) {
		return operationMatch[1]
	}

	// Try to match fragment definition
	const fragmentMatch = normalized.match(patterns.fragment)
	if (fragmentMatch) {
		return fragmentMatch[1]
	}

	return null
}

/**
 * Extracts strings from graphql() function calls in text
 * @param text The source text to extract GraphQL strings from
 * @returns Array of extracted GraphQL strings
 */
export function extractGraphQLStrings(text: string): string[] {
	const results: string[] = []
	let currentIndex = 0

	// eslint-disable-next-line no-constant-condition
	while (true) {
		// Find the start of a graphql function call
		const callStart = text.indexOf('graphql(', currentIndex)
		if (callStart === -1) break

		// Move past 'graphql('
		let pos = callStart + 'graphql('.length
		let openParens = 1 // Count of nested parentheses
		let stringStart = -1
		let isEscaping = false
		let currentString = ''

		// Parse until we find the closing parenthesis of the graphql call
		while (pos < text.length && openParens > 0) {
			const char = text[pos]

			if (stringStart === -1) {
				// Not inside a string yet
				if (char === '`' || char === '"' || char === "'") {
					stringStart = pos
					currentString = ''
				} else if (char === '(') {
					openParens++
				} else if (char === ')') {
					openParens--
				}
			} else {
				// Inside a string
				const stringChar = text[stringStart]

				if (isEscaping) {
					currentString += char
					isEscaping = false
				} else if (char === '\\') {
					isEscaping = true
				} else if (char === stringChar) {
					// String ended
					results.push(currentString)
					stringStart = -1
				} else {
					currentString += char
				}
			}

			pos++
		}

		currentIndex = pos
	}

	return results.map((result) => result.trim())
}
