<script lang="ts">
    import { fragment, graphql, type UserStyle2 } from '$houdini'

    // the reference will get passed as a prop
    export let user: UserStyle2

    $: data = fragment(
        graphql`
            fragment UserStyle2 on User {
                id
                name
            }
        `,
        user
    )
</script>

<li>{$data.id} - {$data.name}</li>