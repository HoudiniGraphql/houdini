import { GraphQLValue, SubscriptionSpec } from '../types';
import { Cache } from './cache';
declare type Connection = {
    name: string;
    parentID: string | undefined;
};
export declare class Record {
    fields: {
        [key: string]: GraphQLValue;
    };
    keyVersions: {
        [key: string]: Set<string>;
    };
    private subscribers;
    private recordLinks;
    private listLinks;
    private cache;
    private referenceCounts;
    connections: Connection[];
    constructor(cache: Cache);
    allSubscribers(): SubscriptionSpec[];
    getField(fieldName: string): GraphQLValue;
    writeField(fieldName: string, value: GraphQLValue): void;
    writeRecordLink(fieldName: string, value: string): void;
    writeListLink(fieldName: string, value: string[]): void;
    linkedRecord(fieldName: string): import("../types").Maybe<Record>;
    linkedRecordID(fieldName: string): string;
    linkedListIDs(fieldName: string): string[];
    linkedList(fieldName: string): Record[];
    appendLinkedList(fieldName: string, id: string): void;
    prependLinkedList(fieldName: string, id: string): void;
    removeFromLinkedList(fieldName: string, id: string): void;
    addSubscriber(rawKey: string, key: string, ...specs: SubscriptionSpec[]): void;
    getSubscribers(fieldName: string): SubscriptionSpec[];
    forgetSubscribers(...targets: SubscriptionSpec[]): void;
    removeAllSubscribers(): void;
    addConnectionReference(ref: Connection): void;
    removeConnectionReference(ref: Connection): void;
    removeAllSubscriptionVerions(keyRaw: string, spec: SubscriptionSpec): void;
    private forgetSubscribers_walk;
    removeSubscribers(fields: string[], sets: SubscriptionSpec['set'][]): void;
}
export {};
//# sourceMappingURL=record.d.ts.map