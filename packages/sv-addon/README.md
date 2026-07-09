# [sv](https://svelte.dev/docs/cli/overview) community add-on: [@houdinigraphql/sv](https://github.com/houdinigraphql/houdini)

> [!IMPORTANT]
> Svelte maintainers have not reviewed community add-ons for malicious code. Use at your discretion

## Usage

To install the add-on, run:

```shell
npx sv add @houdinigraphql
```

You will be prompted with some options to set up Houdini for your needs:

## Options

### `is_remote_endpoint`

Specify whether you will be utilising a remote endpoint. Accepts `yes` or `no`.

### `remote_endpoint`

The URL of the remote endpoint where your API is hosted. Only applicable if you answered `yes` for is_remote_endpoint. Accepts a string.

### `local_schema`

Path to where your local schema lives on disk. Only applicable if you answered `no` for is_remote_endpoint. Accepts a string.

## Options shortcut

> [!NOTE]
> The Svelte cli supports bypassing the interactive cli by passing the options directly: `npx sv add @houdinigraphql="is_remote_endpoint:yes"`
>
> This will not work for the `remote_endpoint` option, because the Svelte cli splits the parameters on the `:` character,
> which results in the `remote_endpoint` only getting `https` as value.
