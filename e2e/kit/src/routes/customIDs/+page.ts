import { graphql } from '$houdini';

export const _houdini_load = graphql(`
  query RentedBooks {
    rentedBooks {
      userId
      bookId
      rate
    }
  }
`);
