<script lang="ts">
  import { singleUploadStore } from '$houdini';

  const singleUpload = new singleUploadStore();

  async function upload() {
    const file = new File(['Houdini'], 'foo.txt', {
      type: 'text/plain'
    });

    await singleUpload.mutate({ file: file });
  }
</script>

<h1>Mutation single upload</h1>

<button id="mutate" on:click={upload}>Upload file</button>

<div id="result">
  {JSON.stringify($singleUpload.data)}
</div>
