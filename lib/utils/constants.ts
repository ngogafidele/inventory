export const STORE_KEYS = ["store1", "store2"] as const

export type StoreKey = (typeof STORE_KEYS)[number]

export const STORE_LABELS: Record<StoreKey, string> = {
  store1: "Gisozi",
  store2: "Kinyinya",
}
