import { PageProps } from './$types'

export default ({ scalar_test }: PageProps) => {
	return scalar_test.usersList.map((user) => user.birthDate?.toISOString?.())
}
