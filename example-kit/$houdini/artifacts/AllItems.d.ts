export type AllItems = {
    readonly "input": AllItems$input,
    readonly "result": AllItems$result
};

export type AllItems$result = {
    readonly filteredItems: ({
        readonly id: string,
        readonly completed: boolean,
        readonly $fragments: {
            ItemEntry_item: true
        }
    })[],
    readonly allItems: ({
        readonly id: string,
        readonly completed: boolean
    })[]
};

export type AllItems$input = {
    completed: boolean | null | undefined
};