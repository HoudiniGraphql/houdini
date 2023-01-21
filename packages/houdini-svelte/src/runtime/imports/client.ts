// the actual contents of this file will be changed in codegen to point to the correct
// value designated by the config file
import { HoudiniClient } from '$houdini/runtime/client'

export default new HoudiniClient({ url: 'http://localhost:4000/graphql' })
