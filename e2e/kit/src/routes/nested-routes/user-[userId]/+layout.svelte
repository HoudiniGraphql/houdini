<script lang="ts">
  import { page } from '$app/stores';
  import type { Page } from '@sveltejs/kit';
  import UserName from '../UserName.svelte';
  import UserName_2 from '../UserName_2.svelte';

  import type { LayoutData } from './$houdini';

  export let data: LayoutData;
  $: ({ Layout_User } = data);

  function TabLinkKeepingContext(id: string, url: URL) {
    const parts = url.pathname.split('/');
    return `../user-${id}/${parts[parts.length - 1]}?${url.searchParams.toString()}`;
  }

  function isPageActive(id: string, page: Page) {
    return page.params['userId'] === id;
  }

  function isTabActive(key: string, url: URL) {
    return url.href.endsWith(key);
  }
</script>

<a class:active={isPageActive('1', $page)} href={TabLinkKeepingContext('1', $page.url)}>user-1</a>
<a class:active={isPageActive('2', $page)} href={TabLinkKeepingContext('2', $page.url)}>user-2</a>
<a class:active={isPageActive('3', $page)} href={TabLinkKeepingContext('3', $page.url)}>user-3</a>

<h3>
  <UserName user={$Layout_User.data?.user} />
  <UserName_2 user={$Layout_User.data?.user} />
</h3>

<div class="ml">
  <a class:active={isTabActive('birth', $page.url)} href="./birth">Birth</a>
  <a class:active={isTabActive('friends', $page.url)} href="./friends">Number of Fiends</a>
  <a class:active={isTabActive('friends?size=3', $page.url)} href="./friends?size=3"
    >Number of Fiends (top 3)</a
  >

  <div class="ml">
    <slot />
  </div>
</div>

<style>
  a {
    color: white;
    margin-right: 10px;
    background-color: gray;
    padding: 0.5rem;
    border-radius: 0.3rem;
  }

  a.active {
    background-color: green;
  }

  .ml {
    margin-left: 2rem;
  }
</style>
