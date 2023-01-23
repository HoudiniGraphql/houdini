<script lang="ts">
  import { graphql } from '$houdini';

  const Session = graphql`
    query Session @load {
      session
    }
  `;
</script>

<h1>SSR Session</h1>

<div id="result">
  {$Session.data?.session}
</div>
