"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type StoreKey = "store1" | "store2"

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
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleChange = (value: string) => {
    if (!Object.keys(storeLabels).includes(value)) return
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

      router.refresh()
    })
  }

  return (
    <Select value={currentStore} onValueChange={handleChange}>
      <SelectTrigger
        size="sm"
        disabled={isPending || !isAdmin || availableStores.length < 2}
      >
        <SelectValue placeholder="Select store" />
      </SelectTrigger>
      <SelectContent>
        {availableStores.map((store) => (
          <SelectItem key={store} value={store}>
            {storeLabels[store]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
