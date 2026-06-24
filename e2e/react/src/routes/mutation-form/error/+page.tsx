import { graphql, useMutationForm } from '$houdini'
import { useState } from 'react'

// The enhanced (client) error path: once hydrated, onSubmit runs the mutation, which the
// resolver forces to error. The form must surface state.errors, fire onError, and stay on
// the page — the @endpoint redirect is suppressed when the result carries errors.
export default function MutationFormErrorView() {
	const [sawOnError, setSawOnError] = useState(false)

	const { Form, state } = useMutationForm(
		graphql(`
			mutation MutationFormError($name: String!, $birthDate: DateTime!)
				@endpoint(redirect: "/mutation-form/created?id={ addUser.id }", fields: ["name", "birthDate"]) {
				addUser(snapshot: "MutationFormError", name: $name, birthDate: $birthDate, force: ERROR) {
					id
				}
			}
		`),
		{ onError: () => setSawOnError(true) }
	)

	return (
		<Form data-testid="user-form">
			<input name="name" data-testid="name-input" required />
			<input type="hidden" name="birthDate" value={new Date('2000-01-01').getTime()} />
			<button type="submit" data-testid="submit">
				Create user
			</button>
			{state?.errors && (
				<p role="alert" data-testid="error">
					{state.errors[0].message}
				</p>
			)}
			{sawOnError && <span data-testid="on-error">onError fired</span>}
		</Form>
	)
}
