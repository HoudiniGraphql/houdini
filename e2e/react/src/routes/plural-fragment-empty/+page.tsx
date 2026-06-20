import PluralUserList from '../plural-fragment/PluralUserList'
import { PageProps } from './$types'

export default ({ features__plural_fragment_empty }: PageProps) => {
	// an empty list should render an empty plural fragment (a [], not null)
	return <PluralUserList users={features__plural_fragment_empty.usersList} />
}
