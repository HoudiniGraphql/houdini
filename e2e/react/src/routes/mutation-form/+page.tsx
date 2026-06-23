import { graphql, useMutationForm } from '$houdini'

// A progressively-enhanced form over a mutation: it submits natively (a real POST) before
// or without JavaScript, and once hydrated the same form runs the mutation client-side.
// @endpoint(redirect:) bakes the same target into both paths.
export default function MutationFormView() {
	const { form, hidden, state, pending } = useMutationForm(
		graphql(`
			mutation MutationFormCreate($name: String!, $birthDate: DateTime!)
				@endpoint(redirect: "/mutation-form/created?id={ addUser.id }", fields: ["name", "birthDate"]) {
				addUser(snapshot: "MutationForm", name: $name, birthDate: $birthDate) {
					id
					name
				}
			}
		`)
	)

	return (
		<form {...form} data-testid="user-form">
			{hidden}
			<input name="name" data-testid="name-input" required />
			{/* DateTime is a custom scalar; the hidden timestamp exercises scalar coercion */}
			<input type="hidden" name="birthDate" value={new Date('2000-01-01').getTime()} />
			<button type="submit" data-testid="submit" disabled={pending}>
				{pending ? 'Saving…' : 'Create user'}
			</button>
			{state?.errors && (
				<p role="alert" data-testid="error">
					{state.errors[0].message}
				</p>
			)}
		</form>
	)
}
