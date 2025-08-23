export const query_variable_fn = (name: string) => {
	return `_${name}Variables`
}

export const houdini_load_fn = '_houdini_load'
export const houdini_before_load_fn = '_houdini_beforeLoad'
export const houdini_afterLoad_fn = '_houdini_afterLoad'
export const houdini_on_error_fn = '_houdini_onError'
