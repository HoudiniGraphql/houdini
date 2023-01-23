<script lang="ts">
  import { graphql, type SessionStore } from '$houdini';

  const Session = graphql<SessionStore>`
    query Session @load {
      session
    }
  `;
</script>

<h1>SSR Session</h1>

<div id="result">
  {$Session.data?.session}
</div>
