import graphql from 'graphql'

const schema = graphql.buildSchema(`type User {
    id: ID!
    firstName: String!
    friends: [User!]!
    believesIn: [Ghost!]!
    cats: [Cat!]!
}

type Ghost implements Friend {
    name: String!
    believers: [User!]!
    friends: [Ghost!]!
    differentValue: String!
}

type Cat implements Friend {
    id: ID!
    name: String!
    differentValue: String
}

type Query {
    user: User!
    version: Int!
    ghost: Ghost!
    friends: [Friend]
    users(boolValue: Boolean, intValue: Int, floatValue: Float, stringValue: String!): [User!]!
}

interface Friend { 
    name: String!
}

union Entity = User | Cat | Ghost

type Mutation {
    updateUser: User!
    addFriend: AddFriendOutput!
    believeIn: BelieveInOutput!
    deleteUser(id: ID!): DeleteUserOutput!
    catMutation: CatMutationOutput!
    deleteCat: DeleteCatOutput!
}

type Subscription {
    newUser: NewUserResult!
}

type NewUserResult {
    user: User!
}

type AddFriendOutput {
    friend: User
}

type BelieveInOutput {
    ghost: Ghost
}

type DeleteUserOutput {
    userID: ID
}

type DeleteCatOutput {
    catID: ID
}

type CatMutationOutput {
    cat: Cat
}
`)

console.log(
	graphql.validate(
		schema,
		graphql.parse(`
            query { 
                friends {
                    ... on Cat { 
                        differentValue
                    }
                    ... on Ghost { 
                        differentValue
                    }
                }
            }
        `)
	)
)
