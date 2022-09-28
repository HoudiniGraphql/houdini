<script>
  import { graphql } from '$houdini';

  const UserInfo = graphql`
    query NestListsUserInfo {
      user(id: "1", snapshot: "nested-lists") {
        id
        name
      }
    }
  `;
</script>

<div id="user-info">
  {JSON.stringify($UserInfo.data)}
</div>
