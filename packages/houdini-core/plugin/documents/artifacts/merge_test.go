package artifacts_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/artifacts"
	"code.houdinigraphql.com/plugins/tests"
)

func TestMergeSelections(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
      type Query {
        friends: [User!]!
        user: User!
        node(id: ID!): Node
      } 

      interface Node {
        id: ID!
      }

      type User implements Node & Friend {
        id: ID!
        name: String!
        bestFriend: User! 
        pets(name: String!, filter: PetFilter ): [Pet!]!
      }

      type Cat implements Node & Pet & Friend {
        id: ID!
        owner: User!
        species: String!
        name: String!
      }

      type Ghost implements Node & Friend {
        id: ID!
        name: String!
      }

      type Dog implements Friend { 
        name: String!
      }

      input PetFilter {
        age_gt: Int
      }

      directive @testDirective(if: Boolean) on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION

      directive @test on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION

      interface Pet { 
        owner: User!
      }

      interface Friend { 
        name: String! 
      }

    `,
		PerformTest: func(t *testing.T, p *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			// load the documents into the database
			err := documents.LoadDocuments(context.Background(), p.DB)
			if err != nil {
				require.False(t, test.Pass, err.Error())
				return
			}

			// the extra test content defines what we should expect
			for name, c := range test.Extra {
				content := c.(string)

				conn, err := p.DB.Take(context.Background())
				require.Nil(t, err)
				defer p.DB.Put(conn)

				// the first thing we have to do is collect the artifacts.
				collectedDocs, err := artifacts.CollectDocuments(
					context.Background(),
					p.DB,
					conn,
					true,
				)
				require.Nil(t, err)

				// merge the selection before we print so we can easily write the tests
				collected, err := artifacts.FlattenSelection(
					context.Background(),
					collectedDocs,
					name,
					true,
					true,
				)
				require.Nil(t, err)

				// merge the selections and update the docs to test against
				collectedDocs.Selections[name].Selections = collected
				printed := artifacts.PrintCollectedDocument(collectedDocs.Selections[name], true)

				require.Equal(t, content, printed)
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Apply fragment selections",
				Pass: true,
				Input: []string{
					`
            query MyQuery($name: String) {
                user(name: $name) {
                    id
                    ...Foo
                } 
            }
          `,
					`
            fragment Foo on User { 
                name
                pets {
                    ... on Cat { 
                        id
                    }
                }
            }
          `,
				},
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
            query MyQuery($name: String) {
                user(name: $name) {
                    id
                    name
                    pets {
                        ... on Cat {
                            id
                        }
                    }
                    ...Foo
                }
            }
          `),
				},
			},
			{
				Name: "Merges field selection",
				Pass: true,
				Input: []string{
					`
            query MyQuery {
              user {
                id
              }
              user { 
                name
                pets {
                    ... on Cat { 
                        id
                    }
                }
              }
            }
          `,
				},
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
            query MyQuery {
                user {
                    id
                    name
                    pets {
                        ... on Cat {
                            id
                        }
                    }
                }
            }
          `),
				},
			},
			{
				Name: "Merges directives applied to fields",
				Pass: true,
				Input: []string{
					`
            query MyQuery {
              user {
                id @deprecated(reason:"Test")
                id @optimisticKey
              }
            }
          `,
				},
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
            query MyQuery {
                user {
                    id @deprecated(reason: "Test") @optimisticKey
                }
            }
          `),
				},
			},
			{
				Name: "Flattens nested inline fragments",
				Pass: true,
				Input: []string{
					`
            query MyQuery {
              friends {
                ... on Friend {
                  name
                  ... on User {
                    id
                    bestFriend { name }
                  }
                  ... on Ghost {
                    id
                  }
                  ... on Cat {
                    id
                    owner { name }
                  }
                }
                ... on Cat {
                  name
                }
              }
            }
        `,
				},
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
            query MyQuery {
                friends {
                    ... on Cat {
                        id
                        name
                        owner {
                            name
                        }
                    }
                    ... on Friend {
                        name
                    }
                    ... on Ghost {
                        id
                        name
                    }
                    ... on User {
                        bestFriend {
                            name
                        }
                        id
                        name
                    }
                }
            }
          `),
				},
			},
			{
				Name: "Flattens referenced fragments (hoist)",
				Pass: true,
				Input: []string{
					`
            query MyQuery {
              friends {
                ... on Friend {
                  name
                  ... Foo
                }
              }
            }
          `,
					`
            fragment Foo on User { 
                name
                pets {
                    ... on Cat { 
                        id
                    }
                }
            }
          `,
				},
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
              query MyQuery {
                  friends {
                      ... on Friend {
                          name
                          ... on User {
                              name
                              pets {
                                  ... on Cat {
                                      id
                                  }
                              }
                          }
                          ...Foo
                      }
                      ...Foo
                  }
              }
          `),
				},
			},
			{
				Name: "Fragments on mismatched types end up as inline fragments",
				Pass: true,
				Input: []string{
					`
            query MyQuery {
              user { 
                pets { 
                  ...CatInfo
                }
              }
            }
          `,
					`
            fragment CatInfo on Cat { 
                id
            }
          `,
				},
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
            query MyQuery {
                user {
                    pets {
                        ... on Cat {
                            id
                        }
                        ...CatInfo
                    }
                }
            }
          `),
				},
			},
			{
				Name: "Nested fragments",
				Pass: true,
				Input: []string{
					`
            query MyQuery {
                user {
                    id
                    name
                    pets {
                        ...CatInfo
                    }
                }
            }
          `,
					`
            fragment CatInfo on Cat {
                id
                name
                owner { 
                    id
                    bestFriend { 
                        name
                    }
                    ...UserInfo
                }
            }
          `,
					`
            fragment UserInfo on User {
                name
                bestFriend { 
                    id
                }
            }
          `,
				},
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
              query MyQuery {
                  user {
                      id
                      name
                      pets {
                          ... on Cat {
                              id
                              name
                              owner {
                                  bestFriend {
                                      id
                                      name
                                  }
                                  id
                                  name
                                  ...UserInfo
                              }
                          }
                          ...CatInfo
                      }
                  }
              }
          `),
				},
			},
			{
				Name: "Ensure a concrete selection per type",
				Pass: true,
				Input: []string{
					`
            query MyQuery {
              node(id: "123") {
                ... on User { 
                    bestFriend { name }
                }
                ... on Cat {
                    owner { 
                        name
                    }
                }
                ... on Friend { 
                    name
                }
                ... on Pet { 
                    name
                    owner { 
                        bestFriend { 
                            name 
                        }
                    }
                }
                id
              }
            }
          `,
				},
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
              query MyQuery {
                  node(id: "123") {
                      id
                      ... on Cat {
                          id
                          name
                          owner {
                              bestFriend {
                                  name
                              }
                              name
                          }
                      }
                      ... on Friend {
                          id
                          name
                      }
                      ... on Pet {
                          id
                          name
                          owner {
                              bestFriend {
                                  name
                              }
                          }
                      }
                      ... on User {
                          bestFriend {
                              name
                          }
                          id
                          name
                      }
                  }
              }
          `),
				},
			},
			{
				Name: "Fragment on abstract type inside of inline fragment doesn't affect global selection",
				Pass: true,
				Input: []string{
					`
          query CatInfo {
            node(id: "123") {
              id
              ... on Cat {
                ...AnimalInfo
              }
            }
          }
          `,
					`
          fragment AnimalInfo on Pet {
            owner {
               name
            }
          }
          `,
				},
				Extra: map[string]any{
					"CatInfo": tests.Dedent(`
            query CatInfo {
                node(id: "123") {
                    id
                    ... on Cat {
                        id
                        owner {
                            name
                        }
                        ...AnimalInfo
                    }
                    ...AnimalInfo
                }
            }
          `),
				},
			},
			{
				Name: "Overlaping interfaces add entry for concrete type",
				Pass: true,
				Input: []string{
					`
            query MyQuery {
              node(id: "123") {
                ... on Friend { 
                    name
                }
                ... on Pet { 
                    owner { 
                        bestFriend { 
                            name 
                        }
                    }
                }
                id
              }
            }
          `,
				},
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
              query MyQuery {
                  node(id: "123") {
                      id
                      ... on Cat {
                          id
                          name
                          owner {
                              bestFriend {
                                  name
                              }
                          }
                      }
                      ... on Friend {
                          id
                          name
                      }
                      ... on Pet {
                          id
                          owner {
                              bestFriend {
                                  name
                              }
                          }
                      }
                  }
              }
          `),
				},
			},
		},
	})
}
