import * as graphql from 'graphql'
import path from 'path'
import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'
import { writeFile } from '../../utils'
import pagination from './pagination'

export async function generateIndividualStoreQuery(config: Config, doc: CollectedGraphQLDocument) {
	const storeData: string[] = []
	const storeDataDTs: string[] = []

	const fileName = doc.name
	const storeName = config.storeName(doc) // "1 => GQL_All$Items" => ${storeName}
	const artifactName = `${doc.name}` // "2 => All$Items" => ${artifactName}

	const paginationExtras = pagination(config, doc)

	// STORE
	const storeDataGenerated = `import { houdiniConfig } from '$houdini';
import { logCyan, logRed, logYellow, stry } from '@kitql/helper';
import { writable } from 'svelte/store';
import { ${artifactName} as artifact } from '../artifacts';
import {
    CachePolicy,
    DataSource, errorsToGraphQLLayout, fetchQuery,
    RequestContext
} from '../runtime';
import { clientStarted, isBrowser } from '../runtime/adapter.mjs';
import cache from '../runtime/cache';
import { marshalInputs, unmarshalSelection } from '../runtime/scalars';

// optional pagination imports
${paginationExtras.imports}

// TODO:
// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!

function ${storeName}Store() {
    const { subscribe, set, update } = writable({
        data: null,
        errors: null,
        isFetching: false,
        partial: false,
        source: null,
        variables: null
    });

    // Track subscriptions
    let subscriptionSpec = null

    // Current variables tracker
    let variables = {}

    async function fetchLocal(params) {
        params = params ?? {};

        if (!isBrowser && !params.event) {
            // prettier-ignore
            console.error(
            \`\${logRed('I think that either')}:

            \${logRed('1/')} you forgot to provide \${logYellow('event')}! As we are in context="module" (SSR) here.
                    It should be something like:

                <script context="module" lang="ts">
                import type { LoadEvent } from '@sveltejs/kit';

                export async function load(\${logYellow('event')}: LoadEvent) {
                    \${logYellow('await')} \${logCyan('${storeName}')}.fetch({ \${logYellow('event')}, variables: { ... } });
                    return {};
                }
                </script>

                \${logRed('2/')} you should run this in a browser only.\`
            );
            throw new Error('Error, check logs for help.');
        }

        // if we have event, we should be in the load function
        if (params.event) {
            if (clientStarted && !params.blocking) {
                queryLoad(params); // No await on purpose, we are in a client navigation.
            } else {
                return await queryLoad(params);
            }
        } else {
            // event is missing and we are in the browser... we will get a "Function called outside component initialization"... Would be nice to warn the user!

            // else
            return await query(params);
        }
    }

    function queryLoad(params) {
		const context = new RequestContext(params.event)
		return queryLocal(context, params)
	}

	async function query(params) {
		const context = new RequestContext({
            fetch: fetch,
            page: params.context.page,
            session: params.context.session
        });

		return await queryLocal(context, params)
	}

    async function queryLocal(context, params) {
        update((c) => {
            return { ...c, isFetching: true }
        })

        // params management
        params = params ?? {}

        // If no policy specified => artifact.policy, if there is nothing go to CacheOrNetwork
        if (!params.policy) {
            params.policy = artifact.policy ?? CachePolicy.CacheOrNetwork
        }

        const newVariables = marshalInputs({
            artifact,
            config: houdiniConfig,
            input: {...variables, ...params.variables }
        })

        console.log({ newVariables })

        // if (artifact.input && Object.keys(newVariables).length === 0) {
        //     update((s) => ({
        //       ...s,
        //       errors: errorsToGraphQLLayout('${storeName} variables are not matching'),
        //       isFetching: false,
        //       partial: false,
        //       variables: newVariables
        //     }));
        //     throw new Error(\`${storeName} variables are not matching\`);
        // }

        const { result, source, partial } = await fetchQuery({
            context,
            artifact,
            variables: newVariables,
            session: context.session,
            cached: params.policy !== CachePolicy.NetworkOnly,
        })

        if (result.errors && result.errors.length > 0) {
            update((s) => ({
                ...s,
                errors: result.errors,
                isFetching: false,
                partial: false,
                data: result.data,
                source,
                variables: newVariables
            }));
            console.error(stry(result.errors));
            throw new Error(result.errors);
        }

        // setup a subscription for new values from the cache
        if (isBrowser) {
            subscriptionSpec = {
                rootType: artifact.rootType,
                selection: artifact.selection,
                variables: () => newVariables,
                set: (data) => update((s) => ({ ...s, data }))
            }
            cache.subscribe(subscriptionSpec, variables)

            const updated = stry(variables, 0) !== stry(newVariables, 0)

            // if the variables changed we need to unsubscribe from the old fields and
            // listen to the new ones
            if (updated && subscriptionSpec) {
                cache.unsubscribe(subscriptionSpec, variables)
            }

            // if the data was loaded from a cached value, and the document cache policy wants a
            // network request to be sent after the data was loaded, load the data
            if (
                source === DataSource.Cache &&
                params.policy === CachePolicy.CacheAndNetwork
            ) {
                // this will invoke pagination's refetch because of javascript's magic this binding
                fetchQuery({
                    context,
                    artifact,
                    variables: newVariables,
                    session: context.session,
                    cached: false,
                })
            }

            // if we have a partial result and we can load the rest of the data
            // from the network, send the request
            if (partial && params.policy === CachePolicy.CacheOrNetwork) {
                fetchQuery({
                    context,
                    artifact,
                    variables: newVariables,
                    session: context.session,
                    cached: false,
                })
            }

            // update the cache with the data that we just ran into
            cache.write({
                selection: artifact.selection,
                data: result.data,
                variables: newVariables,
            })

            if (updated && subscriptionSpec) {
                cache.subscribe(subscriptionSpec, newVariables)
            }
        }

        // update Current variables tracker
        variables = newVariables

        // prepare store data
        const storeData = {
            data: unmarshalSelection(houdiniConfig, artifact.selection, result.data),
            error: result.errors,
            isFetching: false,
            partial: partial,
            source: source,
            variables: newVariables
        }

        // update the store value
        set(storeData)

        // return the value to the caller
        return storeData
    }

    const setPartial = (partial) => update(s => ({...s, partial }))

${paginationExtras.preamble}

    return {
        subscribe: (...args) => {
            const parentUnsubscribe = subscribe(...args)

            // Handle unsubscribe
            return () => {
                if (subscriptionSpec) {
                    cache.unsubscribe(subscriptionSpec, variables)
                    subscriptionSpec = null
                }

                parentUnsubscribe()
            }
        },

        fetch: fetchLocal,

        // For internal usage only.
        setPartial,

        ${paginationExtras.methods}
    }
}

const store = ${storeName}Store()

export default store

export const ${storeName} = store
`
	storeData.push(storeDataGenerated)
	// STORE END

	// look for the operation
	const operations = doc.document.definitions.filter(
		({ kind }) => kind === graphql.Kind.OPERATION_DEFINITION
	) as graphql.OperationDefinitionNode[]
	const inputs = operations[0]?.variableDefinitions
	const withVariableInputs = inputs && inputs.length > 0
	const VariableInputsType = withVariableInputs ? `${artifactName}$input` : 'null'

	// TYPES
	const storeDataDTsGenerated = `import type { Readable } from 'svelte/store'
import type { ${artifactName}$input, ${artifactName}$result, CachePolicy } from '$houdini'
import { QueryStore } from '../runtime/types'
${paginationExtras.typeImports}

export declare const ${storeName}: QueryStore<${artifactName}$result | undefined, ${VariableInputsType}> ${paginationExtras.types}
  `
	storeDataDTs.push(storeDataDTsGenerated)
	// TYPES END

	await writeFile(path.join(config.rootDir, 'stores', `${fileName}.js`), storeData.join(`\n`))

	await writeFile(
		path.join(config.rootDir, 'stores', `${fileName}.d.ts`),
		storeDataDTs.join(`\n`)
	)

	return fileName
}
