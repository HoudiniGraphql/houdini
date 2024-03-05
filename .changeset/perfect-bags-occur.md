---
'houdini-svelte': patch
---

Remove generics from script tag before calling svelte preprocessor.

Otherwise it will fail to parse the source if the generics attribute contains angle brackets.

For example this code failed to parse:

```html
<script lang="ts" generics="T extends Record<string, unknown>">

</script>
```

Now the `parseSvelte` function will remove the generics attribute before calling the svelte preprocessor
preserving the token positions in the source code.

The output for the above example will be:

```html
<script lang="ts"                                             >

</script>
```
