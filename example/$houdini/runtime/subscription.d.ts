import { Readable } from 'svelte/store';
import { Operation, GraphQLTagResult } from './types';
export default function subscription<_Subscription extends Operation<any, any>>(document: GraphQLTagResult, variables?: _Subscription['input']): {
    data: Readable<_Subscription['result']>;
};
