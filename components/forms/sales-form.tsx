"use client"

import { useState } from "react"

export function SalesForm() {
  const [saving, setSaving] = useState(false)

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        setSaving(true)
        setTimeout(() => setSaving(false), 300)
      }}
    >
      <label className="flex flex-col gap-2 text-sm">
        Notes
        <textarea className="min-h-[120px] rounded-md border border-border px-3 py-2" />
      </label>
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        disabled={saving}
      >
        {saving ? "Saving..." : "Record Sale"}
      </button>
    </form>
  )
}
