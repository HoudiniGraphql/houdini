export const name = "AllItems";
export const kind = "HoudiniQuery";
export const hash = "89d2e5393b2bb371f44b1110fc7c0c39";

export const raw = `query AllItems($completed: Boolean) {
  filteredItems: items(completed: $completed) {
    id
    completed
    ...ItemEntry_item
  }
  allItems: items {
    id
    completed
  }
}

fragment ItemEntry_item on TodoItem {
  id
  text
  completed
}
`;

export const rootType = "Query";

export const selection = {
    "filteredItems": {
        "type": "TodoItem",
        "keyRaw": "filteredItems(completed: $completed)",

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

        "connection": "Filtered_Items",

        "filters": {
            "completed": {
                "kind": "Variable",
                "value": "completed"
            }
        }
    },

    "allItems": {
        "type": "TodoItem",
        "keyRaw": "allItems",

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

        "connection": "All_Items"
    }
};