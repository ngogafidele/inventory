"use client"

// Provides client state helpers for transient alert messages.
import { useCallback, useState } from "react"

export function useAlert() {
  const [message, setMessage] = useState<string | null>(null)

  const showAlert = useCallback((next: string) => {
    setMessage(next)
    setTimeout(() => setMessage(null), 2500)
  }, [])

  return { message, showAlert }
}
