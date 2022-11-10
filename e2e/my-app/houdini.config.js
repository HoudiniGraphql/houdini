/// <references types="houdini-svelte">

/** @type {import('houdini').ConfigFile} */
const config = {
    "schemaPath": "**/*.graphql",
    "plugins": {
        "houdini-svelte": {
            "client": "./src/client"
        }
    }
}

export default config
