export class Environment {
    constructor(networkFn, subscriptionHandler) {
        this.fetch = networkFn;
        this.socket = subscriptionHandler;
    }
    sendRequest(ctx, params, session) {
        return this.fetch.call(ctx, params, session);
    }
}
let currentEnv = null;
export function setEnvironment(env) {
    currentEnv = env;
}
export function getEnvironment() {
    return currentEnv;
}
// fetchQuery is used by the preprocess-generated runtime to send an operation to the server
export async function fetchQuery(ctx, { text, variables, }, session) {
    // grab the current environment
    const environment = getEnvironment();
    // if there is no environment
    if (!environment) {
        return { data: {}, errors: [{ message: 'could not find houdini environment' }] };
    }
    return await environment.sendRequest(ctx, { text, variables }, session);
}
// convertKitPayload is responsible for taking the result of kit's load
export async function convertKitPayload(context, loader, page, session) {
    // invoke the loader
    const result = await loader({
        page,
        session,
        context,
        fetch: context.fetch,
    });
    // if the response contains an error
    if (result.error) {
        // 500 - internal server error
        context.error(result.status || 500, result.error);
        return;
    }
    // if the response contains a redirect
    if (result.redirect) {
        // 307 - temporary redirect
        context.redirect(result.status || 307, result.redirect);
        return;
    }
    // the response contains data!
    if (result.props) {
        return result.props;
    }
    // we shouldn't get here
    throw new Error('Could not handle response from loader: ' + JSON.stringify(result));
}
export class RequestContext {
    constructor(ctx) {
        this.continue = true;
        this.returnValue = {};
        this.context = ctx;
    }
    error(status, message) {
        this.continue = false;
        this.returnValue = {
            error: message,
            status,
        };
    }
    redirect(status, location) {
        this.continue = false;
        this.returnValue = {
            redirect: location,
            status,
        };
    }
    fetch(input, init) {
        return this.context.fetch(input, init);
    }
    graphqlErrors(errors) {
        console.log('registering graphql errors', errors);
        return this.error(500, errors.map(({ message }) => message).join('\n'));
    }
    computeInput(mode, func) {
        // if we are in kit mode, just pass the context directly
        if (mode === 'kit') {
            return func(this.context);
        }
        // we are in sapper mode, so we need to prepare the function context
        // and pass page and session
        return func.call(this, this.context.page, this.context.session);
    }
}
