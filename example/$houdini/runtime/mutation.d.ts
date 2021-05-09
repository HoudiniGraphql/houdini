import { Operation, GraphQLTagResult } from './types';
export default function mutation<_Mutation extends Operation<any, any>>(document: GraphQLTagResult): (_input: _Mutation['input']) => Promise<_Mutation['result']>;
