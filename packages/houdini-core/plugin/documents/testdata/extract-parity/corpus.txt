import { graphql } from '$houdini'

// graphql(`query CommentedOut { nope }`)
/* graphql(`query BlockCommented {
	nope
}`) */
const inline = graphql(`
	query OnALine {
		user
	}
`)

const single = graphql(`query Single { field }`)

// both extractors leave string contents intact, so this is (deliberately) found
const locked = "graphql(`query InsideString { locked }`)"

const escaped = graphql(`query Escaped { field(arg: "\`tick\`") }`)

type Props = {
	user: GraphQL<`
		fragment CorpusAvatar on User {
			name
		}
	`>
}
