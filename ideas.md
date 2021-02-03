query maintains local state of the its value. when a mutation is triggered, find the intersections
and apply specific updates to the data model

ie, if a mutation updates User.firstName, find every query that asks for User.firstName and
generate the code that finds the corresponding user and updates the values in the response

-   mutation can't hunt down every single possible query, there could be thousands that will never appear and it would cause unnecessary
    bloat. instead we need to scale with the number of queries we have on the screen
-   queries could listen for any possible mutation
    -   this could also have the same scalability issues: there could be tons of mutations that the queries are never listening for
-   queries and fragments could listen for changes in data attributes

-   can codesplitting register the listener?
-   codepslitting should handle the bloat as long as each update is imported from the mutation call or query call

-   if the mutation existed before the query, we need the bloat and vice versa

-   when compiling a mutation, look for all queries which would be updated

-   dynamic import inside of event handler

-   a query could break itself down and listen for changes in specific entities "if a user changes, here is a function i need to invoke to update"
    -   mutations would trigger the corresponding callbacks with the updated values

```javascript
// _layout.svelte has query IndexInfo

// if there is a component mounted that has a handle for the CheckTodoItem mutation
if (CheckTodoItem.isMounted) {
	// figure out how to respond to that mutation.
	// note: this needs to be a hard coded string before we get to rollup so that it can code split the
	// responses out of the bundle
	response = await import('__generated__/mutations/CheckTodoItem_IndexInfo.js')

	// do something with the contents of the file

	// and so on for all of the mutations that intersect with this query
} else if (UncheckTodoItem.isMounted) {
}
```

-   user doesn't define `data` (or whatever variable they use) as a store,
    -   might have to define operations in script tag and then hoist to preload in the processor
