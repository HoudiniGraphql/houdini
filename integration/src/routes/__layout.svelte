<script context="module">
  import { houdiniClient } from '$lib/graphql/houdiniClient';
  houdiniClient.init();
</script>

<nav>
  <a href="/">Home</a>
  <a href="/stores/ssr">1/ Stores / SSR</a>
  <a href="/stores/network">1/ Stores / NETWORK</a>
</nav>

<slot />
