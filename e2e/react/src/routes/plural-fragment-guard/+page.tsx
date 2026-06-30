import { PageProps } from './$types'
import GuardList from './GuardList'

export default ({ features__plural_fragment_guard }: PageProps) => {
	// pass the whole list to a non-plural fragment on purpose
	return <GuardList users={features__plural_fragment_guard.usersList} />
}
