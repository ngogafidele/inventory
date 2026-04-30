export const STORE_KEYS = ["store1", "store2"] as const

export type StoreKey = (typeof STORE_KEYS)[number]
