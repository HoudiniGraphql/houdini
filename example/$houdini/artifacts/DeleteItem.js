export const name = "DeleteItem";
export const kind = "HoudiniMutation";
export const hash = "af0426e6e061efc22564e42bf13412db";

export const raw = `mutation DeleteItem($id: ID!) {
  deleteItem(item: $id) {
    itemID
  }
}
`;

export const rootType = "Mutation";

export const selection = {
    "deleteItem": {
        "type": "DeleteIemOutput",
        "keyRaw": "deleteItem(item: $id)",

        "fields": {
            "itemID": {
                "type": "ID",
                "keyRaw": "itemID",

                "operations": [{
                    "action": "delete",
                    "type": "TodoItem"
                }]
            }
        }
    }
};