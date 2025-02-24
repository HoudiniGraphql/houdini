package documents_test

import "testing"

var table = []struct {
	Name     string
	Input    string
	Expected string
}{
	{
		Name: "Adds ids to selection sets of objects with them",
		Input: `
			query Friends {
				user {
					firstName
				}
			}
		`,
		Expected: `
			query Friends {
				user {
					firstName
					id
				}
			}
		`,
	},
	{
		Name: "doesn't add id if there isn't one",
		Input: `
			query Friends {
				ghost {
					legends {
						name
					}
				}
			}
		`,
		Expected: `
			query Friends {
				ghost {
					legends {
						name
					}
					name
					aka
				}
			}
		`,
	},
	{

		Name: "adds custom id fields to selection sets of objects with them",
		Input: `
			query Friends {
				ghost {
					name
				}
			}
		`,
		Expected: `
			query Friends {
				ghost {
					name
					aka
				}
			}
		`,
	},
	{
		Name: "adds id fields to inline fragments",
		Input: `
			query Friends {
				entities {
					... on User {
						name
					}
				}
			}
		`,
		Expected: `
			query Friends {
				entities {
					... on User {
						name
						id
					}
					__typename
				}
			}
		`,
	},
}

func TestAddFields(t *testing.T) {

}
