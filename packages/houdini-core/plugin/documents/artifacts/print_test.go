package artifacts_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/artifacts"
	"code.houdinigraphql.com/plugins/tests"
)

func TestDocumentCollectAndPrint(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
      type Query {
        user: User!
        node(id: ID!): Node
      } 

      interface Node {
        id: ID!
}

      type User implements Node {
        id: ID!
        pets(name: String!, filter: PetFilter ): [Pet!]!
      }

      type Cat implements Node {
        id: ID!
      }

      input PetFilter {
        age_gt: Int
      }

      directive @testDirective(if: Boolean) on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION

      directive @test on ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION

      union Pet = Cat

    `,
		PerformTest: func(t *testing.T, p *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			// load the documents into the database
			err := documents.LoadDocuments(context.Background(), p.DB)
			if err != nil {
				require.False(t, test.Pass, err.Error())
				return
			}

			search := "SELECT id FROM documents WHERE name = $name"

			// the extra test content defines what we should expect
			for name, c := range test.Extra {
				content := c.(string)

				// look up the id of the document with the matching name
				var documentID int64
				p.DB.StepQuery(
					context.Background(),
					search,
					map[string]any{"name": name},
					func(q *sqlite.Stmt) {
						documentID = q.GetInt64("id")
					},
				)

				conn, err := p.DB.Take(context.Background())
				require.Nil(t, err)
				defer p.DB.Put(conn)

				// the first thing we have to do is collect the artifacts.
				collected, err := artifacts.CollectDocuments(context.Background(), p.DB, conn)
				require.Nil(t, err)

				// print the document we found
				err = artifacts.EnsureDocumentsPrinted(
					context.Background(),
					p.DB,
					conn,
					collected,
					false,
				)
				require.Nil(t, err)

				// look up the printed document
				statement, err := conn.Prepare(`select printed from documents where ID = $document`)
				p.DB.BindStatement(statement, map[string]any{"document": documentID})
				require.Nil(t, err)
				var printed string
				p.DB.StepStatement(context.Background(), statement, func() {
					printed = statement.GetText("printed")
				})

				require.Equal(t, content, printed)
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Query with variable directive",
				Pass: true,
				Input: []string{
					`
            query MyQuery ($name: String! @testDirective(if: true) @test) {
                user(name: $name) {
                    id
                } 
            }
          `,
				},
				Extra: map[string]any{
					"MyQuery": tests.Dedent(`
            query MyQuery($name: String! @testDirective(if: true) @test) {
                user(name: $name) {
                    id
                }
            }
          `),
				},
			},
			{
				Name: "Query Kitchen sink",
				Pass: true,
				Input: []string{
					`
            query queryName($foo: ComplexType, $site: Site = MOBILE) @onQuery {
                whoever123is: node(id: [123, 456], foo: $site) {
                  id
                  ... on User @onInlineFragment {
                    field2 {
                      id
                      alias: field1(first: 10, after: $foo) @include(if: $foo) {
                        id
                        ...frag @onFragmentSpread
                      }
                    }
                    ... @skip(if: $foo) {
                      id
                    }
                    ... {
                      id
                    }
                  }
              }
            }
          `,
				},
				Extra: map[string]any{
					"queryName": tests.Dedent(`
              query queryName($foo: ComplexType, $site: Site = MOBILE) @onQuery {
                  whoever123is: node(foo: $site, id: [123, 456]) {
                      id
                      ... on User @onInlineFragment {
                          field2 {
                              id
                              alias: field1(after: $foo, first: 10) @include(if: $foo) {
                                  id
                                  ...frag @onFragmentSpread
                              }
                          }
                          ... @skip(if: $foo) {
                              id
                          }
                          ... {
                              id
                          }
                      }
                  }
              }
            `),
				},
			},
			{
				Name: "Mutation Kitchen sink",
				Pass: true,
				Input: []string{
					`
            mutation likeStory @onMutation {
              like(story: 123) @onField {
                story {
                  id @onField
                }
              }
            }
        `,
				},
				Extra: map[string]any{
					"likeStory": tests.Dedent(`
              mutation likeStory @onMutation {
                  like(story: 123) @onField {
                      story {
                          id @onField
                      }
                  }
              }
          `),
				},
			},
			{
				Name: "Subscription Kitchen sink",
				Pass: true,
				Input: []string{
					`
            subscription StoryLikeSubscription($input: StoryLikeSubscribeInput @onVariableDefinition) @onSubscription {
              storyLikeSubscribe(input: $input) {
                story {
                  likers {
                    count
                  }
                  likeSentence {
                    text
                  }
                }
              }
            }
          `,
				},
				Extra: map[string]any{
					"StoryLikeSubscription": tests.Dedent(`
            subscription StoryLikeSubscription($input: StoryLikeSubscribeInput @onVariableDefinition) @onSubscription {
                storyLikeSubscribe(input: $input) {
                    story {
                        likers {
                            count
                        }
                        likeSentence {
                            text
                        }
                    }
                }
            }
          `),
				},
			},
			{
				Name: "Fragment Kitchen sink",
				Pass: true,
				Input: []string{
					`
            fragment frag on Friend @onFragmentDefinition {
              foo(
                size: $size
                bar: $b
                obj: {key: "value", block: """block string 
                uses \"""
                """}
              )
            }
          `,
				},
				Extra: map[string]any{
					"frag": tests.Dedent(`
            fragment frag on Friend @onFragmentDefinition {
                foo(bar: $b, obj: {key: "value", block: """block string 
                            uses """"""}, size: $size)
            }
          `),
				},
			},
			{
				Name: "Ignore internal directives",
				Pass: true,
				Input: []string{
					`
            query TestQuery @loading {
                testField @loading {
                    id @loading
                }
            }
          `,
				},
				Extra: map[string]any{
					"TestQuery": tests.Dedent(`
            query TestQuery {
                testField {
                    id
                }
            }
          `),
				},
			},
			{
				Name: "Don't print variables only used in internal directives",
				Pass: true,
				Input: []string{
					`
            mutation UpdateUsers($parent: ID!) {
                createUser {
                    ...Users_insert @parentID(value: $parent)
                }
            }
          `,
				},
				Extra: map[string]any{
					"UpdateUsers": tests.Dedent(`
            mutation UpdateUsers {
                createUser {
                    ...Users_insert
                }
            }
          `),
				},
			},
		},
	})
}
