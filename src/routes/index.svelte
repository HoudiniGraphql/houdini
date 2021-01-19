<script>
    import { getQuery, graphql } from '$mosaic'

    const query = getQuery(graphql`
        query AllCharacters {
            characters {
                info {
                    count
                }
            }
        }
    `)
</script>

<main>
    <p>
        {#await $query}
            loading...
        {:then data}
            There are {data.characters.info.count} characters in Rick and Morty!
        {:catch error}
            error! {error.message}
        {/await}
    </p>
</main>
