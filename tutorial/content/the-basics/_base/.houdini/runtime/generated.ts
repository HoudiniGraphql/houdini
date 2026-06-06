import type { Record } from "./public/record";

export declare type CacheTypeDef = {
		types: {
			__ROOT__: {
				idFields: {};
				fields: {
					__typename: {
						type: string;
						args: never;
					};
					book: {
						type: Record<CacheTypeDef, "Book"> | null;
						args: {
							id: string | number;
						};
					};
					books: {
						type: (Record<CacheTypeDef, "Book">)[];
						args: never;
					};
				};
				fragments: [];
			};
			Book: {
				idFields: {
					id: any;
				};
				fields: {
					__typename: {
						type: string;
						args: never;
					};
					author: {
						type: string;
						args: never;
					};
					id: {
						type: string;
						args: never;
					};
					title: {
						type: string;
						args: never;
					};
				};
				fragments: [];
			};
		};
		lists: {
		};
		queries: [];
		scalars: number | boolean | string;
};
