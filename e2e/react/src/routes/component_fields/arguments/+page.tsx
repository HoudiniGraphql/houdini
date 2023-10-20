import type { PageProps } from './$types'
import CF_A_UserInfo from './CF_A_UserInfo'

export default function ({ features__component_fields__arguments }: PageProps) {
	return (
		<div>
			{features__component_fields__arguments.users.map((user) => {
				return (
					<div key={user.name}>
						<CF_A_UserInfo user={user} />
					</div>
				)
			})}
		</div>
	)
}
