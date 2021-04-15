import { SubscriptionSelection, ConnectionWhen, SubscriptionSpec } from '../types';
import { Cache } from './cache';
import { Record } from './record';
export declare class ConnectionHandler {
    readonly record: Record;
    readonly key: string;
    readonly connectionType: string;
    private cache;
    readonly selection: SubscriptionSelection;
    private _when?;
    private filters?;
    readonly name: string;
    readonly parentID: SubscriptionSpec['parentID'];
    constructor({ name, cache, record, key, connectionType, selection, when, filters, parentID, }: {
        name: string;
        cache: Cache;
        record: Record;
        key: string;
        connectionType: string;
        selection: SubscriptionSelection;
        when?: ConnectionWhen;
        filters?: ConnectionHandler['filters'];
        parentID?: SubscriptionSpec['parentID'];
    });
    when(when?: ConnectionWhen): ConnectionHandler;
    append(selection: SubscriptionSelection, data: {}, variables?: {}): void;
    prepend(selection: SubscriptionSelection, data: {}, variables?: {}): void;
    addToConnection(selection: SubscriptionSelection, data: {}, variables: {} | undefined, where: 'first' | 'last'): void;
    removeID(id: string, variables?: {}): void;
    remove(data: {}, variables?: {}): void;
    private validateWhen;
    [Symbol.iterator](): Generator<Record, void, unknown>;
}
//# sourceMappingURL=connection.d.ts.map