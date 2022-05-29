<script lang="ts">
	import { GQL_GetTodo, context } from '$houdini'
	GQL_GetTodo.query({ variables: true }, context())
</script>

<!--
<script lang="ts">
	import { GQL_GetTodo } from '$houdini'
	GQL_GetTodo.query({ variables: true })
</script> -->
