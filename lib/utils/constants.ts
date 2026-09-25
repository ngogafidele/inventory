// Defines stable store identifiers and their human-facing branch identity.
export const STORE_KEYS = ["store1", "store2"] as const

export type StoreKey = (typeof STORE_KEYS)[number]

// Store identity is shared by navigation, reports, and generated documents.
export const STORE_LABELS: Record<StoreKey, string> = {
  store1: "Gisozi",
  store2: "Kinyinya",
}

// Customer-facing PDFs must identify the branch that owns the transaction.
export const STORE_ADDRESSES: Record<StoreKey, string> = {
  store1: "Kigali, Gisozi",
  store2: "Kigali, Kinyinya",
}

// Stores whose products can have package units (crate, box, sack) on top of
// their base unit. Other stores keep one unit per product; the unit rules in
// lib/utils/units.ts still apply there, with the base unit as the only option.
export const PACK_UNIT_STORES: readonly StoreKey[] = ["store2"]

export function storeUsesPackUnits(store: StoreKey | null | undefined) {
  return Boolean(store && PACK_UNIT_STORES.includes(store))
}
