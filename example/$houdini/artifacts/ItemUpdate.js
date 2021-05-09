export const name = "ItemUpdate";
export const kind = "HoudiniSubscription";
export const hash = "81c95f0d292097fc59295113720a9272";

export const raw = `subscription ItemUpdate($id: ID!) {
  itemUpdate(id: $id) {
    item {
      id
      completed
      text
    }
  }
}
`;

export const rootType = "Subscription";

export const selection = {
    "itemUpdate": {
        "type": "ItemUpdate",
        "keyRaw": "itemUpdate(id: $id)",

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
                }
            }
        }
    }
};