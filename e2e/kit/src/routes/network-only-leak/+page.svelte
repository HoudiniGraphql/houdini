<script>
  import InfoComponent from './UserInfo.svelte';

  let id = '1';
</script>

<div>
  <button on:click={() => (id = '1')}>1</button>
  <button on:click={() => (id = '2')}>2</button>

  <InfoComponent {id} />
</div>
