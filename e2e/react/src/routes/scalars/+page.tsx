import { PageProps } from './$types'

export default ({ scalar_test }: PageProps) => {
	return scalar_test.usersList.map((user) => (
		<div key={user.name}>
			{user.name} - {user.birthDate?.toLocaleDateString()}
		</div>
	))
}
