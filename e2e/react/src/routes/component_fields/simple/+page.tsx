import { PageProps } from './$types'
import UserInfo from './UserInfo'

export default ({ features__component_fields__simple }: PageProps) => {
	return (
		<div>
			{features__component_fields__simple.usersList.map((user) => {
				return (
					<div key={user.name}>
						<UserInfo user={user} />
					</div>
				)
			})}
		</div>
	)
}
