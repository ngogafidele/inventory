"use client"

import { useTransition } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STORE_KEYS = ["store1", "store2"] as const
type StoreKey = (typeof STORE_KEYS)[number]

const storeLabels: Record<StoreKey, string> = {
  store1: "Store 1",
  store2: "Store 2",
}

export function StoreSwitcher({
  currentStore,
  availableStores,
  isAdmin,
}: {
  currentStore: StoreKey
  availableStores: StoreKey[]
  isAdmin: boolean
}) {
  const [isPending, startTransition] = useTransition()

  if (!isAdmin) {
    return null
  }

  const handleChange = (value: string) => {
    if (!STORE_KEYS.includes(value as StoreKey)) return
    const store = value as StoreKey
    if (store === currentStore) return

    startTransition(async () => {
      const response = await fetch("/api/auth/switch-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        alert(body?.error ?? "Failed to switch store")
        return
      }

      window.location.reload()
    })
  }

  return (
    <Select value={currentStore} onValueChange={handleChange}>
      <SelectTrigger
        className="h-12 min-w-40 border-primary/40 bg-primary/10 px-4 text-base font-semibold text-primary shadow-sm hover:bg-primary/15"
        disabled={isPending || availableStores.length < 2}
      >
        <SelectValue placeholder="Select store" />
      </SelectTrigger>
      <SelectContent>
        {availableStores.map((store) => (
          <SelectItem key={store} value={store} className="py-2 text-base">
            {storeLabels[store]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
