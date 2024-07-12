export type User = {
	id: string
	name: string
	birthDate: Date
	avatarURL: string
}

export const dataUsers: User[]
export function getUserSnapshot(snapshot: string): User
export const resolvers: any
export const typeDefs: any
