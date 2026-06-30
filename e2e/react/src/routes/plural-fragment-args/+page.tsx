import { PageProps } from './$types'
import PluralArgsList from './PluralArgsList'

export default ({ features__plural_fragment_args }: PageProps) => {
	return <PluralArgsList users={features__plural_fragment_args.usersList} />
}
