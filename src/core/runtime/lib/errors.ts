export function errorsToGraphQLLayout(errors: string | string[]) {
	if (Array.isArray(errors)) {
		return errors.map((error) => {
			return { message: error }
		})
	}
	return [{ message: errors }]
}
