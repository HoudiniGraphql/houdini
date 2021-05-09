export type DeleteItem = {
    readonly "input": DeleteItem$input,
    readonly "result": DeleteItem$result
};

export type DeleteItem$result = {
    readonly deleteItem: {
        readonly itemID: string | null
    }
};

export type DeleteItem$input = {
    id: string
};