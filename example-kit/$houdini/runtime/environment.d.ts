import type { SubscriptionHandler } from './network';
import type { RequestHandler, FetchContext, FetchParams, FetchSession } from './network';
export declare class Environment {
    private fetch;
    socket: SubscriptionHandler | null | undefined;
    constructor(networkFn: RequestHandler, subscriptionHandler?: SubscriptionHandler | null);
    sendRequest(ctx: FetchContext, params: FetchParams, session?: FetchSession): Promise<{
        data: any;
        errors?: Error[] | undefined;
    }>;
}
//# sourceMappingURL=environment.d.ts.map