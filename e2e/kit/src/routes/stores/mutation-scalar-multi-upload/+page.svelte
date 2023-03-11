<script lang="ts">
  import { GQL_multipleUpload } from '$houdini';

  async function upload() {
    const file = new File(['Houdini'], 'foo.txt', {
      type: 'text/plain'
    });

    await GQL_multipleUpload.mutate({ files: [file, file] });
  }
</script>

<h1>Mutation multi upload</h1>

<button id="mutate" on:click={upload}>Upload files</button>

<div id="result">
  {JSON.stringify($GQL_multipleUpload.data)}
</div>
