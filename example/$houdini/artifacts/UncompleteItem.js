export const name = "UncompleteItem";
export const kind = "HoudiniMutation";
export const hash = "d3d08fdcd348934829a1f7c24bcdac5e";

export const raw = `mutation UncompleteItem($id: ID!) {
  uncheckItem(item: $id) {
    item {
      id
      completed
      ...Filtered_Items_remove
    }
  }
}

fragment Filtered_Items_remove on TodoItem {
  id
}
`;

export const rootType = "Mutation";

export const selection = {
    "uncheckItem": {
        "type": "UpdateItemOutput",
        "keyRaw": "uncheckItem(item: $id)",

        "fields": {
            "item": {
                "type": "TodoItem",
                "keyRaw": "item",

                "fields": {
                    "id": {
                        "type": "ID",
                        "keyRaw": "id"
                    },

                    "completed": {
                        "type": "Boolean",
                        "keyRaw": "completed"
                    }
                },

                "operations": [{
                    "action": "remove",
                    "connection": "Filtered_Items",

                    "when": {
                        "must": {
                            "completed": true
                        }
                    }
                }]
            }
        }
    }
};