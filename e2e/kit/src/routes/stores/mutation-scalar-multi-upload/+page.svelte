<script lang="ts">
  import { multipleUploadStore } from '$houdini';

  const multipleUpload = new multipleUploadStore();

  async function upload() {
    const file = new File(['Houdini'], 'foo.txt', {
      type: 'text/plain'
    });

    await multipleUpload.mutate({ files: [file, file] });
  }
</script>

<h1>Mutation multi upload</h1>

<button id="mutate" on:click={upload}>Upload files</button>

<div id="result">
  {JSON.stringify($multipleUpload.data)}
</div>
