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
}: {
  currentStore: StoreKey
  availableStores: StoreKey[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleChange = (value: string) => {
    if (!Object.keys(storeLabels).includes(value)) return
    const store = value as StoreKey
    if (store === currentStore) return

    startTransition(async () => {
      await fetch("/api/auth/switch-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store }),
      })

      router.refresh()
    })
  }

  return (
    <Select value={currentStore} onValueChange={handleChange}>
      <SelectTrigger size="sm" disabled={isPending}>
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
