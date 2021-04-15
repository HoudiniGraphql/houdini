import { Readable } from 'svelte/store';
import { Operation, GraphQLTagResult } from './types';
export default function query<_Query extends Operation<any, any>>(document: GraphQLTagResult): QueryResponse<Readable<_Query['result']>, _Query['input']>;
declare type QueryResponse<_Data, _Input> = {
    data: _Data;
    writeData: (data: _Data, variables: _Input) => void;
};
export declare const getQuery: <T>(arg: T) => T;
export {};
//# sourceMappingURL=query.d.ts.map