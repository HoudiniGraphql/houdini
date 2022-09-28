<script>
  import { graphql } from '$houdini';

  const UserInfo = graphql`
    query NestListsUserInfo {
      user(id: "1", snapshot: "nested-lists") {
        id
        name
        nested {
          something
        }
      }
    }
  `;
</script>

<div id="user-info">
  {JSON.stringify($UserInfo.data)}
</div>

<a href="/stores/nested-lists">back</a>
