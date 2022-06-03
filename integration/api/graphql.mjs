import gql from 'graphql-tag';
import { GraphQLScalarType, Kind } from 'graphql';
import { createPubSub, GraphQLYogaError } from '@graphql-yoga/node';
import { sleep } from '@kitql/helper';

const pubSub = createPubSub();

export const typeDefs = gql`
  scalar DateTime

  type Query {
    usersList(limit: Int = 4): [User!]!
    user(id: ID!): User!
    avgYearsBirthDate: Float!
  }

  type Mutation {
    addUser(name: String!, birthDate: DateTime!, delay: Int): User!
    updateUser(id: ID!, name: String!): User!
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
  { id: '2', name: 'Samuel Jackson', birthDate: new Date(1948, 11, 21) },
  { id: '3', name: 'Morgan Freeman', birthDate: new Date(1937, 5, 0) },
  { id: '4', name: 'Tom Hanks', birthDate: new Date(1956, 6, 9) },
  { id: '5', name: 'Will Smith', birthDate: new Date(1968, 8, 25) },
  { id: '6', name: 'Harrison Ford', birthDate: new Date(1942, 6, 13) },
  { id: '7', name: 'Eddie Murphy', birthDate: new Date(1961, 3, 3) },
  { id: '8', name: 'Clint Eastwood', birthDate: new Date(1930, 5, 31) }
];

export const resolvers = {
  Query: {
    usersList: (_, args) => {
      return list.slice(0, args.limit);
    },
    user: (_, args) => {
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
    addUser: async (_, args) => {
      if (args.delay) {
        await sleep(args.delay);
      }
      const user = {
        id: (list.length + 1).toString(),
        name: args.name,
        birthDate: args.birthDate
      };
      list.push(user);
      return user;
    },
    updateUser: async (_, args) => {
      const userIndex = list.findIndex((c) => c.id === args.id);
      if (userIndex === -1) {
        throw new GraphQLYogaError('User not found', { code: 404 });
      }
      list[userIndex] = { ...list[userIndex], name: args.name };
      return list[userIndex];
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
