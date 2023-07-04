import { fs, parseJS } from 'houdini'
import { test, expect } from 'vitest'

import { test_config } from '../config'
import { render_server_path, render_client_path } from '../conventions'
import { generate_renders } from './render'

test('generates render functions', async function () {
	const config = await test_config()

	await generate_renders(config)

	const render_client = await parseJS((await fs.readFile(render_client_path(config))) ?? '', {
		plugins: ['jsx'],
	})
	expect(render_client).toMatchInlineSnapshot('')

	const render_server = await parseJS((await fs.readFile(render_server_path(config))) ?? '', {
		plugins: ['jsx'],
	})
	expect(render_server).toMatchInlineSnapshot(`
		import React from "react";
		import { renderToStream } from "react-streaming/server";
		import App from "./App";
		import { router_cache } from "$houdini";

		export function render_to_stream(
		    {
		        url,
		        cache,
		        loaded_queries,
		        loaded_artifacts,
		        session,
		        ...config
		    }
		) {
		    return renderToStream(<App
		        intialURL={url}
		        cache={cache}
		        {...router_cache()}
		        loaded_queries={loaded_queries}
		        session={session}
		        loaded_artifacts={loaded_artifacts} />, config);
		}
	`)
})
