<script lang="ts">
  import { graphql } from '$houdini';

  const store = graphql(`
    query RentedBooks @load {
      rentedBooks {
        userId
        bookId
        rate
      }
    }
  `);

  const update = graphql(`
    mutation updateRentedBook($rate: Int!) {
      updateRentedBook(userId: "1", bookId: 1, rate: $rate) {
        rate
      }
    }
  `);

  const updateRate = (rate: number) => {
    update.mutate({ rate });
  };
</script>

<h2>RentedBooks</h2>
<div id="result">
  {#each $store.data?.rentedBooks ?? [] as rentedBook}
    <div>
      User: {rentedBook?.userId} - Book: {rentedBook?.bookId} - Rate: {rentedBook?.rate}
    </div>
  {/each}
</div>

<button id="u77" on:click={() => updateRate(77)}>Update 77</button>
<button id="u9" on:click={() => updateRate(9)}>Update 9</button>
