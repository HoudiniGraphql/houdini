export type CompleteItem = {
    readonly "input": CompleteItem$input,
    readonly "result": CompleteItem$result
};

export type CompleteItem$result = {
    readonly checkItem: {
        readonly item: {
            readonly id: string,
            readonly completed: boolean,
            readonly $fragments: {
                Filtered_Items_remove: true
            }
        } | null
    }
};

export type CompleteItem$input = {
    id: string
};