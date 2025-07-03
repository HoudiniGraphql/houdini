export const _houdini_load = graphql(`
  query MonkeyListQuery {
    monkeys {
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
      ...AnimalsList
    }
  }
`);
