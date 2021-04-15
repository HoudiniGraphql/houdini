export declare class Environment {
    private fetch;
    socket: SubscriptionHandler | null | undefined;
    constructor(networkFn: RequestHandler, subscriptionHandler?: SubscriptionHandler | null);
    sendRequest(ctx: FetchContext, params: FetchParams, session?: FetchSession): Promise<RequestPayload>;
}
export declare function setEnvironment(env: Environment): void;
export declare function getEnvironment(): Environment | null;
export declare type SubscriptionHandler = {
    subscribe: (payload: {
        query: string;
        variables?: {};
    }, handlers: {
        next: (payload: {
            data?: {};
            errors?: readonly {
                message: string;
            }[];
        }) => void;
        error: (data: {}) => void;
        complete: () => void;
    }) => () => void;
};
export declare type FetchParams = {
    text: string;
    variables: {
        [key: string]: any;
    };
};
export declare type FetchContext = {
    page: {
        host: string;
        path: string;
        params: Record<string, string | string[]>;
        query: URLSearchParams;
    };
    fetch: (info: RequestInfo, init?: RequestInit) => Promise<Response>;
    session: any;
    context: Record<string, any>;
};
export declare type KitLoadResponse = {
    status?: number;
    error?: Error;
    redirect?: string;
    props?: Record<string, any>;
    context?: Record<string, any>;
    maxage?: number;
};
export declare type FetchSession = any;
declare type GraphQLError = {
    message: string;
};
declare type RequestPayload = {
    data: any;
    errors?: Error[];
};
export declare type RequestHandler = (this: FetchContext, params: FetchParams, session?: FetchSession) => Promise<RequestPayload>;
export declare function fetchQuery(ctx: FetchContext, { text, variables, }: {
    text: string;
    variables: {
        [name: string]: unknown;
    };
}, session?: FetchSession): Promise<RequestPayload | {
    data: {};
    errors: {
        message: string;
    }[];
}>;
export declare function convertKitPayload(context: RequestContext, loader: (ctx: FetchContext) => Promise<KitLoadResponse>, page: FetchContext['page'], session: FetchContext['session']): Promise<Record<string, any> | undefined>;
export declare class RequestContext {
    context: FetchContext;
    continue: boolean;
    returnValue: {};
    constructor(ctx: FetchContext);
    error(status: number, message: string | Error): void;
    redirect(status: number, location: string): void;
    fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
    graphqlErrors(errors: GraphQLError[]): void;
    computeInput(mode: 'kit', func: (ctx: FetchContext) => {}): {};
    computeInput(mode: 'sapper', func: (page: FetchContext['page'], session: FetchContext['session']) => {}): {};
}
export {};
//# sourceMappingURL=network.d.ts.map