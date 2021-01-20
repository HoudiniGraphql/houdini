// externals
const path = require('path')
const fs = require('fs/promises')
const recast = require('recast')
const { walk } = require('svelte/compiler')
const astTypes = require('ast-types')
const { parse } = require('graphql')
const { asyncWalk } = require('estree-walker')
const typeBuilders = recast.types.builders

// pull out some useful ast constants
const TaggedTemplateExpression = astTypes.namedTypes.TaggedTemplateExpression.name
const CallExpression = astTypes.namedTypes.CallExpression.name
const VariableDeclarator = astTypes.namedTypes.VariableDeclarator.name

// a place to store memoized results
let memo = {}

// the mosaic preprocessor is required to strip away the graphql tags
// and leave behind something for the runtime
module.exports = function mosaicPreprocessor({artifactDirectory, artifactDirectoryAlias}) {
    return {
        // the only thing we have to modify is the script blocks
        async script({ content, filename }) {
            if (memo[filename]) {
                return memo[filename]
            }

            // parse the javascript content
            const parsed = recast.parse(content)

            // svelte walk over recast?
            await asyncWalk(parsed, {
                async enter(node, parent) {
                    // if we are looking at the graphql template tag
                    if (node.type === TaggedTemplateExpression && node.tag.name === 'graphql') {
                        // we're going to replace the tag with an import from the artifact directory

                        // first, lets parse the tag contents to get the info we need
                        const parsedTag  = parse(node.quasi.quasis[0].value.raw)

                        // make sure there is only one definition
                        if (parsedTag.definitions.length > 1) {
                            throw new Error("Encountered multiple definitions in a tag")
                        }

                        // pull out the name of the thing
                        const name = parsedTag.definitions[0].name.value

                        // there are two options for "valid" usage of the tag.
                        // either inline with a call to a function
                        //      ie: getQuery(graphql``)
                        // or as a variable definition (to be passed to the function)
                        //      ie const query = graphql``
                        // in either case, we can just replace the tagged template expression
                        // with an import expression and let the compiler do the work

                        // define the import expression both cases need
                        const relativePath = path.join(path.relative(filename, artifactDirectory), ``)
                        const importExpression = typeBuilders.importExpression(typeBuilders.literal(`${artifactDirectoryAlias}/${name}.graphql.js`))

                        // check if we are being passed straight to a function
                        if (parent.type === CallExpression) {
                            parent.arguments[0] = importExpression
                        } else if (parent.type === VariableDeclarator) {
                            parent.init = importExpression
                        }

                        // the absolute filepath of the target artifact
                        const artifactPath = path.join(artifactDirectory, `${name}.graphql.js`)

                        try {
                            await fs.stat(artifactPath)
                        } catch (e) {
                            throw new Error("Looks like you need to run the mosaic compiler for this file")
                        }
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

function processQuery(query) {

}
