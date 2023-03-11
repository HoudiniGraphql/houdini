<script lang="ts">
  import { graphql } from '$houdini';

  graphql`
    subscription MySubscription {
      userUpdate(id: "1", snapshot: "subscription-test") {
        id
      }
    }
  `;
</script>

<div id="result">hello</div>
