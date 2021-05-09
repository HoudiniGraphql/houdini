export declare type Fragment<_Result> = {
    readonly shape?: _Result;
};
export declare type Operation<_Result, _Input> = {
    readonly result: _Result;
    readonly input: _Input;
};
export declare type Session = any;
export declare type Maybe<T> = T | null;
export declare type DocumentArtifact = FragmentArtifact | QueryArtifact | MutationArtifact | SubscriptionArtifact;
export declare type QueryArtifact = BaseCompiledDocument & {
    kind: 'HoudiniQuery';
};
export declare type MutationArtifact = BaseCompiledDocument & {
    kind: 'HoudiniMutation';
};
export declare type FragmentArtifact = BaseCompiledDocument & {
    kind: 'HoudiniFragment';
};
export declare type SubscriptionArtifact = BaseCompiledDocument & {
    kind: 'HoudiniSubscription';
};
declare type BaseCompiledDocument = {
    name: string;
    raw: string;
    hash: string;
    selection: SubscriptionSelection;
    rootType: string;
};
export declare type GraphQLTagResult = TaggedGraphqlQuery | TaggedGraphqlFragment | TaggedGraphqlMutation | TaggedGraphqlSubscription;
export declare type TaggedGraphqlFragment = {
    kind: 'HoudiniFragment';
    artifact: FragmentArtifact;
};
export declare type TaggedGraphqlMutation = {
    kind: 'HoudiniMutation';
    artifact: MutationArtifact;
};
export declare type TaggedGraphqlSubscription = {
    kind: 'HoudiniSubscription';
    artifact: SubscriptionArtifact;
};
export declare type TaggedGraphqlQuery = {
    kind: 'HoudiniQuery';
    initialValue: any;
    variables: {
        [key: string]: any;
    };
    artifact: QueryArtifact;
};
declare type Filter = {
    [key: string]: string | boolean | number;
};
export declare type ConnectionWhen = {
    must?: Filter;
    must_not?: Filter;
};
export declare type MutationOperation = {
    action: 'insert' | 'remove' | 'delete';
    connection?: string;
    type?: string;
    parentID?: {
        kind: string;
        value: string;
    };
    position?: 'first' | 'last';
    when?: ConnectionWhen;
};
export declare const CompiledFragmentKind = "HoudiniFragment";
export declare const CompiledMutationKind = "HoudiniMutation";
export declare const CompiledQueryKind = "HoudiniQuery";
export declare const CompiledSubscriptionKind = "HoudiniSubscription";
export declare type CompiledDocumentKind = 'HoudiniFragment' | 'HoudiniMutation' | 'HoudiniQuery' | 'HoudiniSubscription';
export declare type GraphQLValue = number | string | boolean | null | {
    [key: string]: GraphQLValue;
} | GraphQLValue[];
export declare type SubscriptionSelection = {
    [field: string]: {
        type: string;
        keyRaw: string;
        operations?: MutationOperation[];
        connection?: string;
        filters?: {
            [key: string]: {
                kind: 'Boolean' | 'String' | 'Float' | 'Int' | 'Variable';
                value: string;
            };
        };
        fields?: SubscriptionSelection;
    };
};
export declare type SubscriptionSpec = {
    rootType: string;
    selection: SubscriptionSelection;
    set: (data: any) => void;
    parentID?: string;
};
export {};
