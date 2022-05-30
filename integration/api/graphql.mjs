import gql from 'graphql-tag';
import { GraphQLScalarType, Kind } from 'graphql';
import { createPubSub, GraphQLYogaError } from '@graphql-yoga/node';
import { sleep } from '@kitql/helper';

const pubSub = createPubSub();

export const typeDefs = gql`
  scalar DateTime

  type Query {
    usersList: [User!]!
    user(id: ID!): User!
    userWithDelay(id: ID!): User!
    avgYearsBirthDate: Float!
  }

  type Mutation {
    addUser(name: String!, birthDate: DateTime!): User!
  }

  type User {
    id: ID!
    name: String!
    birthDate: DateTime!
  }
`;

// example data
const list = [
  { id: '1', name: 'Bruce Willis', birthDate: new Date(1955, 2, 19) },
  { id: '2', name: 'Samuel Jackson', birthDate: new Date(1948, 11, 21) }
];

export const resolvers = {
  Query: {
    usersList: (_, args) => {
      return list;
    },
    user: (_, args) => {
      const user = list.find((c) => c.id === args.id);
      if (!user) {
        throw new GraphQLYogaError('User not found', { code: 404 });
      }
      return user;
    },
    userWithDelay: async (_, args) => {
      await sleep(2000);
      const user = list.find((c) => c.id === args.id);
      if (!user) {
        throw new GraphQLYogaError('User not found', { code: 404 });
      }
      return user;
    },
    avgYearsBirthDate: () => {
      return list.map((c) => c.birthDate.getFullYear()).reduce((a, b) => a + b) / list.length;
    }
  },

  Mutation: {
    addUser: (_, args) => {
      const user = {
        id: (list.length + 1).toString(),
        name: args.name,
        birthDate: args.birthDate
      };
      list.push(user);
      return user;
    }
  },

  DateTime: new GraphQLScalarType({
    name: 'DateTime',
    description: 'Date custom scalar type',
    serialize(value) {
      return value.getTime();
    },
    parseValue(value) {
      return new Date(value);
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return new Date(parseInt(ast.value, 10));
      }
      return null;
    }
  })
};
