// externals
import { GraphQLTagResult } from 'houdini-preprocess'
import { CompiledFragmentKind } from 'houdini-compiler'

// fragment returns the requested data from the reference
export default function fragment<T>(fragment: GraphQLTagResult, reference: T) {
	// make sure we got a query document
	if (fragment.kind !== CompiledFragmentKind) {
		throw new Error('getFragment can only take fragment documents')
	}

	// dont be fancy yet, just pull out the fields we care about
	return fragment.applyMask(reference)
}
