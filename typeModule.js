import fs from 'fs'

const typeModule = `{
    "type": "module"
}
`

const typeCjs = `{
    "type": "commonjs"
}
`

fs.writeFileSync('build/runtime-esm/package.json', typeModule)
fs.writeFileSync('build/runtime-cjs/package.json', typeCjs)

fs.writeFileSync('build/preprocess-esm/package.json', typeModule)
fs.writeFileSync('build/preprocess-cjs/package.json', typeCjs)

fs.writeFileSync('build/package.json', typeModule)
