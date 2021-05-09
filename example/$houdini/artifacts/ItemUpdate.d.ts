export type ItemUpdate = {
    readonly "input": ItemUpdate$input,
    readonly "result": ItemUpdate$result
};

export type ItemUpdate$result = {
    readonly itemUpdate: {
        readonly item: {
            readonly id: string,
            readonly completed: boolean,
            readonly text: string
        }
    }
};

export type ItemUpdate$input = {
    id: string
};