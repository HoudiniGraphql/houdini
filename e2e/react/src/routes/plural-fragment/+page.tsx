import { PageProps } from './$types'
import PluralUserList from './PluralUserList'

export default ({ features__plural_fragment }: PageProps) => {
	return <PluralUserList users={features__plural_fragment.usersList} />
}
