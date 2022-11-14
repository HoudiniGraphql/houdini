<script lang="ts">
  import { graphql } from '$houdini';
  import type { MySubscriptionStore } from '$houdini';

  const MySubscription: MySubscriptionStore = graphql`
    subscription MySubscription {
      userUpdate(id: "1", snapshot: "subscription-test") {
        id
      }
    }
  `;
</script>

<div id="result">hello</div>
