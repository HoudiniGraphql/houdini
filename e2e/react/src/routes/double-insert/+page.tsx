import React from 'react'
import { useMutation, graphql } from '$houdini'
import { PageProps } from './$types'

export default function DoubleInsertTest({ DoubleInsertTest}: PageProps) {
    const [value, setValue] = React.useState("")

    const [,insert] = useMutation(graphql(`
        mutation UsersListMutationInsertAddUser($name: String!) {
            addUser(
                name: $name
                birthDate: "2024-01-01T00:00:00Z"
                snapshot: "DoubleInsert"
            ) {
                id
                ...Double_Insert_List_1_insert
                ...Double_Insert_List_2_insert
            }
        }
    `))

    return (
        <>
            <input id="insert" type="text" value={value} onChange={evt=> setValue(evt.target.value)}/>
            <button onClick={() => insert({ variables: { name: value } })}>Add Item</button>
            <h2>Data</h2>
            <div id="result">{JSON.stringify(DoubleInsertTest, null, 2)}</div>
        </>
    )
}