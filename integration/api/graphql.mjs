import gql from 'graphql-tag';
import { GraphQLScalarType, Kind } from 'graphql';
import { createPubSub, GraphQLYogaError } from '@graphql-yoga/node';
import { sleep } from '@kitql/helper';
import { connectionFromArray } from 'graphql-relay';

const pubSub = createPubSub();

export const typeDefs = gql`
  scalar DateTime

  type Query {
    usersList(snapshot: String!, limit: Int = 4, offset: Int): [User!]!
    user(snapshot: String!, id: ID!, tmp: Boolean): User!
    avgYearsBirthDate: Float!
    usersConnection(
      snapshot: String!
      first: Int
      after: String
      last: Int
      before: String
    ): UserConnection!
    node(id: ID!): Node
  }

  type Mutation {
    addUser(snapshot: String!, name: String!, birthDate: DateTime!, delay: Int): User!
    updateUser(id: ID!, name: String!, snapshot: String!): User!
  }

  type User implements Node {
    id: ID!
    name: String!
    birthDate: DateTime!
    friendsList(limit: Int, offset: Int): [User!]!
    friendsConnection(first: Int, after: String, last: Int, before: String): UserConnection!
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
  }

  type UserEdge {
    node: User
    cursor: String
  }

  type PageInfo {
    endCursor: String
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
  }

  interface Node {
    id: ID!
  }
`;

// example data
const data = [
  { id: '1', name: 'Bruce Willis', birthDate: new Date(1955, 2, 19) },
  { id: '2', name: 'Samuel Jackson', birthDate: new Date(1948, 11, 21) },
  { id: '3', name: 'Morgan Freeman', birthDate: new Date(1937, 5, 0) },
  { id: '4', name: 'Tom Hanks', birthDate: new Date(1956, 6, 9) },
  { id: '5', name: 'Will Smith', birthDate: new Date(1968, 8, 25) },
  { id: '6', name: 'Harrison Ford', birthDate: new Date(1942, 6, 13) },
  { id: '7', name: 'Eddie Murphy', birthDate: new Date(1961, 3, 3) },
  { id: '8', name: 'Clint Eastwood', birthDate: new Date(1930, 5, 31) }
];
const snapshots = {};

function getSnapshot(snapshot) {
  if (!snapshots[snapshot]) {
    snapshots[snapshot] = data.map((user) => ({
      ...user,
      id: `${snapshot}:${user.id}`,
      snapshot
    }));
  }

  return snapshots[snapshot];
}

export const resolvers = {
  Query: {
    usersList: (_, args) => {
      return [...getSnapshot(args.snapshot)].splice(args.offset || 0, args.limit);
    },
    usersConnection(_, args) {
      return connectionFromArray(getSnapshot(args.snapshot), args);
    },
    user: (_, args) => {
      const user = getSnapshot(args.snapshot).find((c) => c.id === `${args.snapshot}:${args.id}`);
      if (!user) {
        throw new GraphQLYogaError('User not found', { code: 404 });
      }
      return user;
    },
    avgYearsBirthDate: () => {
      return list.map((c) => c.birthDate.getFullYear()).reduce((a, b) => a + b) / list.length;
    },
    node(_, { id: nodeID }) {
      const [snapshot, id] = nodeID.split(':');
      const list = getSnapshot(snapshot);
      const user = list.find((u) => u.id === nodeID);
      return {
        ...user,
        __typename: 'User'
      };
    }
  },

  User: {
    friendsList: (user, args) => {
      return [...getSnapshot(user.snapshot)].splice(args.offset || 0, args.limit);
    },
    friendsConnection(user, args) {
      return connectionFromArray(getSnapshot(user.snapshot), args);
    }
  },

  Mutation: {
    addUser: async (_, args) => {
      const list = getSnapshot(args.snapshot);
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
      const list = getSnapshot(args.snapshot);
      const userIndex = list.findIndex((c) => c.id === `${args.snapshot}:${args.id}`);
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
