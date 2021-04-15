export type UncompleteItem = {
    readonly "input": UncompleteItem$input,
    readonly "result": UncompleteItem$result
};

export type UncompleteItem$result = {
    readonly uncheckItem: {
        readonly item: {
            readonly id: string,
            readonly completed: boolean,
            readonly $fragments: {
                Filtered_Items_remove: true
            }
        } | null
    }
};

export type UncompleteItem$input = {
    id: string
};