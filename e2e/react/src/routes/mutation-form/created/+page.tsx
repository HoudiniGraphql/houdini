import { useRoute, type GenericRoute } from '$houdini'

// The @endpoint redirect target. It reads the created id from the search param the
// redirect interpolated, so the test can prove the mutation ran and the redirect landed —
// on both the no-JS (303) and the enhanced (client goto) paths.
export default function MutationFormCreatedView() {
	const { search } = useRoute<GenericRoute<{ id?: string }>>()
	return <p data-testid="created-id">Created: {search.id ?? '(none)'}</p>
}
