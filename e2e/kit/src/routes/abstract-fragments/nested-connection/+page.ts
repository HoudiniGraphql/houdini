import { graphql } from '$houdini'

export const _houdini_load = graphql(`
  query MonkeyListQueryForNesting {
    monkeys {
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
      ...InitialData
      ...MonkeyListProps
    }
  }
`)
