export const name = "ItemEntry_item";
export const kind = "HoudiniFragment";
export const hash = "bb754a63ce6081f2ed825ec696d4f375";

export const raw = `fragment ItemEntry_item on TodoItem {
  id
  text
  completed
}

fragment Filtered_Items_insert on TodoItem {
  id
  completed
  ...ItemEntry_item
}

fragment Filtered_Items_remove on TodoItem {
  id
}

fragment All_Items_insert on TodoItem {
  id
  completed
}

fragment All_Items_remove on TodoItem {
  id
}

directive @TodoItem_delete repeatable on FIELD
`;

export const rootType = "TodoItem";

export const selection = {
    "id": {
        "type": "ID",
        "keyRaw": "id"
    },

    "text": {
        "type": "String",
        "keyRaw": "text"
    },

    "completed": {
        "type": "Boolean",
        "keyRaw": "completed"
    }
};