import { graphql, useMutationForm, useMutationFormStatus } from '$houdini'

// A child of <Form> reads the form's pending state via context — no prop drilling, the
// useFormStatus ergonomic for our forms.
function Submit() {
	const { pending } = useMutationFormStatus()
	return (
		<button type="submit" data-testid="submit" disabled={pending}>
			{pending ? 'Saving…' : 'Create user'}
		</button>
	)
}

export default function FormStatusView() {
	const { Form, state } = useMutationForm(
		graphql(`
			mutation MutationFormStatus($name: String!, $birthDate: DateTime!)
				@endpoint(redirect: "/mutation-form/created?id={ addUser.id }") {
				addUser(
					snapshot: "MutationFormStatus"
					name: $name
					birthDate: $birthDate
					delay: 600
				) {
					id
				}
			}
		`)
	)

	return (
		<Form>
			<input name="name" data-testid="name-input" required />
			<input type="hidden" name="birthDate" value={new Date('2000-01-01').getTime()} />
			<Submit />
			{state?.errors && <p data-testid="error">{state.errors[0].message}</p>}
		</Form>
	)
}
