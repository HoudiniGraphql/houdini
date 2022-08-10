import graphqlLangDef from './graphql-language'
import typescriptLanguageDef from 'highlight.js/lib/languages/typescript'

export const graphql = { name: 'graphql', register: graphqlLangDef }
export const typescript = { name: 'typescript', register: typescriptLanguageDef }
