import { GraphQLValue, SubscriptionSelection, SubscriptionSpec } from '../types';
import { ConnectionHandler } from './connection';
export declare class Cache {
    private _data;
    private _connections;
    private lastKnownVariables;
    write(selection: SubscriptionSelection, data: {
        [key: string]: GraphQLValue;
    }, variables?: {}, id?: string): void;
    id(type: string, data: {
        id?: string;
    } | null): string;
    id(type: string, id: string): string;
    idFields(type: string): string[];
    subscribe(spec: SubscriptionSpec, variables?: {}): void;
    unsubscribe(spec: SubscriptionSpec, variables?: {}): void;
    connection(name: string, id?: string): ConnectionHandler;
    delete(id: string, variables?: {}): boolean;
    private record;
    get internal(): CacheProxy;
    private computeID;
    private root;
    private getData;
    private addSubscribers;
    private removeSubscribers;
    private _write;
    private getRecord;
    private isScalarLink;
    private notifySubscribers;
    private insertSubscribers;
    private unsubscribeSelection;
    private evaluateKey;
}
export declare type CacheProxy = {
    record: Cache['record'];
    notifySubscribers: Cache['notifySubscribers'];
    unsubscribeSelection: Cache['unsubscribeSelection'];
    insertSubscribers: Cache['insertSubscribers'];
    evaluateKey: Cache['evaluateKey'];
    getRecord: Cache['getRecord'];
};
