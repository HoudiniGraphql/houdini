<script lang="ts">
  import { GQL_singleUpload } from '$houdini';

  async function upload() {
    const file = new File(['Houdini'], 'foo.txt', {
      type: 'text/plain'
    });

    await GQL_singleUpload.mutate({ file: file });
  }
</script>

<h1>Mutation single upload</h1>

<button id="mutate" on:click={upload}>Upload file</button>

<div id="result">
  {JSON.stringify($GQL_singleUpload.data)}
</div>
