export type AddItem = {
    readonly "input": AddItem$input,
    readonly "result": AddItem$result
};

export type AddItem$result = {
    readonly addItem: {
        readonly item: {
            readonly $fragments: {
                Filtered_Items_insert: true,
                All_Items_insert: true
            }
        } | null
    }
};

export type AddItem$input = {
    input: {
        text: string
    }
};