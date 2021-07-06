// external imports
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../generate'
import { mockCollectedDoc } from '../testUtils'

test('adds __typename on interface selection sets under query', async function () {
	const docs = [
		mockCollectedDoc(
			'Friends',
			`
				query Friends {
					friends {
                        ... on Cat { 
                            id
                        }
                        ... on Ghost { 
                            name
                        }
					}
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(graphql.print(docs[0].document)).toMatchInlineSnapshot(`
		"query Friends {
		  friends {
		    ... on Cat {
		      id
		    }
		    ... on Ghost {
		      name
		    }
		    __typename
		  }
		}
		"
	`)
})

test('adds __typename on interface selection sets under an object', async function () {
	const docs = [
		mockCollectedDoc(
			'Friends',
			`
				query Friends {
                    users(stringValue: "hello") { 
                        friendsInterface {
                            ... on Cat { 
                                id
                            }
                            ... on Ghost { 
                                name
                                aka
                            }
                        }
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(graphql.print(docs[0].document)).toMatchInlineSnapshot(`
		"query Friends {
		  users(stringValue: \\"hello\\") {
		    friendsInterface {
		      ... on Cat {
		        id
		      }
		      ... on Ghost {
		        name
		        aka
		      }
		      __typename
		    }
		  }
		}
		"
	`)
})

test('adds __typename on unions', async function () {
	const docs = [
		mockCollectedDoc(
			'Friends',
			`
				query Friends {
					entities {
                        ... on Cat { 
                            id
                        }
                        ... on Ghost { 
                            name
                        }
					}
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(graphql.print(docs[0].document)).toMatchInlineSnapshot(`
		"query Friends {
		  entities {
		    ... on Cat {
		      id
		    }
		    ... on Ghost {
		      name
		    }
		    __typename
		  }
		}
		"
	`)
})

test('george failure', async function () {
	const docs = [
		mockCollectedDoc(
			'Friends',
			`
				query Friends {
					me { 
						goals { 
							family { 
								objective { 
									id
								}
							}
						}
					}
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig({
		schema: `
		directive @cacheControl(maxAge: Int, scope: CacheControlScope) on FIELD_DEFINITION | INTERFACE | OBJECT

		enum CacheControlScope {
			PRIVATE
			PUBLIC
		}

		type CreateGoalResponse {
			goal: Goal
			message: String
			success: Boolean!
		}

		interface Goal {
			id: Int
			title: String
			type: String
		}

		type GoalFamily {
			objective: Objective
			strategies: [Strategy]
		}

		type Initiative implements Goal & OkrGoal {
			cachedPercentageComplete: Float
			cachedRAG: RagStatus
			family: GoalFamily
			id: Int
			title: String
			type: String
		}

		type KeyResult implements Goal & OkrGoal {
			cachedPercentageComplete: Float
			cachedRAG: RagStatus
			family: GoalFamily
			id: Int
			title: String
			type: String
		}

		type Metric implements Goal & OkrGoal {
			cachedPercentageComplete: Float
			cachedRAG: RagStatus
			family: GoalFamily
			id: Int
			title: String
			type: String
		}

		type Mutation {
			createGoal(endDate: String!, startDate: String!, title: String!): CreateGoalResponse!
		}

		type Objective implements Goal & OkrGoal {
			cachedPercentageComplete: Float
			cachedRAG: RagStatus
			family: GoalFamily
			id: Int
			keyResults: [KeyResult]
			title: String
			type: String
		}

		interface OkrGoal implements Goal {
			cachedPercentageComplete: Float
			cachedRAG: RagStatus
			family: GoalFamily
			id: Int
			title: String
			type: String
		}

		type Query {
			me: User
		}

		enum RagStatus {
			A
			G
			R
		}

		type Strategy implements Goal {
			id: Int
			title: String
			type: String
		}

		scalar Upload

		type User {
			avatarURL: String
			fullName: String
			goals: [OkrGoal]
			id: Int
			position: String
		}
`,
	})
	await runPipeline(config, docs)

	expect(graphql.print(docs[0].document)).toMatchInlineSnapshot()
})
