// external
import * as graphql from 'graphql'
import { test, expect } from 'vitest'

import { runPipeline } from '../..'
import type { Document } from '../../../lib'
import { fs } from '../../../lib'
import { mockCollectedDoc, testConfig } from '../../../test'

const config = testConfig()

test('adds internal documents to schema', async function () {
	const docs: Document[] = [
		mockCollectedDoc(`query TestQuery { version }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// read the schema file and make sure it got the internal documents
	expect(graphql.parse((await fs.readFile(config.definitionsSchemaPath))!))
		.toMatchInlineSnapshot(`
			enum CachePolicy {
			  CacheAndNetwork
			  CacheOnly
			  CacheOrNetwork
			  NetworkOnly
			}

			enum PaginateMode {
			  Infinite
			  SinglePage
			}

			"""
			@list is used to mark a field for the runtime as a place to add or remove
			entities in mutations
			"""
			directive @list(name: String!, connection: Boolean) on FIELD

			"""
			@paginate is used to to mark a field for pagination.
			More info in the [doc](https://houdinigraphql.com/guides/pagination).
			"""
			directive @paginate(name: String, mode: PaginateMode) on FIELD

			"""@prepend is used to tell the runtime to add the result to the end of the list"""
			directive @prepend on FRAGMENT_SPREAD

			"""@append is used to tell the runtime to add the result to the start of the list"""
			directive @append on FRAGMENT_SPREAD

			"""@allLists is used to tell the runtime to add the result to all list"""
			directive @allLists on FRAGMENT_SPREAD

			"""
			@parentID is used to provide a parentID without specifying position or in situations
			where it doesn't make sense (eg when deleting a node.)
			"""
			directive @parentID(value: ID!) on FRAGMENT_SPREAD

			"""@when is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)"""
			directive @when on FRAGMENT_SPREAD

			"""@when_not is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)"""
			directive @when_not on FRAGMENT_SPREAD

			"""@arguments is used to define the arguments of a fragment"""
			directive @arguments on FRAGMENT_DEFINITION

			"""@with is used to provide arguments to fragments that have been marked with @arguments"""
			directive @with on FRAGMENT_SPREAD

			"""@cache is used to specify cache rules for a query"""
			directive @cache(policy: CachePolicy, partial: Boolean) on QUERY

			"""@mask_enable to enable masking on fragment (overwriting the global conf)"""
			directive @mask_enable on FRAGMENT_SPREAD

			"""@mask_disable to disable masking on fragment (overwriting the global conf)"""
			directive @mask_disable on FRAGMENT_SPREAD

			"""@loading is used to shape the value of your documents while they are loading"""
			directive @loading(count: Int, cascade: Boolean) on QUERY | FRAGMENT_DEFINITION | FIELD | FRAGMENT_SPREAD

			"""@required makes a nullable field always non-null by making the parent null when the field is"""
			directive @required on FIELD
		`)
})

test('list operations are included', async function () {
	const docs: Document[] = [
		mockCollectedDoc(
			`query TestQuery { usersByCursor @list(name: "Friends") { edges { node { id } } } }`
		),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// read the schema file
	expect(graphql.parse((await fs.readFile(config.definitionsSchemaPath))!))
		.toMatchInlineSnapshot(`
			enum CachePolicy {
			  CacheAndNetwork
			  CacheOnly
			  CacheOrNetwork
			  NetworkOnly
			}

			enum PaginateMode {
			  Infinite
			  SinglePage
			}

			"""
			@list is used to mark a field for the runtime as a place to add or remove
			entities in mutations
			"""
			directive @list(name: String!, connection: Boolean) on FIELD

			"""
			@paginate is used to to mark a field for pagination.
			More info in the [doc](https://houdinigraphql.com/guides/pagination).
			"""
			directive @paginate(name: String, mode: PaginateMode) on FIELD

			"""@prepend is used to tell the runtime to add the result to the end of the list"""
			directive @prepend on FRAGMENT_SPREAD

			"""@append is used to tell the runtime to add the result to the start of the list"""
			directive @append on FRAGMENT_SPREAD

			"""@allLists is used to tell the runtime to add the result to all list"""
			directive @allLists on FRAGMENT_SPREAD

			"""
			@parentID is used to provide a parentID without specifying position or in situations
			where it doesn't make sense (eg when deleting a node.)
			"""
			directive @parentID(value: ID!) on FRAGMENT_SPREAD

			"""@when is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)"""
			directive @when on FRAGMENT_SPREAD

			"""@when_not is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)"""
			directive @when_not on FRAGMENT_SPREAD

			"""@arguments is used to define the arguments of a fragment"""
			directive @arguments on FRAGMENT_DEFINITION

			"""@with is used to provide arguments to fragments that have been marked with @arguments"""
			directive @with on FRAGMENT_SPREAD

			"""@cache is used to specify cache rules for a query"""
			directive @cache(policy: CachePolicy, partial: Boolean) on QUERY

			"""@mask_enable to enable masking on fragment (overwriting the global conf)"""
			directive @mask_enable on FRAGMENT_SPREAD

			"""@mask_disable to disable masking on fragment (overwriting the global conf)"""
			directive @mask_disable on FRAGMENT_SPREAD

			"""@loading is used to shape the value of your documents while they are loading"""
			directive @loading(count: Int, cascade: Boolean) on QUERY | FRAGMENT_DEFINITION | FIELD | FRAGMENT_SPREAD

			"""@required makes a nullable field always non-null by making the parent null when the field is"""
			directive @required on FIELD

			directive @User_delete repeatable on FIELD
		`)

	// read the documents file
	expect(graphql.parse((await fs.readFile(config.definitionsDocumentsPath))!))
		.toMatchInlineSnapshot(`
			fragment Friends_insert on User {
			  id
			}

			fragment Friends_toggle on User {
			  id
			}

			fragment Friends_remove on User {
			  id
			}
		`)
})

test('list operations are included but delete directive should not be in when we have Custom Ids', async function () {
	const docs: Document[] = [
		mockCollectedDoc(
			`query TestQuery { usersByCursor @list(name: "Friends") { edges { node { id } } } }`
		),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
		mockCollectedDoc(`query CustomIdList { customIdList @list(name: "theList") { foo }}`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// read the schema file
	expect(graphql.parse((await fs.readFile(config.definitionsSchemaPath))!))
		.toMatchInlineSnapshot(`
			enum CachePolicy {
			  CacheAndNetwork
			  CacheOnly
			  CacheOrNetwork
			  NetworkOnly
			}

			enum PaginateMode {
			  Infinite
			  SinglePage
			}

			"""
			@list is used to mark a field for the runtime as a place to add or remove
			entities in mutations
			"""
			directive @list(name: String!, connection: Boolean) on FIELD

			"""
			@paginate is used to to mark a field for pagination.
			More info in the [doc](https://houdinigraphql.com/guides/pagination).
			"""
			directive @paginate(name: String, mode: PaginateMode) on FIELD

			"""@prepend is used to tell the runtime to add the result to the end of the list"""
			directive @prepend on FRAGMENT_SPREAD

			"""@append is used to tell the runtime to add the result to the start of the list"""
			directive @append on FRAGMENT_SPREAD

			"""@allLists is used to tell the runtime to add the result to all list"""
			directive @allLists on FRAGMENT_SPREAD

			"""
			@parentID is used to provide a parentID without specifying position or in situations
			where it doesn't make sense (eg when deleting a node.)
			"""
			directive @parentID(value: ID!) on FRAGMENT_SPREAD

			"""@when is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)"""
			directive @when on FRAGMENT_SPREAD

			"""@when_not is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)"""
			directive @when_not on FRAGMENT_SPREAD

			"""@arguments is used to define the arguments of a fragment"""
			directive @arguments on FRAGMENT_DEFINITION

			"""@with is used to provide arguments to fragments that have been marked with @arguments"""
			directive @with on FRAGMENT_SPREAD

			"""@cache is used to specify cache rules for a query"""
			directive @cache(policy: CachePolicy, partial: Boolean) on QUERY

			"""@mask_enable to enable masking on fragment (overwriting the global conf)"""
			directive @mask_enable on FRAGMENT_SPREAD

			"""@mask_disable to disable masking on fragment (overwriting the global conf)"""
			directive @mask_disable on FRAGMENT_SPREAD

			"""@loading is used to shape the value of your documents while they are loading"""
			directive @loading(count: Int, cascade: Boolean) on QUERY | FRAGMENT_DEFINITION | FIELD | FRAGMENT_SPREAD

			"""@required makes a nullable field always non-null by making the parent null when the field is"""
			directive @required on FIELD

			directive @User_delete repeatable on FIELD
		`)

	// read the documents file
	expect(graphql.parse((await fs.readFile(config.definitionsDocumentsPath))!))
		.toMatchInlineSnapshot(`
			fragment Friends_insert on User {
			  id
			}

			fragment Friends_toggle on User {
			  id
			}

			fragment Friends_remove on User {
			  id
			}

			fragment theList_insert on CustomIdType {
			  foo
			  bar
			}

			fragment theList_toggle on CustomIdType {
			  foo
			  bar
			}

			fragment theList_remove on CustomIdType {
			  foo
			  bar
			}
		`)
})

test("writing twice doesn't duplicate definitions", async function () {
	const docs: Document[] = [
		mockCollectedDoc(`query TestQuery { version }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]

	// execute the generator twice
	await runPipeline(config, docs)
	await runPipeline(config, docs)

	// read the schema file and make sure it got the internal documents
	expect(graphql.parse((await fs.readFile(config.definitionsSchemaPath))!))
		.toMatchInlineSnapshot(`
			enum CachePolicy {
			  CacheAndNetwork
			  CacheOnly
			  CacheOrNetwork
			  NetworkOnly
			}

			enum PaginateMode {
			  Infinite
			  SinglePage
			}

			"""
			@list is used to mark a field for the runtime as a place to add or remove
			entities in mutations
			"""
			directive @list(name: String!, connection: Boolean) on FIELD

			"""
			@paginate is used to to mark a field for pagination.
			More info in the [doc](https://houdinigraphql.com/guides/pagination).
			"""
			directive @paginate(name: String, mode: PaginateMode) on FIELD

			"""@prepend is used to tell the runtime to add the result to the end of the list"""
			directive @prepend on FRAGMENT_SPREAD

			"""@append is used to tell the runtime to add the result to the start of the list"""
			directive @append on FRAGMENT_SPREAD

			"""@allLists is used to tell the runtime to add the result to all list"""
			directive @allLists on FRAGMENT_SPREAD

			"""
			@parentID is used to provide a parentID without specifying position or in situations
			where it doesn't make sense (eg when deleting a node.)
			"""
			directive @parentID(value: ID!) on FRAGMENT_SPREAD

			"""@when is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)"""
			directive @when on FRAGMENT_SPREAD

			"""@when_not is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)"""
			directive @when_not on FRAGMENT_SPREAD

			"""@arguments is used to define the arguments of a fragment"""
			directive @arguments on FRAGMENT_DEFINITION

			"""@with is used to provide arguments to fragments that have been marked with @arguments"""
			directive @with on FRAGMENT_SPREAD

			"""@cache is used to specify cache rules for a query"""
			directive @cache(policy: CachePolicy, partial: Boolean) on QUERY

			"""@mask_enable to enable masking on fragment (overwriting the global conf)"""
			directive @mask_enable on FRAGMENT_SPREAD

			"""@mask_disable to disable masking on fragment (overwriting the global conf)"""
			directive @mask_disable on FRAGMENT_SPREAD

			"""@loading is used to shape the value of your documents while they are loading"""
			directive @loading(count: Int, cascade: Boolean) on QUERY | FRAGMENT_DEFINITION | FIELD | FRAGMENT_SPREAD

			"""@required makes a nullable field always non-null by making the parent null when the field is"""
			directive @required on FIELD
		`)
})
