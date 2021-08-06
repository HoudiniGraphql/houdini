// external imports
import fs from 'fs/promises'
import { testConfig } from 'houdini-common'
import path from 'path'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// local imports
import '../../../../../jest.setup'
import { runPipeline } from '../../generate'

test('non-existing hook', async function () {
	// generating with a non-existing hook file shoud create one
	const config = testConfig()

	// run the pipeline
	await runPipeline(config, [])

	// validate the hook files contents
	expect(
		recast.parse(await fs.readFile(path.join(config.srcPath, 'hook.js'), 'utf-8'), {
			parser: typeScriptParser,
		}).program
	).toMatchInlineSnapshot(`
		import cache from '$houdini/runtime/cache'

		/*@type {import('@sveltejs/kit').Handle}*/
		async function handle(
		    {
		        request: request,
		        render: render
		    }
		) {
		    /*
		        make sure that the server side cache is disabled before every request so that
		        we don't accidentally load sensitive user information across sessions when SSR'ing
		        a request
		    */
		    cache.disable();

		    return await render(request);
		}
	`)
})

test('existing js hook, no disable cache', async function () {
	const config = testConfig()

	await fs.writeFile(
		path.join(config.srcPath, 'hook.js'),
		`
export async function handle({ request, render }) {
    console.log("hello")
	// we're done
	return await render(request)
}
    `,
		'utf-8'
	)

	// run the pipeline
	await runPipeline(config, [])

	// validate the hook files contents
	expect(
		recast.parse(await fs.readFile(path.join(config.srcPath, 'hook.js'), 'utf-8'), {
			parser: typeScriptParser,
		}).program
	).toMatchInlineSnapshot(`
		import cache from "$houdini/runtime/cache";

		export async function handle(
		    {
		        request,
		        render
		    }
		) {
		    /*
		        make sure that the server side cache is disabled before every request so that
		        we don't accidentally load sensitive user information across sessions when SSR'ing
		        a request
		    */
		    cache.disable();

		    console.log("hello");
		    return await render(request);
		}
	`)
})

test('existing ts hook, no disable cache', async function () {
	const config = testConfig()

	await fs.writeFile(
		path.join(config.srcPath, 'hook.ts'),
		`
export async function handle({ request, render }) {
    console.log("hello")
	// we're done
	return await render(request)
}
    `,
		'utf-8'
	)

	// run the pipeline
	await runPipeline(config, [])

	// validate the hook files contents
	expect(
		recast.parse(await fs.readFile(path.join(config.srcPath, 'hook.ts'), 'utf-8'), {
			parser: typeScriptParser,
		}).program
	).toMatchInlineSnapshot(`
		import cache from "$houdini/runtime/cache";

		export async function handle(
		    {
		        request,
		        render
		    }
		) {
		    /*
		        make sure that the server side cache is disabled before every request so that
		        we don't accidentally load sensitive user information across sessions when SSR'ing
		        a request
		    */
		    cache.disable();

		    console.log("hello");
		    return await render(request);
		}
	`)
})

test('existing hook, with disable cache', async function () {
	const config = testConfig()

	await fs.writeFile(
		path.join(config.srcPath, 'hook.js'),
		`
import cache from '$houdini/runtime/cache'

export async function handle({ request, render }) {
    cache.disable()
	// we're done
	return await render(request)
}
    `,
		'utf-8'
	)

	// run the pipeline
	await runPipeline(config, [])

	// validate the hook files contents
	expect(
		recast.parse(await fs.readFile(path.join(config.srcPath, 'hook.js'), 'utf-8'), {
			parser: typeScriptParser,
		}).program
	).toMatchInlineSnapshot(`
		import cache from "$houdini/runtime/cache";

		export async function handle(
		    {
		        request,
		        render
		    }
		) {
		    cache.disable();
		    return await render(request);
		}
	`)
})

test('existing hook, with renamed cache', async function () {
	const config = testConfig()

	await fs.writeFile(
		path.join(config.srcPath, 'hook.js'),
		`
import houdiniCache from '$houdini/runtime/cache'

export async function handle({ request, render }) {
    houdiniCache.disable()
	// we're done
	return await render(request)
}
    `,
		'utf-8'
	)

	// run the pipeline
	await runPipeline(config, [])

	// validate the hook files contents
	expect(
		recast.parse(await fs.readFile(path.join(config.srcPath, 'hook.js'), 'utf-8'), {
			parser: typeScriptParser,
		}).program
	).toMatchInlineSnapshot(`
		import houdiniCache from "$houdini/runtime/cache";

		export async function handle(
		    {
		        request,
		        render
		    }
		) {
		    houdiniCache.disable();
		    return await render(request);
		}
	`)
})
