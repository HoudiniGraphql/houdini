// externals
const recast = require('recast')
const { walk } = require('svelte/compiler')
const astTypes = require('ast-types')

// pull out some useful ast constants
const TaggedTemplateExpression = astTypes.namedTypes.TaggedTemplateExpression.name

// a place to store memoized results
let memo = {}

// the mosaic preprocessor is required to strip away the graphql tags
// and leave behind something for the runtime
module.exports = function mosaicPreprocessor() {
    return {
        // the only thing we have to modify is the script blocks
        async script({ content, filename }) {
            if (memo[filename]) {
                return memo[filename]
            }

            // parse the javascript content
            const parsed = recast.parse(content)

            // svelte walk over recast?
            walk(parsed, {
                enter(node) {
                    // if we are looking at the graphql template tag
                    if (node.type === TaggedTemplateExpression && node.tag.name === 'graphql') {
                        // the contents of the template tag
                        const tagContents = node.quasi.quasis[0].value.raw

                        console.log('found one!', filename, tagContents)
                    }
                },
            })

            // turn the results into something the svelte toolchain can use
            const result = recast.print(parsed)

            // save the result for later
            memo[filename] = result

            // return the printed result
            return result
        },
    }
}
