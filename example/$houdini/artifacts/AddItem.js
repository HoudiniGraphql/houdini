export const name = "AddItem";
export const kind = "HoudiniMutation";
export const hash = "02e47d392ba612a24af66597d1c019cf";

export const raw = `mutation AddItem($input: AddItemInput!) {
  addItem(input: $input) {
    item {
      ...Filtered_Items_insert
      ...All_Items_insert
    }
  }
}

fragment Filtered_Items_insert on TodoItem {
  id
  completed
  ...ItemEntry_item
}

fragment All_Items_insert on TodoItem {
  id
  completed
}

fragment ItemEntry_item on TodoItem {
  id
  text
  completed
}
`;

export const rootType = "Mutation";

export const selection = {
    "addItem": {
        "type": "AddItemOutput",
        "keyRaw": "addItem(input: $input)",

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
                    },

                    "text": {
                        "type": "String",
                        "keyRaw": "text"
                    }
                },

                "operations": [{
                    "action": "insert",
                    "connection": "Filtered_Items",
                    "position": "first",

                    "when": {
                        "must_not": {
                            "completed": true
                        }
                    }
                }, {
                    "action": "insert",
                    "connection": "All_Items",
                    "position": "last"
                }]
            }
        }
    }
};