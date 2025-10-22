<script lang="ts">
  import {
    CitiesStore,
    AddCityStore,
    AddLibraryStore,
    AddBookStore,
    DeleteCityStore,
    DeleteLibraryStore,
    DeleteBookStore,
    type ForceReturn$options,
    RemoveBookStore
  } from '$houdini';
  import { onMount } from 'svelte';

  const cities = new CitiesStore();
  const addCity = new AddCityStore();
  const addLibrary = new AddLibraryStore();
  const addBook = new AddBookStore();
  const deleteCity = new DeleteCityStore();
  const deleteLibrary = new DeleteLibraryStore();
  const deleteBook = new DeleteBookStore();
  const removeBook = new RemoveBookStore();

  onMount(() => {
    cities.fetch();
  });

  const addCityHandler = (event: Event) => {
    const target = event?.target as HTMLInputElement;
    addCity.mutate({ name: target.value });
    target.value = '';
  };

  const deleteCityHandler = (event: Event) => {
    const target = event?.target as HTMLButtonElement;
    if (!target.dataset.id) {
      return;
    }
    deleteCity.mutate({ city: target.dataset.id });
  };

  const addLibraryHandler = (event: Event) => {
    const target = event?.target as HTMLInputElement;
    if (!target.dataset.id) {
      return;
    }

    addLibrary.mutate({ city: target.dataset.id, name: target.value });
    target.value = '';
  };

  const deleteLibraryHandler = (event: Event) => {
    const target = event?.target as HTMLButtonElement;
    if (!target.dataset.id) {
      return;
    }
    deleteLibrary.mutate({ library: target.dataset.id });
  };

  const addBookHandler = (event: Event) => {
    const target = event?.target as HTMLInputElement;
    if (!target.dataset.id) {
      return;
    }

    addBook.mutate({ library: target.dataset.id, title: target.value });
    target.value = '';
  };

  const removeBookHandler = (event: Event) => {
    const target = event?.target as HTMLButtonElement;
    if (!target.dataset.id) {
      return;
    }
    removeBook.mutate(
      {
        book: target.dataset.id,
        force: (target.dataset.force as ForceReturn$options) ?? 'NORMAL'
      },
      { optimisticResponse: { deleteBook: { id: target.dataset.id } } }
    );
  };

  const deleteBookHandler = (event: Event) => {
    const target = event?.target as HTMLButtonElement;
    if (!target.dataset.id) {
      return;
    }
    deleteBook.mutate(
      {
        book: target.dataset.id,
        force: (target.dataset.force as ForceReturn$options) ?? 'NORMAL'
      },
      { optimisticResponse: { deleteBook: { id: target.dataset.id } } }
    );
  };
</script>

<h1>Nested - List</h1>

<ul>
  {#each $cities.data?.cities ?? [] as city}
    <li>
      {city?.id}: {city?.name}
      <button data-id={city?.id} on:click={deleteCityHandler}>Delete</button>
      <ul>
        {#each city?.libraries ?? [] as library}
          <li>
            {library?.id}: {library?.name}
            <button data-id={library?.id} on:click={deleteLibraryHandler}>Delete</button>
            <ul>
              {#each library?.books ?? [] as book}
                <li>
                  {book?.id}: {book?.title}
                  <button data-id={book?.id} on:click={removeBookHandler}>Remove</button>
                  <button data-id={book?.id} data-force="NULL" on:click={removeBookHandler}
                    >Remove (null)</button
                  >
                  <button data-id={book?.id} data-force="ERROR" on:click={removeBookHandler}
                    >Remove (error)</button
                  >
                  <button data-id={book?.id} on:click={deleteBookHandler}>Delete</button>
                  <button data-id={book?.id} data-force="NULL" on:click={deleteBookHandler}
                    >Delete (null)</button
                  >
                  <button data-id={book?.id} data-force="ERROR" on:click={deleteBookHandler}
                    >Delete (error)</button
                  >
                </li>
              {/each}
              <li><input data-id={library?.id} on:change={addBookHandler} /></li>
            </ul>
          </li>
        {/each}
        <li><input data-id={city?.id} on:change={addLibraryHandler} /></li>
      </ul>
    </li>
  {/each}
  <li>
    <input on:change={addCityHandler} />
  </li>
</ul>

<pre>{JSON.stringify($cities?.data, null, 4)}</pre>

<style>
  button {
    font-size: small;
    padding: 0.5rem;
  }
</style>
