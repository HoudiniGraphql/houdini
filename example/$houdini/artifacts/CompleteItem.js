export const name = "CompleteItem";
export const kind = "HoudiniMutation";
export const hash = "cce9318067ed9ac433f0fed6c7337634";

export const raw = `mutation CompleteItem($id: ID!) {
  checkItem(item: $id) {
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
    "checkItem": {
        "type": "UpdateItemOutput",
        "keyRaw": "checkItem(item: $id)",

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
                            "completed": false
                        }
                    }
                }]
            }
        }
    }
};