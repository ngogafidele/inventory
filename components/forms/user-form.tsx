"use client"

import { useState } from "react"

export function UserForm() {
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
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          Name
          <input className="rounded-md border border-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Email
          <input className="rounded-md border border-border px-3 py-2" />
        </label>
      </div>
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        disabled={saving}
      >
        {saving ? "Saving..." : "Save User"}
      </button>
    </form>
  )
}
